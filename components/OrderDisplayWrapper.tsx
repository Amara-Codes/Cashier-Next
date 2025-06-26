// File: /app/order/[documentId]/OrderDisplayWrapper.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Image from "next/image";
import Link from "next/link";
import { Order, Product } from '@/types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import OrderRowDisplay from '@/components/OrderRowDisplay'; // Adjust path as necessary
import { Button } from "@/components/ui/button";
import { Category } from '@/types';


// For the modal's createdOrder prop
interface CreatedOrderInfo {
    id: number;
    documentId?: string;
    customerName: string; // Still needed for the modal's prop
    tableName: string;
    orderStatus?: string;
    createdByUserName?: string
}


interface OrderDisplayWrapperProps {
    initialOrder: Order;
    categories: Category[]; // Categories fetched from server
}

export default function OrderDisplayWrapper({ initialOrder, categories }: OrderDisplayWrapperProps) {
    const [order, setOrder] = useState<Order>(initialOrder);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userName, setUserName] = useState('')


    useEffect(() => {
        setUserName(localStorage.getItem('username') ?? 'Unidentified User');
        setOrder(initialOrder);
    }, [initialOrder]); // Update state if props change (e.g., after router.refresh)

    // NEW useEffect for managing order status based on order_rows
    useEffect(() => {
        // Only proceed if there are order rows or if there were rows that are now all cancelled
        if (order.order_rows && order.orderStatus !== 'merged') {
            const nonCancelledRows = order.order_rows.filter(row => row.orderRowStatus !== 'cancelled');
            const allRowsCancelled = order.order_rows.length > 0 && order.order_rows.every(row => row.orderRowStatus === 'cancelled');

            const allNonCancelledRowsPaid = nonCancelledRows.length > 0 && nonCancelledRows.every(
                (row) => row.orderRowStatus === 'paid'
            );
            // "All served" means all non-cancelled rows are either 'served' or 'paid'
            const allNonCancelledRowsServed = nonCancelledRows.length > 0 && nonCancelledRows.every(
                (row) => row.orderRowStatus === 'served' || row.orderRowStatus === 'paid'
            );
            const anyNonCancelledRowIsPending = nonCancelledRows.some(
                (row) => row.orderRowStatus === 'pending'
            );

            console.log("Checking order rows for status changes (current order status:", order.orderStatus, "):", order.order_rows);
            console.log({ allRowsCancelled, allNonCancelledRowsPaid, allNonCancelledRowsServed, anyNonCancelledRowIsPending });

            let newCalculatedOrderStatus: string | undefined;

            // Prioritize statuses from most "final" to most "initial" for determination
            if (allRowsCancelled) {
                newCalculatedOrderStatus = 'cancelled';
            } else if (allNonCancelledRowsPaid) {
                newCalculatedOrderStatus = 'paid';
            } else if (allNonCancelledRowsServed) { // All non-cancelled items are served (or paid)
                newCalculatedOrderStatus = 'served';
            } else if (anyNonCancelledRowIsPending || nonCancelledRows.length === 0) {
                // If there are any pending non-cancelled rows, or if there are no non-cancelled rows at all (e.g., just added an order)
                newCalculatedOrderStatus = 'pending';
            }
            // If nonCancelledRows.length > 0 but no row is pending, served or paid, this implies an error or an intermediate state not covered.
            // For example, if a row exists but its status is something unexpected. In a healthy system, this shouldn't occur.

            console.log("New calculated order status:", newCalculatedOrderStatus);

            if (newCalculatedOrderStatus && newCalculatedOrderStatus !== order.orderStatus) {
                updateOrderStatus(newCalculatedOrderStatus)
            }
        }
        // This covers the initial case of an order with no rows, ensuring it starts as 'pending'

    }, [order.order_rows, order.orderStatus, order.documentId]);


    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    const updateOrderStatus = async (newStatus: string) => {
        try {
            // Ensure no .attributes access here
            const response = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/orders/${order.documentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: {
                        orderStatus: newStatus, // No 'data' wrapper if attributes are flattened
                    }
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error updating order status:", errorData);
                throw new Error(`Failed to update order status: ${errorData.error?.message || response.statusText}`);
            }

            console.log(`Order ${order.id} status updated to: ${newStatus}`);
            setOrder((prevOrder) => ({
                ...prevOrder,
                orderStatus: newStatus as Order['orderStatus'],
            }));

        } catch (error: any) {
            console.error("Error updating order status:", error);
        }
    };


    const handleProductAddToOrder = async (product: Product, quantity: number, orderDocId: string, categoryDocId: string) => {
        if (!product || typeof product.price !== 'number') {
            alert("Selected product is invalid or missing price information.");
            return;
        }

        const rowTotalWithTaxes = product.price * quantity;
        const calculatedTaxes = (product.vat ?? 0) > 0 ? (rowTotalWithTaxes * (product.vat as number)) / (100 + (product.vat as number)) : 0;

        // Ensure no .attributes access here
        const newOrderRowPayload = {
            data: {
                quantity: quantity,
                subtotal: parseFloat(rowTotalWithTaxes.toFixed(2)),
                taxesSubtotal: parseFloat(calculatedTaxes.toFixed(2)),
                order_doc_id: orderDocId,
                product_doc_id: product.documentId,
                category_doc_id: categoryDocId,
                orderRowStatus: 'pending',
                createdByUserName: localStorage.getItem('username') ?? 'Unidentified User',
                updatedByUserName: localStorage.getItem('username') ?? 'Unidentified User'
            }
        };

        try {
            // Ensure no .attributes access here
            const response = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/order-rows`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newOrderRowPayload), // No 'data' wrapper if attributes are flattened
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error:", errorData);
                throw new Error(`Failed to add product to order: ${errorData.error?.message || response.statusText}`);
            }

            handleCloseModal();
            window.location.reload(); // This re-runs the server component's data fetching

        } catch (error: any) {
            console.error("Error adding product to order:", error);
            alert(`An error occurred: ${error.message}`);
        }
    };

    const createdOrderForModal: CreatedOrderInfo = {
        id: order.id,
        documentId: order.documentId,
        customerName: order.customerName || 'N/A', // Removed customer?.name
        tableName: order.tableName || 'N/A',
        orderStatus: order.orderStatus || 'N/A'
    };

    const handlePrintOrder = () => {
        // Implement your printing logic here.
        // This could involve:
        // 1. Opening a new window with a print-friendly view of the order.
        // 2. Using a dedicated printing library (e.g., react-to-print).
        // 3. Triggering the browser's print dialog (window.print()).
        // For a simple print, window.print() is often the easiest.
        console.log("Printing order:", order.documentId);
        window.print(); // Triggers the browser's print dialog
    };

    // Filter out cancelled rows before calculating totals
    const activeOrderRows = order.order_rows.filter(row => row.orderRowStatus !== 'cancelled');

    const grandTotal = activeOrderRows.reduce((sum, row) => sum + row.subtotal, 0);
    const totalTaxesSummedFromRows = activeOrderRows.reduce((sum, row) => sum + row.taxesSubtotal, 0);
    const totalNoTaxes = activeOrderRows.reduce((sum, row) => sum + (row.subtotal - row.taxesSubtotal), 0);

    // Determine if the checkout button should be disabled
    const isCheckoutDisabled = order.orderStatus !== 'served';

    return (

        <main className="flex min-h-screen flex-col items-center px-4 sm:px-8 md:px-24 py-8 bg-background text-foreground">
            <div className='flex items-center justify-between w-full max-w-6xl mt-8 mb-6 print-hided'>
                <div className="logo-container">
                    <Link href="/" passHref>
                        <Image src="/logo.png" alt="Logo" width={80} height={80} className="logo" priority />
                    </Link>
                    <p className="text-primary font-bold text-center capitalize">{userName}</p>
                </div>
                {/* Conditionally render buttons based on order status */}
                {order.orderStatus !== 'paid' ? ( // If NOT paid, show checkout and add product
                    <div className='flex gap-x-2'>
                        {isCheckoutDisabled ? (
                            <Button className='bg-emerald-500 text-white px-2' size="lg" disabled>
                                Checkout
                            </Button>
                        ) : (
                            <Link href={`/checkout/${initialOrder.documentId}`} passHref>
                                <Button className='bg-emerald-500 hover:bg-emerald-800 text-white px-2' size="lg">
                                    Checkout
                                </Button>
                            </Link>
                        )}
                        <Button onClick={handleOpenModal} className="px-2" size="lg">
                            Add Product to Order
                        </Button>
                    </div>
                ) : ( // If PAID, show print button
                    <div className='flex gap-x-2'>
                        <Button onClick={handlePrintOrder} className="bg-blue-500 hover:bg-blue-700 text-white px-2" size="lg">
                            Print Order
                        </Button>
                        {/* You might still want to allow adding products to a paid order for "re-orders" or additions,
                            but typically a "paid" order implies finalization. If you want to keep "Add Product" visible
                            even when paid, move it outside this conditional block. For now, it's only shown if NOT paid. */}
                    </div>
                )}

            </div>


            <div className='my-8 text-center'>

                <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                    Order #{order.id} - {order.customerName || 'Anonymous Customer'}
                </h1>
            </div>

            <div className="w-full max-w-6xl mt-4">
                <h2 className="text-2xl font-semibold mb-3">Order Details:</h2>
                <p><strong>Status:</strong>
                    <span
                        className={
                            order.orderStatus === 'pending'
                                ? 'animate-pulse text-yellow-500 ms-2'
                                : order.orderStatus === 'served'
                                    ? 'text-green-500 ms-2'
                                    : order.orderStatus === 'paid'
                                        ? 'text-blue-500 ms-2'
                                        : order.orderStatus === 'cancelled'
                                            ? 'text-red-500 ms-2'
                                            : 'text-gray-500 ms-2'
                        }
                    >
                        {order.orderStatus || 'N/D'}
                    </span></p>


                <p><strong>Table Name / Table Number:</strong> {order.tableName || 'N/D'}</p>
                <p><strong>Created At:</strong> {new Date(order.createdAt).toLocaleString('it-IT')}</p>
                <h3 className="text-xl font-semibold mt-6 mb-2">Products:</h3>
                {order.order_rows && order.order_rows.length > 0 ? (
                    <ul className="divide-y divide-border">
                        {order.order_rows.map(row => (
                            <div key={row.documentId} className={`py-3 ${row.orderRowStatus === 'cancelled' ? 'opacity-50 line-through bg-gray-100 dark:bg-gray-800' : ''}`}>
                                {/* Pass showingPaidStatus={false} to hide the paid button in order rows */}
                                <OrderRowDisplay key={row.documentId} row={row} showPaidSwitcher={false} showSwitcher={true && order.orderStatus !== 'paid'} />
                            </div>

                        ))}
                    </ul>
                ) : <p>No items in this order yet.</p>}

                {/* Display Totals */}
                {/* Only display totals if there are active (non-cancelled) rows */}
                {activeOrderRows.length > 0 && (
                    <div className="mt-8 pt-4 border-t border-border">
                        <div className="flex justify-between items-center text-lg font-semibold mb-2">
                            <span>Subtotal (excluding taxes):</span>
                            <span>€{totalNoTaxes.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-semibold mb-2">
                            <span>Total Taxes:</span>
                            <span>€{totalTaxesSummedFromRows.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xl font-bold text-primary">
                            <span>Grand Total:</span>
                            <span>€{grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                )}
                {activeOrderRows.length === 0 && order.order_rows.length > 0 && (
                    <div className="mt-8 pt-4 border-t border-border text-center text-gray-500">
                        <p>All items in this order have been cancelled.</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <ProductSelectionModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    categories={categories} // Pass fetched categories
                    createdOrder={createdOrderForModal} // Pass current order info
                    onProductAddToOrder={handleProductAddToOrder}
                />
            )}
        </main>
    );
}