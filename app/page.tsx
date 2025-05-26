// File: /app/page.tsx
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

// Define interfaces for your data structures, consistent with OrderDisplayWrapper.tsx
interface OrderRow {
  id: number;
  documentId: string;
  quantity: number;
  subtotal: number;
  taxesSubtotal: number;
  category_doc_id?: string;
  product_doc_id?: string;
  order_doc_id?: string;
  createdAt: string;
  orderRowStatus?: 'pending' | 'served' | 'paid' | 'cancelled';
}

interface Order {
  id: number;
  documentId: string; // Ensure documentId is present for linking
  orderStatus?: string;
  tableName?: string;
  customerName?: string;
  createdAt: string;
  paymentDaytime?: string; // Add this field to the Order interface
  order_rows: OrderRow[];
}

export default async function Home() {
  const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL;

  let servedOrders: Order[] = [];
  let pendingOrders: Order[] = [];
  let todayPaidOrders: Order[] = []; // New array for today's paid orders

  try {
    const response = await fetch(`${STRAPI_URL}/api/orders`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh data
    });

    if (!response.ok) {
      console.error(`Failed to fetch orders: ${response.status} ${response.statusText}`);
      const errorData = await response.json();
      console.error('Error details:', errorData);
      servedOrders = [];
      pendingOrders = [];
      todayPaidOrders = [];
    } else {
      const { data } = await response.json();
      const allOrders: Order[] = data.map((item: any) => ({
        id: item.id,
        documentId: item.documentId,
        orderStatus: item.orderStatus,
        tableName: item.tableName,
        customerName: item.customerName,
        createdAt: item.createdAt,
        paymentDaytime: item.paymentDaytime, // Map the paymentDaytime field
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
          order_doc_id: row.order_doc_id,
        })) : [],
      }));

      const today = new Date();
      // Set hours, minutes, seconds, and milliseconds to 0 for accurate date comparison
      today.setHours(0, 0, 0, 0);

      servedOrders = allOrders.filter(order => order.orderStatus === 'served');
      pendingOrders = allOrders.filter(order => order.orderStatus === 'pending');

      todayPaidOrders = allOrders.filter(order => {
        if (order.orderStatus === 'paid' && order.paymentDaytime) {
          const paymentDate = new Date(order.paymentDaytime);
          paymentDate.setHours(0, 0, 0, 0); // Normalize to start of day
          return paymentDate.getTime() === today.getTime();
        }
        return false;
      });
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
    servedOrders = [];
    pendingOrders = [];
    todayPaidOrders = [];
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 sm:px-8 md:px-24 py-8 bg-background text-foreground">
      <div className='flex justify-between items-center w-full max-w-5xl mt-8 mb-6'>
        <div className="logo-container">
          <Image
            src="/logo.png"
            alt="Logo"
            width={80}
            height={80}
            className="logo"
            priority
          />
        </div>
        <Button asChild size="lg">
          <Link href="/new-order">New Order</Link>
        </Button>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-primary">Current Orders</h1>

      <div className="flex w-full max-w-6xl gap-8 flex-col md:flex-row">
        {/* Pending Orders Section */}
        <div className="flex flex-col items-center flex-1 p-4 bg-card rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-orange-500">Pending Orders</h2>
          {pendingOrders.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {pendingOrders.map((order) => (
                <Link key={order.documentId} href={`/order/${order.documentId}`} passHref>
                  <div className="p-4 border-2 border-orange-400 rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer animate-vibrate bg-white">
                    <p className="font-bold text-lg text-gray-900">Table: {order.tableName || 'N/A'}</p>
                    <p className="text-orange-400 font-bold text-lg mb-4">{order.customerName}</p>
                    <p className="text-sm text-gray-600">Created: <span className="font-semibold text-orange-600">{`${new Date(order.createdAt).getHours()}:${new Date(order.createdAt).getMinutes()}`}</span></p>
                  </div>
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
                <Link key={order.documentId} href={`/order/${order.documentId}`} passHref>
                  <div className="p-4 border-2 border-solid border-green-400 rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer bg-green-50">
                    <p className="font-bold text-lg text-gray-900">Table: {order.tableName || 'N/A'}</p>
                    <p className="font-bold text-lg text-green-500 mb-4">{order.customerName}</p>
                    <p className="text-sm text-gray-600">Created: <span className="font-semibold text-green-600">{`${new Date(order.createdAt).getHours()}:${new Date(order.createdAt).getMinutes()}`}</span></p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No served orders yet.</p>
          )}
        </div>
      </div>

      ---

      {/* Today's Paid Orders Section */}
      <div className="w-full max-w-6xl mt-8 p-4 bg-card rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-blue-500 text-center">Today's Paid Orders</h2>
        {todayPaidOrders.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 w-full">
            {todayPaidOrders.map((order) => (
              <Link key={order.documentId} href={`/order/${order.documentId}`} passHref>
                <div className=" border-stone-500 border-b-2 mx-4 pb-4">
                  <p className="font-bold text-lg mb-4">{order.customerName}</p>
                  <p className="font-bold text-lg">Table: {order.tableName || 'N/A'}</p>
                  <p className="text-sm text-gray-600">Paid at: <span className="font-semibold text-blue-600">{new Date(order.paymentDaytime!).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span></p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center">No paid orders today yet.</p>
        )}
      </div>
    </main>
  );
}