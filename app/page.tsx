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
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [servedOrders, setServedOrders] = useState<Order[]>([]);
  const [todayPaidOrders, setTodayPaidOrders] = useState<Order[]>([]);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [foodDataMap, setFoodDataMap] = useState<Record<string, FoodData>>({});
  const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL;

  // --- MODIFIED FUNCTION HERE ---
  const getTodayDateRange = () => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0); // Start of the current calendar day

    const nextDay = new Date(now);
    nextDay.setDate(now.getDate() + 1); // Move to the next calendar day
    const effectiveDayEnd = new Date(nextDay);
    effectiveDayEnd.setHours(4, 0, 0, 0); // End at 4 AM of the next calendar day

    // If current time is past 4 AM but before midnight, the "today" period has already passed its 4 AM mark.
    // In this case, the start of the period should actually be 4 AM of the *current* day (yesterday's "end").
    // And the end should be 4 AM of *tomorrow*.

    // Let's refine this to be robust:
    // If it's 3 PM on Monday, your "today" is Monday 00:00:00 to Tuesday 04:00:00
    // If it's 2 AM on Tuesday, your "today" is Monday 00:00:00 to Tuesday 04:00:00
    // If it's 5 AM on Tuesday, your "today" is Tuesday 00:00:00 to Wednesday 04:00:00

    // This logic aims to determine the correct "business day" based on the current time.
    let startOfBusinessDay = new Date(now);
    let endOfBusinessDay = new Date(now);

    if (now.getHours() < 4) {
      // If it's before 4 AM, we are still in yesterday's business day.
      // So, the start of the business day is the previous calendar day at 00:00:00
      startOfBusinessDay.setDate(now.getDate() - 1);
      startOfBusinessDay.setHours(0, 0, 0, 0);

      // The end of the business day is today at 4 AM
      endOfBusinessDay.setHours(4, 0, 0, 0);
    } else {
      // If it's 4 AM or later, it's a new business day.
      // The start of the business day is today at 00:00:00
      startOfBusinessDay.setHours(0, 0, 0, 0);

      // The end of the business day is tomorrow at 4 AM
      endOfBusinessDay.setDate(now.getDate() + 1);
      endOfBusinessDay.setHours(4, 0, 0, 0);
    }

    return {
      start: startOfBusinessDay.toISOString(),
      end: endOfBusinessDay.toISOString()
    };
  };
  // --- END OF MODIFIED FUNCTION ---

  const fetchFilteredOrders = useCallback(async () => {
    const jwt = localStorage.getItem('jwt');
    setUserName(localStorage.getItem('username') ?? 'Unidentified User');

    if (!jwt) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }
    setIsAuthenticated(true);

    const { start, end } = getTodayDateRange();

    try {
      const commonHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      };

      // 1. Fetch Pending Orders for the current "business day"
      const pendingResponse = await fetch(
        `${STRAPI_URL}/api/orders?filters[orderStatus][$eq]=pending&filters[createdAt][$gte]=${start}&filters[createdAt][$lt]=${end}&populate=order_rows`,
        {
          method: 'GET',
          headers: commonHeaders,
          cache: 'no-store',
        }
      );

      // 2. Fetch Served Orders for the current "business day"
      const servedResponse = await fetch(
        `${STRAPI_URL}/api/orders?filters[orderStatus][$eq]=served&filters[createdAt][$gte]=${start}&filters[createdAt][$lt]=${end}&populate=order_rows`,
        {
          method: 'GET',
          headers: commonHeaders,
          cache: 'no-store',
        }
      );

      // 3. Fetch Paid Orders for the current "business day" (based on paymentDaytime)
      const paidResponse = await fetch(
        `${STRAPI_URL}/api/orders?filters[orderStatus][$eq]=paid&filters[paymentDaytime][$gte]=${start}&filters[paymentDaytime][$lt]=${end}&populate=order_rows`,
        {
          method: 'GET',
          headers: commonHeaders,
          cache: 'no-store',
        }
      );

      const responses = [pendingResponse, servedResponse, paidResponse];
      let anyError = false;

      for (const response of responses) {
        if (!response.ok) {
          anyError = true;
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('jwt');
            setIsAuthenticated(false);
            setFetchError("Session expired or unauthorized. Please log in again.");
          } else {
            const errorData = await response.json();
            console.error(`Failed to fetch orders: ${response.status} ${response.statusText}`, errorData);
            setFetchError(errorData.error?.message || `Error fetching orders: ${response.status}`);
          }
          if (!isAuthenticated) break;
        }
      }

      if (!anyError && isAuthenticated) {
        const [pendingData, servedData, paidData] = await Promise.all(
          responses.map(res => res.ok ? res.json() : Promise.resolve({ data: [] }))
        );

        const processOrders = (items: any[]): Order[] => {
          return items.map((item: any) => ({
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
              order_doc_id: item.documentId,
            })) : [],
          }));
        };

        setPendingOrders(processOrders(pendingData.data));
        setServedOrders(processOrders(servedData.data));
        setTodayPaidOrders(processOrders(paidData.data));
        setFetchError(null);
      } else {
        setPendingOrders([]);
        setServedOrders([]);
        setTodayPaidOrders([]);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      setFetchError("Network error or server unavailable.");
      setPendingOrders([]);
      setServedOrders([]);
      setTodayPaidOrders([]);
    } finally {
      if (isAuthenticated) {
        setIsLoading(false);
      }
    }
  }, [STRAPI_URL, isAuthenticated]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const initialAndIntervalFetch = async () => {
      if (pendingOrders.length === 0 && servedOrders.length === 0 && todayPaidOrders.length === 0 && !fetchError) {
        setIsLoading(true);
      }
      await fetchFilteredOrders();
      setIsLoading(false);
    };

    initialAndIntervalFetch();
    intervalId = setInterval(() => {
      console.log('Fetching filtered orders...');
      fetchFilteredOrders();
    }, 5000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchFilteredOrders, fetchError, pendingOrders.length, servedOrders.length, todayPaidOrders.length]);

  async function getOrderData(orderDocId: string): Promise<Order | null> {
    try {
      const orderResponse = await fetch(`${STRAPI_URL}/api/orders/${orderDocId}?populate=*`, {
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
        `${STRAPI_URL}/api/order-rows?filters[order_doc_id][$eq]=${actualOrderDocId}&populate=*`,
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
        const catResponse = await fetch(`${STRAPI_URL}/api/categories/${e.category_doc_id}?populate=*`, {
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
      if (foodItems.length > 0 && foodItems.every((item: any) => item.status === 'served')) {
        foodDataInfo.allFoodIsCooked = true;
      }
      return foodDataInfo;
    }
    return null;
  }

  const getOrderFoodInfo = useCallback((order: Order): void => {
    if (order.documentId && foodDataMap[order.documentId]) {
      return;
    }

    getOrderData(order.documentId!).then((orderData) => {
      if (orderData) {
        getFoodOrderData(orderData.order_rows).then((foodOrderData) => {
          if (foodOrderData) {
            const processed = ProcessFoodData(foodOrderData);
            if (processed) {
              setFoodDataMap(prevMap => ({
                ...prevMap,
                [order.documentId!]: processed
              }));
            } else {
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
  }, [foodDataMap, STRAPI_URL]);

  useEffect(() => {
    pendingOrders.forEach(order => {
      getOrderFoodInfo(order);
    });
  }, [pendingOrders, getOrderFoodInfo]);

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
        <p className="text-primary font-bold text-center capitalize">{userName}</p>
      </div>
      <div className="flex gap-x-2">
        <Button asChild size="lg" className="px-2">
          <Link href="/new-order">New Order</Link>
        </Button>
        <LogoutButton />
      </div>
    </div>

    <h1 className="text-3xl sm:text-4xl font-bold mb-2 lg:mb-8 text-primary">Current Orders</h1>

    {fetchError && (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6 w-full max-w-6xl" role="alert">
        <strong className="font-bold">Loading Error: </strong>
        <span className="block sm:inline">{fetchError}</span>
        <p className="text-sm mt-2">Please, try reloading the page or logging in again.</p>
      </div>
    )}

    <div className="flex w-full max-w-6xl gap-2 lg:gap-8 flex-col md:flex-row">
      {/* Pending Orders Section */}
      <div className="flex flex-col items-center flex-1 p-4 bg-card rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-orange-500">Pending Orders</h2>
        {pendingOrders.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {pendingOrders.map((order) => (
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
              <OrderCard key={order.documentId} order={order} foodData={undefined} />
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No served orders yet.</p>
        )}
      </div>
    </div>

    {/* Today's Paid Orders Section */}
    <div className="w-full max-w-6xl mt-2 lg:mt-8 p-4 bg-card rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-blue-500 text-center">Today's Paid Orders</h2>
      {todayPaidOrders.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 w-full">
          {todayPaidOrders.map((order) => (
            <OrderCard key={order.documentId} order={order} foodData={undefined} />
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-center">No paid orders today yet.</p>
      )}
    </div>
  </main>);
}