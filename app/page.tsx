// File: /app/page.tsx
'use client';
import {
  useEffect,
  useState,
  useCallback
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
  Order, OrderRow, FoodData
} from "@/types";

import OrderCard from "@/components/OrderCard";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  // Changed foodData to foodDataMap to store data per orderDocumentId
  const [foodDataMap, setFoodDataMap] = useState<Record<string, FoodData>>({});
  const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL;

  const fetchOrders = useCallback(async () => {
    const jwt = localStorage.getItem('jwt');
    setUserName(localStorage.getItem('username') ?? 'Unidentified User');
    if (!jwt) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }
    setIsAuthenticated(true);
    try {
      const response = await fetch(`${STRAPI_URL}/api/orders/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        cache: 'no-store',
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('jwt');
          setIsAuthenticated(false);
          setFetchError("Session expired or unauthorized. Please log in again.");
        } else {
          const errorData = await response.json();
          console.error(`Failed to fetch orders: ${response.status} ${response.statusText}`, errorData);
          setFetchError(errorData.error?.message || `Error fetching orders: ${response.status}`);
        }
        setOrders([]);
      } else {
        const {
          data
        } = await response.json();
        const allOrders: Order[] = data.map((item: any) => ({
          id: item.id,
          documentId: item.documentId,
          orderStatus: item.orderStatus,
          tableName: item.tableName,
          customerName: item.customerName,
          createdAt: item.createdAt,
          paymentDaytime: item.paymentDaytime,
          order_rows: item.order_rows?.data ? item.order_rows.data.map((row: any) => ({
            id: row.id,
            documentId: row.documentId,
            quantity: row.quantity,
            subtotal: row.subtotal,
            taxesSubtotal: row.taxesSubtotal,
            orderRowStatus: row.orderRowStatus,
            createdAt: row.createdAt,
            category_doc_id: row.category_doc_id,
            product_doc_id: row.product_doc_id,
            order_doc_id: item.documentId, // Correctly assign order_doc_id from parent order
          })) : [],
        }));


        setOrders(allOrders);
        setFetchError(null);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      setFetchError("Network error or server unavailable.");
      setOrders([]);
    } finally {
      if (isAuthenticated) {
        setIsLoading(false);
      }
    }
  }, [STRAPI_URL, isAuthenticated]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const initialAndIntervalFetch = async () => {
      if (orders.length === 0 && !fetchError) {
        setIsLoading(true);
      }
      await fetchOrders();
      setIsLoading(false);
    };
    initialAndIntervalFetch();
    intervalId = setInterval(() => {
      console.log('Fetching orders...');
      fetchOrders();
    }, 5000);
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchOrders, fetchError, orders.length]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = (dateString: string): boolean => {
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  };

  async function getOrderData(orderDocId: string): Promise<Order | null> {
    try {
      const orderResponse = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/orders/${orderDocId}?populate=*`, {
        cache: 'no-store',
      });

      if (!orderResponse.ok) {
        if (orderResponse.status === 404) {
          console.warn(`Order with documentId ${orderDocId} not found.`);
          return null;
        }
        throw new Error(`Error fetching order data: ${orderResponse.status} ${orderResponse.statusText}`);
      }
      const orderResponseData = await orderResponse.json();

      if (!orderResponseData.data) {
        console.warn("Missing order data in response");
        return null;
      }

      const actualOrderDocId = orderResponseData.data.documentId || orderDocId;
      const fetchedOrderAttributes: Partial<Omit<Order, 'id' | 'order_rows'>> = {
        orderStatus: orderResponseData.data.orderStatus,
        tableName: orderResponseData.data.tableName,
        customerName: orderResponseData.data.customerName,
        createdAt: orderResponseData.data.createdAt,
        documentId: actualOrderDocId,
      };

      const orderRowsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/order-rows?filters[order_doc_id][$eq]=${actualOrderDocId}&populate=*`,
        { cache: 'no-store' }
      );

      if (!orderRowsResponse.ok) {
        throw new Error(`Error fetching order rows: ${orderRowsResponse.status} ${orderRowsResponse.statusText}`);
      }
      const orderRowsResponseData = await orderRowsResponse.json();

      return {
        id: orderResponseData.data.id,
        documentId: actualOrderDocId,
        ...fetchedOrderAttributes,
        order_rows: orderRowsResponseData.data,
      } as Order;

    } catch (err: any) {
      console.error("Error in getOrderData:", err);
      return null;
    }
  }

  async function getFoodOrderData(orderRows: OrderRow[]): Promise<any> {
    let foodOrderData = []
    try {
      for (const e of orderRows) {
        const catResponse = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/categories/${e.category_doc_id}?populate=*`, {
          cache: 'no-store',
        });

        if (!catResponse.ok) {
          throw new Error(`Error fetching category data: ${catResponse.status} ${catResponse.statusText}`);
        }

        const catData = await catResponse.json();
        let foodDataItem = {
          isFood: catData.data.isFood,
          status: e.orderRowStatus
        }
        foodOrderData.push(foodDataItem);
      }
    } catch (err: any) {
      console.error("Error in getFoodOrderData:", err);
      return null;
    }
    return foodOrderData;
  }

  // Made useCallback to avoid unnecessary recreations and added foodDataMap as a dependency
  const getOrderFoodInfo = useCallback((order: Order): void => {
    // Do not refetch if data for this order.documentId is already present
    if (order.documentId && foodDataMap[order.documentId]) {
      return;
    }

    getOrderData(order.documentId!).then((orderData) => {
      if (orderData) {
        getFoodOrderData(orderData.order_rows).then((foodOrderData) => {
          if (foodOrderData) {
            const processed = ProcessFoodData(foodOrderData);
            if (processed) {
              // Update the foodDataMap for the specific order.documentId
              setFoodDataMap(prevMap => ({
                ...prevMap,
                [order.documentId!]: processed
              }));
            } else {
              // Optionally, remove or set to null if no food data is found
              setFoodDataMap(prevMap => {
                const newMap = { ...prevMap };
                delete newMap[order.documentId!];
                return newMap;
              });
            }
          }
        });
      }
    });
  }, [foodDataMap]); // Added foodDataMap as a dependency

  const ProcessFoodData = (foodData: any): FoodData | null => {
    let foodDataInfo = { hasFoodToCook: false, allFoodIsCooked: false };
    if (foodData && foodData.length > 0) {
      for (const item of foodData) {
        if (item.isFood === true && item.status === 'pending') {
          foodDataInfo.hasFoodToCook = true;
          break;
        }
      }

      const foodItems = foodData.filter((item: any) => item.isFood === true);
      // Potential correction: "allFoodIsCoocked" should likely be "allFoodIsCooked"
      if (foodItems.length > 0 && foodItems.every((item: any) => item.status === 'served')) {
        foodDataInfo.allFoodIsCooked = true;
      }
      return foodDataInfo;
    }
    return null;
  }
  // Apply the 'isToday' filter to served and pending orders
  const servedOrders = orders.filter(order => order.orderStatus === 'served' && isToday(order.createdAt));
  const pendingOrders = orders.filter(order => order.orderStatus === 'pending' && isToday(order.createdAt));

  // Trigger for fetching food data for pending orders
  useEffect(() => {
    pendingOrders.forEach(order => {
      getOrderFoodInfo(order);
    });
  }, [pendingOrders, getOrderFoodInfo]); // Dependency on pendingOrders and getOrderFoodInfo

  const todayPaidOrders = orders.filter(order => {
    if (order.orderStatus === 'paid' && order.paymentDaytime) {
      const paymentDate = new Date(order.paymentDaytime);
      paymentDate.setHours(0, 0, 0, 0); // Normalize payment date to midnight
      return paymentDate.getTime() === today.getTime();
    }
    return false;
  });

  const formatMinutes = (minutes: number): string => {
    return minutes < 10 ? `0${minutes}` : minutes.toString();
  };

  if (isLoading) {
    return (<main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <p className="text-xl">Loading orders...</p>
    </main>);
  }

  if (!isAuthenticated) {
    return (<main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground text-center">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-primary">Access Required</h1>
      {fetchError && <p className="text-red-500 mb-4">{fetchError}</p>}
      <p className="text-lg text-gray-700 mb-8">You must be logged in to view the orders.</p>
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
        <p className="text-primary font-bold text-center capitalize pt-4">{userName}</p>
      </div>
      <div className="flex gap-x-2">
        <Button asChild size="lg" className="px-2">
          <Link href="/new-order">New Order</Link>
        </Button>
        <LogoutButton />
      </div>
    </div>

    <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-primary">Current Orders</h1>

    {fetchError && (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6 w-full max-w-6xl" role="alert">
        <strong className="font-bold">Loading Error: </strong>
        <span className="block sm:inline">{fetchError}</span>
        <p className="text-sm mt-2">Please, try reloading the page or logging in again.</p>
      </div>
    )}

    <div className="flex w-full max-w-6xl gap-8 flex-col md:flex-row">
      {/* Pending Orders Section */}
      <div className="flex flex-col items-center flex-1 p-4 bg-card rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-orange-500">Pending Orders</h2>
        {pendingOrders.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {pendingOrders.map((order) => (
              // Pass the specific foodData for this order from the map
              <OrderCard key={order.documentId} order={order} foodData={foodDataMap[order.documentId!]} />
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No pending orders at the moment.</p>
        )}
      </div>

      <div className="hidden md:block w-px bg-gray-300"></div>

      {/* Served Orders Section */}
      <div className="flex flex-col items-center flex-1 p-4 bg-card rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-green-500">Served Orders</h2>
        {servedOrders.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {servedOrders.map((order) => (
              // Use OrderCard for served orders as well, passing undefined for foodData if not needed
              <OrderCard key={order.documentId} order={order} foodData={undefined} />
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No served orders yet.</p>
        )}
      </div>
    </div>

    {/* Today's Paid Orders Section */}
    <div className="w-full max-w-6xl mt-8 p-4 bg-card rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-blue-500 text-center">Today's Paid Orders</h2>
      {todayPaidOrders.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 w-full">
          {todayPaidOrders.map((order) => (
            // Use OrderCard for paid orders, passing undefined for foodData
            <OrderCard key={order.documentId} order={order} foodData={undefined} />
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-center">No paid orders today yet.</p>
      )}
    </div>
  </main>);
}