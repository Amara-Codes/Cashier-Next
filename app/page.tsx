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
export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [foodData, setFoodData] = useState<any[]>([]);
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
    // Function for the first load and for the interval
    const initialAndIntervalFetch = async () => {
      if (orders.length === 0 && !fetchError) {
        setIsLoading(true);
      }
      await fetchOrders();
      setIsLoading(false);
      // After the fetch, check and update pending orders count for sound notification
    };
    initialAndIntervalFetch(); // Run immediately on component mount
    // Set up the interval for subsequent fetches
    intervalId = setInterval(() => {
      console.log('Fetching orders...');
      fetchOrders();
    }, 5000); // Every 5 seconds
    // Cleanup: important to prevent memory leaks and calls after unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchOrders, fetchError, orders.length]);
  // Filter orders after they have been fetched and are in the 'orders' state
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today's date to midnight
  const isToday = (dateString: string): boolean => {
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  };



  async function getOrderData(orderDocId: string): Promise<Order | null> {
    try {
      // Recupera i dati principali dell'ordine
      const orderResponse = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/orders/${orderDocId}?populate=*`, {
        cache: 'no-store',
      });

      if (!orderResponse.ok) {
        if (orderResponse.status === 404) {
          console.warn(`Order with documnetId  ${orderDocId} not found.`);
          return null;
        }
        throw new Error(`Error feching order data: ${orderResponse.status} ${orderResponse.statusText}`);
      }
      const orderResponseData = await orderResponse.json();

      // Controlla se i dati e l'ID del documento sono presenti nella risposta
      if (!orderResponseData.data) { // Rimosso .attributes
        console.warn("Missing order data in response");
        return null;
      }

      const actualOrderDocId = orderResponseData.data.documentId || orderDocId; // Rimosso .attributes
      const fetchedOrderAttributes: Partial<Omit<Order, 'id' | 'order_rows'>> = {
        orderStatus: orderResponseData.data.orderStatus, // Rimosso .attributes
        tableName: orderResponseData.data.tableName, // Rimosso .attributes
        customerName: orderResponseData.data.customerName, // Rimosso .attributes
        createdAt: orderResponseData.data.createdAt, // Rimosso .attributes
        documentId: actualOrderDocId,
      };

      // Recupera le righe d'ordine con i dati del prodotto popolati
      // Assumendo che le righe d'ordine siano collegate a un ordine tramite orderDocId o ID dell'ordine
      const orderRowsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/order-rows?filters[order_doc_id][$eq]=${actualOrderDocId}&populate=*`,
        { cache: 'no-store' }
      );

      if (!orderRowsResponse.ok) {
        throw new Error(`Error fetching order rows: ${orderRowsResponse.status} ${orderRowsResponse.statusText}`);
      }
      const orderRowsResponseData = await orderRowsResponse.json();

      return {
        id: orderResponseData.data.id, // Usa l'ID effettivo da Strapi
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


  const getOrderFoodInfo = (order: Order): any => {
    getOrderData(order.documentId!).then((orderData) => {
      if (orderData) {

        getFoodOrderData(orderData.order_rows).then((foodOrderData) => {
          if (foodOrderData) {
            setFoodData(ProcessFoodData(foodOrderData) ? [ProcessFoodData(foodOrderData)] : []);
          }
        });
      }
    });
  }


  const ProcessFoodData = (foodData: any) => {
    let foodDataInfo = { 'hasFoodToCook': false, 'allFoodIsCoocked': false };
    if (foodData && foodData.length > 0) {
      //  
      for (const item of foodData) {
        if (item.isFood === true && item.status === 'pending') {
          foodDataInfo.hasFoodToCook = true;
          break;
        }
      }

      const foodItems = foodData.filter((item: any) => item.isFood === true);
      if (foodItems.every((item: any) => item.status === 'served')) {
        foodDataInfo.allFoodIsCoocked = true;
      }
      return foodDataInfo;
    }
  }
  // Apply the 'isToday' filter to served and pending orders
  const servedOrders = orders.filter(order => order.orderStatus === 'served' && isToday(order.createdAt));
  const pendingOrders = orders.filter(order => order.orderStatus === 'pending' && isToday(order.createdAt));

  pendingOrders.forEach(order => {
    getOrderFoodInfo(order)
  });
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
  // This is the content shown ONLY if isAuthenticated is true
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
        <LogoutButton /> {/* Logout Button */}
      </div>
    </div>

    <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-primary">Current Orders</h1>

    {/* Show fetch errors even if the user is authenticated (e.g., token expired after a while) */}
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
              <Link key={order.documentId} href={`/order/${order.documentId}`} passHref legacyBehavior>
                <a className="block p-4 border-2 border-orange-400 rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer animate-vibrate bg-white">
                  {foodData.length > 0 && foodData[0].hasFoodToCook && (
                    <div className="flex justify-end">
   <audio  src="/notification.mp3" autoPlay/> 
                      <svg fill="#000000" height="40" width="40" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 513.164 513.164" xmlSpace="preserve">
                        <g>
                          <g>
                            <circle cx="221.673" cy="175.709" r="11.636" />
                          </g>
                        </g>
                        <g>
                          <g>
                            <circle cx="291.491" cy="175.709" r="11.636" />
                          </g>
                        </g>
                        <g>
                          <g>
                            <circle cx="210.036" cy="396.8" r="11.636" />
                          </g>
                        </g>
                        <g>
                          <g>
                            <circle cx="303.127" cy="396.8" r="11.636" />
                          </g>
                        </g>
                        <g>
                          <g>
                            <circle cx="210.036" cy="443.345" r="11.636" />
                          </g>
                        </g>
                        <g>
                          <g>
                            <circle cx="303.127" cy="443.345" r="11.636" />
                          </g>
                        </g>
                        <g>
                          <g>
                            <path d="M268.218,222.255h-23.273c-6.982,0-11.636,4.655-11.636,11.636s4.655,11.636,11.636,11.636h23.273
			c6.982,0,11.636-4.655,11.636-11.636S275.2,222.255,268.218,222.255z"/>
                          </g>
                        </g>
                        <g>
                          <g>
                            <path d="M407.855,343.273l-79.127-16.291c-5.818-1.164-12.8,2.327-13.964,9.309c-1.164,5.818,2.327,12.8,9.309,13.964
			l79.127,16.291c16.291,3.491,27.927,17.455,27.927,33.745v77.964c0,6.982-4.655,11.636-11.636,11.636H93.673
			c-6.982,0-11.636-4.655-11.636-11.636v-77.964c0-16.291,11.636-31.418,27.927-33.745l77.964-15.127h91.927
			c6.982,0,11.636-4.655,11.636-11.636c0-6.982-4.655-11.636-11.636-11.636h-93.091c-1.164,0-1.164,0-2.327,0l-79.127,15.127
			c-26.764,5.818-46.545,29.091-46.545,57.018v77.964c0,19.782,15.127,34.909,34.909,34.909h325.818
			c19.782,0,34.909-15.127,34.909-34.909v-77.964C454.4,372.364,434.618,347.927,407.855,343.273z"/>
                          </g>
                        </g>
                        <g>
                          <g>
                            <path d="M358.982,152.436c-6.982-1.164-11.636,3.491-12.8,10.473c-2.327,20.945-5.818,43.055-5.818,43.055
			c-1.164,15.127-8.146,29.091-17.455,40.727l-2.327,3.491c-15.127,19.782-38.4,30.255-64,30.255c-25.6,0-48.873-10.473-64-30.255
			l-2.327-3.491c-9.309-11.636-16.291-25.6-17.455-41.891c0,0-9.309-54.691-9.309-76.8V98.909c0-4.655-2.327-8.146-5.818-10.473
			c-10.473-4.655-17.455-16.291-17.455-29.091c0-19.782,15.127-34.909,34.909-34.909c6.982,0,11.636-4.655,11.636-11.636
			s-4.655-11.636-11.636-11.636c-32.582,0-58.182,25.6-58.182,58.182c0,18.618,9.309,36.073,23.273,46.545v23.273
			c0,23.273,8.145,77.964,9.309,79.127c2.327,19.782,10.473,38.4,22.109,53.527l2.327,3.491c19.782,24.436,50.036,38.4,82.618,38.4
			c32.582,0,61.673-13.964,82.618-38.4l2.327-3.491c12.8-15.127,19.782-33.745,22.109-52.364c0,0,3.491-22.109,5.818-44.218
			C370.618,159.418,365.964,153.6,358.982,152.436z"/>
                          </g>
                        </g>
                        <g>
                          <g>
                            <path d="M256.582,1.164c-32.582,0-58.182,25.6-58.182,58.182c0,6.982,4.655,11.636,11.636,11.636
			c6.982,0,11.636-4.655,11.636-11.636c0-19.782,15.127-34.909,34.909-34.909c6.982,0,11.636-4.655,11.636-11.636
			S263.564,1.164,256.582,1.164z"/>
                          </g>
                        </g>
                        <g>
                          <g>
                            <path d="M338.036,0c-20.945,0-40.727,11.636-51.2,30.255c-4.655,10.473-6.982,19.782-6.982,29.091
			c0,6.982,4.655,11.636,11.636,11.636s11.636-4.655,11.636-11.636c0-5.818,1.164-11.636,4.655-16.291
			c5.818-11.636,17.455-18.618,30.255-18.618c19.782,0,34.909,15.127,34.909,34.909c0,12.8-6.982,24.436-17.455,30.255
			c-3.491,2.327-5.818,5.818-5.818,10.473v19.782c-48.873,10.473-108.218,11.636-161.745,4.655
			c-5.818-1.164-11.636,3.491-12.8,9.309s3.491,12.8,9.309,12.8c23.273,3.491,46.545,4.655,70.982,4.655
			c37.236,0,75.636-3.491,108.218-11.636c4.655-1.164,9.309-5.818,9.309-11.636v-23.273c13.964-10.473,23.273-27.927,23.273-46.545
			C396.218,25.6,370.618,0,338.036,0z"/>
                          </g>
                        </g>
                      </svg>
                    </div>
                  )}
                  {foodData.length > 0 && foodData[0].allFoodIsCoocked && (

                    <div className="flex justify-end">
   <audio  src="/ready.mp3" autoPlay/> 
                      <svg fill="#000000" height="40" width="40" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 512 512" xmlSpace="preserve">
                        <g>
                          <g>
                            <path d="M503.83,388.085H8.17c-4.513,0-8.17,3.657-8.17,8.17s3.657,8.17,8.17,8.17h25.333c3.795,18.624,20.3,32.681,40.029,32.681
			h364.936c19.728,0,36.233-14.057,40.029-32.681h25.333c4.513,0,8.17-3.657,8.17-8.17S508.343,388.085,503.83,388.085z
			 M438.468,420.766H73.532c-10.651,0-19.733-6.831-23.105-16.34h411.147C458.201,413.935,449.119,420.766,438.468,420.766z"/>
                          </g>
                        </g>
                        <g>
                          <g>
                            <circle cx="156.868" cy="232.851" r="8.17" />
                          </g>
                        </g>
                        <g>
                          <g>
                            <circle cx="124.187" cy="265.532" r="8.17" />
                          </g>
                        </g>
                        <g>
                          <g>
                            <path d="M264.17,140.421v-16.506h24.511c4.513,0,8.17-3.657,8.17-8.17c0-22.526-18.325-40.851-40.851-40.851
			s-40.851,18.325-40.851,40.851c0,4.513,3.657,8.17,8.17,8.17s8.17-3.657,8.17-8.17c0-13.515,10.996-24.511,24.511-24.511
			c10.652,0,19.738,6.83,23.111,16.34H256c-4.513,0-8.17,3.657-8.17,8.17v24.676C128.463,144.737,32.681,243.173,32.681,363.574
			c0,4.513,3.657,8.17,8.17,8.17s8.17-3.657,8.17-8.17c0-114.129,92.85-206.979,206.979-206.979s206.979,92.85,206.979,206.979
			c0,4.513,3.657,8.17,8.17,8.17s8.17-3.657,8.17-8.17C479.319,243.173,383.537,144.737,264.17,140.421z"/>
                          </g>
                        </g>
                      </svg>
                    </div>
                  )}


                  <p className="font-bold text-lg text-gray-900">Table: {order.tableName || 'N/A'}</p>
                  <p className="text-orange-400 font-bold text-lg mb-4">{order.customerName}</p>
                  <p className="text-sm text-gray-600">Created: <span className="font-semibold text-orange-600">{`${new Date(order.createdAt).getHours()}:${formatMinutes(new Date(order.createdAt).getMinutes())}`}</span></p>
                </a>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No pending orders at the moment.</p>
        )}
      </div>

      {/* Horizontal Line (optional, for visual separation on larger screens) */}
      <div className="hidden md:block w-px bg-gray-300"></div>

      {/* Served Orders Section */}
      <div className="flex flex-col items-center flex-1 p-4 bg-card rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-green-500">Served Orders</h2>
        {servedOrders.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            {servedOrders.map((order) => (
              <Link key={order.documentId} href={`/order/${order.documentId}`} passHref legacyBehavior>
                <a className="block p-4 border-2 border-solid border-green-400 rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer bg-green-50">
                  <p className="font-bold text-lg text-gray-900">Table: {order.tableName || 'N/A'}</p>
                  <p className="font-bold text-lg text-green-500 mb-4">{order.customerName}</p>
                  <p className="text-sm text-gray-600">Created: <span className="font-semibold text-green-600">{`${new Date(order.createdAt).getHours()}:${formatMinutes(new Date(order.createdAt).getMinutes())}`}</span></p>
                </a>
              </Link>
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
            <Link key={order.documentId} href={`/order/${order.documentId}`} passHref legacyBehavior>
              <a className="block border-stone-500 border-b-2 mx-4 pb-4">
                <p className="font-bold text-lg mb-4">{order.customerName}</p>
                <p className="font-bold text-lg">Table: {order.tableName || 'N/A'}</p>
                <p className="text-sm text-gray-600">Paid at: <span className="font-semibold text-blue-600">{new Date(order.paymentDaytime!).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span></p>
              </a>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-center">No paid orders today yet.</p>
      )}
    </div>
  </main>);
}