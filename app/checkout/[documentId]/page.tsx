"use client"; // Questa direttiva marca il componente come client component

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation'; // Importa useParams per i client components
import OrderCheckoutWrapper from '@/components/OrderCheckoutWrapper'; // Importa il nuovo client component

// Definisci le tue interfacce esistenti: Product, OrderRow, CustomerInfo, Order, Category, Product
type OrderRowStatus = 'pending' | 'served' | 'paid' | 'cancelled';

interface Product {
    id: number;
    documentId?: string; // Opzionale per consistenza con OrderRow
    name: string;
    price: number;
    vat?: number; // Aggiunto per consistenza con modale e calcoli
    description?: string;
    imageUrl?: string
}

interface OrderRow { // From page.tsx
    id: number;
    documentId: string; // Added for clarity
    quantity: number;
    subtotal: number;
    taxesSubtotal: number;
    category_doc_id?: string; // Optional for consistency with OrderRow
    product_doc_id?: string; // Changed to productId for clarity
    order_doc_id?: string;
    product?: Product;
    createdAt: string;
    orderRowStatus?: OrderRowStatus;
    updatedAt: string // Added for clarity
}

interface CustomerInfo {
    id: number;
    name: string;
    email?: string;
}

interface Order {
    id: number;
    orderStatus?: string;
    documentId?: string; // Aggiunto per chiarezza
    tableName?: string;
    customerName?: string;
    customer?: CustomerInfo;
    createdAt: string;
    order_rows: OrderRow[];
}

/**
 * Recupera i dati dell'ordine e le relative righe d'ordine e dettagli del prodotto dall'API Strapi.
 * @param orderDocId L'ID del documento dell'ordine da recuperare.
 * @returns Una Promise che si risolve in un oggetto Order o null se non trovato/errore.
 */
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
        let fetchedOrderRows: OrderRow[] = [];
        if (orderRowsResponseData.data && Array.isArray(orderRowsResponseData.data)) {
            fetchedOrderRows = await Promise.all(orderRowsResponseData.data.map(async (item: any) => {
                const rowAttributes = item; // Rimosso .attributes

                let product: Product | undefined = undefined;
                if (rowAttributes.product_doc_id) {
                    try {
                        const productRes = await fetch(
                            `${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/products/${rowAttributes.product_doc_id}?populate=*`,
                            { cache: 'no-store' }
                        );
                        if (productRes.ok) {
                            const productData = await productRes.json();
                            if (productData.data) {
                                product = {
                                    id: productData.data.id,
                                    documentId: productData.data.documentId,
                                    name: productData.data.name,
                                    price: productData.data.price,
                                    vat: productData.data.vat,
                                    description: productData.data.description,
                                    imageUrl: productData.data.image?.formats?.thumbnail?.url
                                };


                                const row: OrderRow = {
                                    id: item.id,
                                    documentId: rowAttributes.documentId || item.id.toString(),
                                    quantity: rowAttributes.quantity,
                                    subtotal: parseFloat(rowAttributes.subtotal) || 0,
                                    taxesSubtotal: parseFloat(rowAttributes.taxesSubtotal) || 0,
                                    product_doc_id: rowAttributes.product_doc_id, // Rimosso .data
                                    order_doc_id: rowAttributes.order_doc_id,
                                    category_doc_id: rowAttributes.category_doc_id, // Rimosso .data
                                    createdAt: rowAttributes.createdAt,
                                    orderRowStatus: rowAttributes.orderRowStatus,
                                    product: product, 
                                    updatedAt: rowAttributes.updatedAt// Aggiunto il prodotto recuperato

                                };
                                return row;
                            }
                        }
                    } catch (err) {
                        console.error("Error fetching product:", err);
                    }
                }


            }));
        }

        // Restituisce l'oggetto ordine costruito
        return {
            id: orderResponseData.data.id, // Usa l'ID effettivo da Strapi
            documentId: actualOrderDocId,
            ...fetchedOrderAttributes,
            order_rows: fetchedOrderRows,
        } as Order;

    } catch (err: any) {
        console.error("Error in getOrderData:", err);
        return null;
    }
}

export default function OrderDetailPage() {
    const params = useParams(); // Usa l'hook useParams per ottenere i parametri di rotta
    const orderIdFromUrl = params.documentId as string; // Asserisci il tipo se sei sicuro

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!orderIdFromUrl) {
                setError("ID Order not provided in URL");
                setLoading(false);
                return;
            }

            try {
                // Recupera ordine e categorie in parallelo
                const [fetchedOrder] = await Promise.all([
                    getOrderData(orderIdFromUrl),
                ]);

                if (!fetchedOrder) {
                    setError(`Order ${orderIdFromUrl} not found`);
                }
                setOrder(fetchedOrder);
            } catch (err: any) {
                console.error("Error fetching data:", err);
                setError("Error fetching order details. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [orderIdFromUrl]); // Riesegui l'effetto se orderIdFromUrl cambia

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-lg ">Loading details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-700 p-4 rounded-md">
                <p className="text-lg">{error}</p>
            </div>
        );
    }

    // Se l'ordine è null dopo il caricamento e nessun errore, significa che non è stato trovato
    if (!order) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-yellow-100 text-yellow-700 p-4 rounded-md">
                <p className="text-lg">Order {orderIdFromUrl} not found</p>
            </div>
        );
    }

    // Passa l'ordine e le categorie al componente wrapper client
    return <OrderCheckoutWrapper initialOrder={order} />;
}