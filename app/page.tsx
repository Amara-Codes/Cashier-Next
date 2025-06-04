// File: /app/page.tsx
'use client'; // <-- QUESTO È ESSENZIALE PER ACCEDERE A localStorage E USARE GLI HOOKS

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation'; // Per reindirizzare
import { LogoutButton } from '@/components/LogoutButton'; // Assicurati che questo file esista

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

export default function HomePage() { // Rinominato in HomePage per chiarezza, il nome del file 'page.tsx' è ciò che conta
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]); // Stato per tutti gli ordini fetched
  const [fetchError, setFetchError] = useState<string | null>(null);

  const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL;

  useEffect(() => {
    const checkAuthAndFetchOrders = async () => {
      setIsLoading(true);
      const jwt = localStorage.getItem('jwt'); // Recupera il JWT dal localStorage

      if (!jwt) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return; // Non autenticato, ferma qui
      }

      setIsAuthenticated(true); // JWT trovato, proviamo a fetchare i dati

      try {
        const response = await fetch(`${STRAPI_URL}/api/orders`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`, // Includi il JWT qui
          },
          cache: 'no-store', // Assicurati dati freschi
        });

        if (!response.ok) {
          // Se non autorizzato (es. JWT scaduto o invalido), reindirizza al login
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('jwt'); // Rimuovi il JWT non valido
            setIsAuthenticated(false); // Imposta come non autenticato
            setFetchError("Sessione scaduta o non autorizzata. Effettua nuovamente il login.");
          } else {
            const errorData = await response.json();
            console.error(`Failed to fetch orders: ${response.status} ${response.statusText}`, errorData);
            setFetchError(errorData.error?.message || `Errore nel recupero degli ordini: ${response.status}`);
          }
          setOrders([]); // Pulisci gli ordini in caso di errore
        } else {
          const { data } = await response.json();
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
              order_doc_id: row.order_doc_id,
            })) : [],
          }));
          setOrders(allOrders);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        setFetchError("Errore di rete o server non disponibile.");
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndFetchOrders();
  }, []); // Esegui solo una volta al mount del componente

  // Filtra gli ordini dopo che sono stati fetched e sono nello stato 'orders'
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalizza la data di oggi a mezzanotte

  const servedOrders = orders.filter(order => order.orderStatus === 'served');
  const pendingOrders = orders.filter(order => order.orderStatus === 'pending');
  const todayPaidOrders = orders.filter(order => {
    if (order.orderStatus === 'paid' && order.paymentDaytime) {
      const paymentDate = new Date(order.paymentDaytime);
      paymentDate.setHours(0, 0, 0, 0); // Normalizza la data di pagamento a mezzanotte
      return paymentDate.getTime() === today.getTime();
    }
    return false;
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <p className="text-xl">Caricamento ordini...</p>
        {/* Puoi aggiungere uno spinner o un'icona di caricamento qui */}
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-primary">Access Required</h1>
        {fetchError && <p className="text-red-500 mb-4">{fetchError}</p>}
        <p className="text-lg text-gray-700 mb-8">You must be logged in to view the orders.</p>
        <Button asChild size="lg">
          <Link href="/login">Login</Link>
        </Button>
      </main>
    );
  }

  // Questo è il contenuto che viene mostrato SOLO se isAuthenticated è true
  return (
    <main className="flex min-h-screen flex-col items-center px-4 sm:px-8 md:px-24 py-8 bg-background text-foreground">
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
        </div>
        <div className="flex gap-x-2">
          <Button asChild size="lg" className="px-2">
            <Link href="/new-order">New Order</Link>
          </Button>
          <LogoutButton /> {/* Bottone Logout */}
        </div>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-primary">Current Orders</h1>

      {/* Mostra errori di fetch anche se l'utente è autenticato (es. token scaduto dopo un po') */}
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