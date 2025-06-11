// File: /app/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';
import { Order } from "@/types";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL;

  // Questa funzione fetcherà gli ordini.
  // Resa useCallback per ottimizzazione e per essere usata nell'intervallo.
  const fetchOrders = useCallback(async () => {
    // Non impostiamo isLoading a true qui, per evitare che l'interfaccia "lampeggi"
    // ad ogni refresh automatico. isLoading verrà gestito solo al primo caricamento.
    const jwt = localStorage.getItem('jwt');

    setUserName(localStorage.getItem('username') ?? 'Unidentified User');

    if (!jwt) {
      setIsAuthenticated(false);
      setIsLoading(false); // Imposta a false solo se non autenticato all'inizio
      return;
    }

    setIsAuthenticated(true); // Se c'è JWT, consideriamo autenticato per provare il fetch

    try {
      const response = await fetch(`${STRAPI_URL}/api/orders`, {
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
          setFetchError("Sessione scaduta o non autorizzata. Effettua nuovamente il login.");
        } else {
          const errorData = await response.json();
          console.error(`Failed to fetch orders: ${response.status} ${response.statusText}`, errorData);
          setFetchError(errorData.error?.message || `Errore nel recupero degli ordini: ${response.status}`);
        }
        setOrders([]);
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
        setFetchError(null); // Resetta l'errore se il fetch ha successo
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      setFetchError("Errore di rete o server non disponibile.");
      setOrders([]);
    } finally {
      // Imposta isLoading a false solo dopo il primo fetch riuscito o fallito
      // Se l'utente non è autenticato, isLoading è già false da prima del fetch.
      if (isAuthenticated) { // Assicurati di non cambiare isLoading se l'utente è stato deautenticato
         setIsLoading(false);
      }
    }
  }, [STRAPI_URL, isAuthenticated]); // Aggiunto isAuthenticated come dipendenza

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // Funzione per il primo caricamento e per l'intervallo
    const initialAndIntervalFetch = async () => {
      // Solo per il primo caricamento, mostra lo spinner di caricamento
      // Dopo il primo fetch, isLoading non verrà più impostato a true dall'intervallo
      if (orders.length === 0 && !fetchError) { // Se non ci sono ordini e nessun errore iniziale
        setIsLoading(true);
      }
      await fetchOrders(); // Esegui la funzione di fetch
      setIsLoading(false); // Assicurati che isLoading sia false dopo il primo fetch
    };

    initialAndIntervalFetch(); // Esegui subito al mount del componente

    // Imposta l'intervallo per i fetch successivi
    intervalId = setInterval(() => {
      console.log('Fetching orders...'); // Per vedere in console che sta riprovando
      fetchOrders();
    }, 5000); // Ogni 5 secondi

    // Cleanup: importante per prevenire memory leak e chiamate dopo l'unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchOrders, fetchError, orders.length]); // Aggiunte dipendenze per l'initial fetch
                                               // fetchError e orders.length per gestire meglio isLoading

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

  const formatMinutes = (minutes: number): string => {
    return minutes < 10 ? `0${minutes}` : minutes.toString();
  };

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
          <p className="text-primary font-bold text-center capitalize pt-4">{userName}</p>
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
                    <p className="text-sm text-gray-600">Created: <span className="font-semibold text-orange-600">{`${new Date(order.createdAt).getHours()}:${formatMinutes(new Date(order.createdAt).getMinutes())}`}</span></p>
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
                    <p className="text-sm text-gray-600">Created: <span className="font-semibold text-green-600">{`${new Date(order.createdAt).getHours()}:${formatMinutes(new Date(order.createdAt).getMinutes())}`}</span></p>
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