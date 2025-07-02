// File: /app/page.tsx
'use client';
import {
  useEffect,
  useState,
  useCallback,
  useRef
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Button
} from "@/components/ui/button";

import {
  LogoutButton
} from '@/components/LogoutButton';
import {
  Order, OrderRow
} from "@/types";

import Chart from 'chart.js/auto';


declare const apiClient: {
  get: (path: string, params?: Record<string, any>) => Promise<any>;
};

export default function Analytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL;

  const hourlyChartRef = useRef<Chart | null>(null);
  const categoryChartRef = useRef<Chart | null>(null);
  const dailyChartRef = useRef<Chart | null>(null);
  const sampleChartRef = useRef<Chart | null>(null);

  

  // --- MODIFIED processFetchedOrders function (NO .attributes) ---
const processFetchedOrders = useCallback(async (items: any[]): Promise<Order[]> => {
  if (!items || !Array.isArray(items)) {
    console.error("processFetchedOrders: Expected an array of items, but received:", items);
    return [];
  }

  const processedOrders: Order[] = [];

  for (const item of items) {
    if (!item || !item.documentId) {
      console.error("processFetchedOrders: Item missing expected properties (e.g., documentId). Received item:", item);
      processedOrders.push({
        id: 0,
        documentId: 'unknown_document_id',
        orderStatus: 'cancelled',
        tableName: 'N/A',
        customerName: 'N/A',
        createdAt: new Date().toISOString(),
        paymentDaytime: 'N/A',
        order_rows: []
      });
      continue; // Skip to the next item
    }

    let processedRows: OrderRow[] = [];


    console.log(processedRows, "Processed rows for order:", item.documentId);

    processedOrders.push({
      id: item.id ?? 'unknown_id',
      documentId: item.documentId,
      orderStatus: item.orderStatus,
      tableName: item.tableName,
      customerName: item.customerName,
      createdAt: item.createdAt,
      paymentDaytime: item.paymentDaytime,
      order_rows: processedRows,
    });
  }

  // Filter out any orders that had critical missing documentId if they were added with 'unknown_document_id'
  return processedOrders.filter(order => order.documentId !== 'unknown_document_id');
}, []);
  // --- END MODIFIED processFetchedOrders function ---


  const fetchAllOrders = useCallback(async () => {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return [];
    }
    setIsAuthenticated(true);

    try {
      const response = await fetch(
        `${STRAPI_URL}/api/orders?populate=*`, // Use _limit=-1 for all records in Strapi v3
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
          },
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('jwt');
          setIsAuthenticated(false);
          setFetchError("Session expired or unauthorized. Please log in again.");
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error(`Failed to fetch all orders: ${response.status} ${response.statusText}`, errorData);
            setFetchError(errorData.error?.message || `Error fetching all orders: ${response.status}`);
        }
        return [];
      }

      const data = await response.json();
      console.log("Raw data from fetchAllOrders (NO .attributes):", data); // IMPORTANT: Check this log
      setFetchError(null);

      // In Strapi v3, the data might be directly the array, not data.data
      const itemsToProcess = Array.isArray(data) ? data : data.data; // Try both, depending on exact v3 config

      if (!itemsToProcess || !Array.isArray(itemsToProcess)) {
        console.error("fetchAllOrders: Expected an array of orders, but received:", data);
        setFetchError("Invalid data format received from server for orders.");
        return [];
      }

      return processFetchedOrders(itemsToProcess);
    } catch (error: any) {
      console.error("Error fetching all orders:", error);
      setFetchError("Network error or server unavailable when fetching all orders.");
      return [];
    }
  }, [STRAPI_URL, processFetchedOrders]);

  // --- MODIFIED getProductDetails function (NO .attributes) ---


  // --- END MODIFIED getProductDetails function ---

  const processAllOrdersForCharts = useCallback(async (orders: Order[]) => {
    const hourlyData: Record<number, number> = {};
    const categoryData: Record<string, number> = {};
    const dailyData: Record<string, number> = {};
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (let i = 0; i < 24; i++) {
      hourlyData[i] = 0;
    }
    dayNames.forEach(day => {
      dailyData[day] = 0;
    });

    for (const order of orders) {
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        const hour = orderDate.getHours();
        hourlyData[hour] = (hourlyData[hour] || 0) + 1;

        const dayOfWeek = orderDate.getDay();
        dailyData[dayNames[dayOfWeek]] = (dailyData[dayNames[dayOfWeek]] || 0) + 1;
      }
    }
    return { hourlyData, categoryData, dailyData };
  }, []);

  useEffect(() => {
    const loadAnalyticsData = async () => {
      setIsLoading(true);
      setUserName(localStorage.getItem('username') ?? 'Unidentified User');

      const jwt = localStorage.getItem('jwt');
      if (!jwt) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      setIsAuthenticated(true);

      const fetchedOrders = await fetchAllOrders();
      setAllOrders(fetchedOrders);
      setIsLoading(false);
    };

    loadAnalyticsData();

    return () => {
      if (hourlyChartRef.current) hourlyChartRef.current.destroy();
      if (dailyChartRef.current) dailyChartRef.current.destroy();
    };
  }, [fetchAllOrders]);

  useEffect(() => {
    if (hourlyChartRef.current) hourlyChartRef.current.destroy();
    if (dailyChartRef.current) dailyChartRef.current.destroy();

    const renderCharts = async () => {


      if (allOrders.length === 0) {
        console.log("No orders available to display in charts.");
        return;
      }

      const { hourlyData, dailyData } = await processAllOrdersForCharts(allOrders);

      // Hourly Orders Chart
      const hourlyCanvas = document.getElementById('hourlyOrdersChart');
      if (hourlyCanvas instanceof HTMLCanvasElement) {
        const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        const data = labels.map((_, i) => hourlyData[i] || 0);

        hourlyChartRef.current = new Chart(
          hourlyCanvas,
          {
            type: 'line',
            data: {
              labels: labels,
              datasets: [{
                label: 'Orders by Hour',
                data: data,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Number of Orders by Hour of Day (Creation Time)',
                  font: {
                    size: 16
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Number of Orders'
                  }
                },
                x: {
                  title: {
                    display: true,
                    text: 'Hour of Day'
                  }
                }
              }
            }
          }
        );
      }

      // Orders by Day of Week Chart
      const dailyCanvas = document.getElementById('dailyOrdersChart');
      if (dailyCanvas instanceof HTMLCanvasElement) {
        const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const data = labels.map(day => dailyData[day] || 0);

        dailyChartRef.current = new Chart(
          dailyCanvas,
          {
            type: 'pie',
            data: {
              labels: labels,
              datasets: [{
                label: 'Orders by Day of Week',
                data: data,
                backgroundColor: [
                  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#CD5C5C'
                ],
                hoverOffset: 4
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Distribution of Orders by Day of Week (Creation Time)',
                  font: {
                    size: 16
                  }
                }
              }
            }
          }
        );
      }
    };

    if (!isLoading && isAuthenticated && userName === 'roberto') {
      renderCharts();
    }

  }, [allOrders, isLoading, isAuthenticated, userName, processAllOrdersForCharts]);

  if (isLoading) {
    return (<main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <p className="text-xl">Loading analytics data...</p>
    </main>);
  }

  if (!isAuthenticated || userName !== 'roberto') {
    return (<main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground text-center">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-primary">Access Required</h1>
      {fetchError && <p className="text-red-500 mb-4">{fetchError}</p>}
      <p className="text-lg text-gray-700 mb-8">You must be logged in as Roberto to view this page</p>
      <Button asChild size="lg">
        <Link href="/login">Login</Link>
      </Button>
    </main>);
  }

  return (<main className="flex min-h-screen flex-col items-center px-4 sm:px-8 md:px-24 py-8 bg-background text-foreground">
    <div className='flex items-center justify-between w-full max-w-6xl mt-8 mb-6'>
      <div className="logo-container">
        <Image
          src="/logo.png"
          alt="Logo"
          width={80}
          height={80}
          className="logo"
          priority
        />
        <p className="text-primary font-bold text-center capitalize">{userName}</p>
      </div>
      <LogoutButton />
    </div>

    <h1 className="text-3xl sm:text-4xl font-bold mb-2 lg:mb-8 text-primary">Analytics</h1>

    {fetchError && <p className="text-red-500 mb-4 w-full max-w-6xl text-center">{fetchError}</p>}

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
      {/* Sample Chart: Acquisitions by year (using static data) */}


      {/* Chart: Orders by Hour */}
      <div className="bg-card p-4 rounded-lg shadow-md">
        <canvas width='100%' height='100%' id="hourlyOrdersChart"></canvas>
      </div>

      {/* Chart: Orders by Day of Week */}
      <div className="bg-card p-4 rounded-lg shadow-md md:col-span-2 lg:col-span-1">
        <canvas className="h-full grow" id="dailyOrdersChart"></canvas>
      </div>
    </div>
  </main>);
}