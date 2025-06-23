// components/OrderCheckoutWrapper.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from "next/image";
import Link from "next/link";
import OrderRowDisplay from '@/components/OrderRowDisplay'; // Adjust path as necessary
import { Button } from "@/components/ui/button";
import { CustomDiscountModal } from '@/components/CustomDiscountModal';
import { PaymentModal } from '@/components/PaymentModal'; // Import the new modal component
import MergeOrderModal from '@/components/MergeOrderModal'; // Import the MergeOrderModal

// Import interfaces from the centralized types file
import { Order, OrderRow, Product, Category } from '@/types';

interface OrderCheckoutWrapperProps {
    initialOrder: Order;
    // Callback to signal OrderDetailPage that a merge occurred, prompting a full re-fetch
    onOrderMerged: (sourceOrderId: number, sourceOrderDocId: string) => void;
}

// Map to cache fetched category names to avoid redundant API calls
const categoryNameCache = new Map<string, string>();

async function fetchCategoryById(categoryDocId: string): Promise<Category | null> {
    if (!categoryDocId) {
        console.warn("fetchCategoryById: categoryId is null or undefined, skipping fetch.");
        return null;
    }

    // Check cache first
    if (categoryNameCache.has(categoryDocId)) {
        return { id: 0, name: categoryNameCache.get(categoryDocId)! };
    }

    try {
        console.log(`Fetching category for ID: ${categoryDocId}`);
        const res = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/categories/${categoryDocId}`);

        if (!res.ok) {
            console.error(`HTTP error! Status: ${res.status} for categoryId: ${categoryDocId}`);
            const errorBody = await res.text();
            console.error('Error Response Body:', errorBody);
            throw new Error('Network response was not ok');
        }

        const data = await res.json();
        console.log("Raw category fetch response data:", data);

        if (data?.data && typeof data.data.name === 'string') {
            const categoryData = data.data;
            console.log(`Category found: ${categoryData.name}`);
            categoryNameCache.set(categoryDocId, categoryData.name);
            return {
                id: categoryData.id,
                documentId: categoryData.documentId,
                name: categoryData.name,
            };
        }

        console.warn(`No category data found for ID: ${categoryDocId} in response or missing 'name' property.`);
        return null;
    } catch (error) {
        console.error(`Failed to fetch category for ID ${categoryDocId}:`, error);
        return null;
    }
}

const RIEL_EXCHANGE_RATE = 4000; // 1 USD = 4000 Riel

export default function OrderCheckoutWrapper({ initialOrder, onOrderMerged }: OrderCheckoutWrapperProps) {
    const [order, setOrder] = useState<Order>(initialOrder);
    const [loading, setLoading] = useState<boolean>(false); // Initialize as false, as initialOrder is already loaded
    const [error, setError] = useState<string | null>(null);
    const [khmerCustomerDiscount, setKhmerCustomerDiscount] = useState<boolean>(false);
    const [cbacMembersDiscount, setCbacMembersDiscount] = useState<boolean>(false);
    const [kandalVillageFriendDiscount, setKandalVillageFriendDiscount] = useState<boolean>(false);
    const [fWBDiscount, setFWBDiscount] = useState<boolean>(false); // New state for FWB Discount

    // New state for custom discount
    const [isCustomDiscountModalOpen, setIsCustomDiscountModalOpen] = useState<boolean>(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
    const [customDiscount, setCustomDiscount] = useState<{ value: number; type: 'dollar' | 'percentage' }>({ value: 0, type: 'dollar' });

    // Calculated totals in USD before custom discount
    const [baseGrandTotalUSD, setBaseGrandTotalUSD] = useState<number>(0); // This is the sum of subtotals (incl. taxes)
    const [calculatedTotalTaxesUSD, setCalculatedTotalTaxesUSD] = useState<number>(0); // Total tax portion for transparency
    const [calculatedTotalNoTaxesUSD, setCalculatedTotalNoTaxesUSD] = useState<number>(0); // Total non-tax portion for transparency

    // Processed order rows for display
    const [processedOrderRows, setProcessedOrderRows] = useState<OrderRow[]>([]);

    const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
    const [userName, setUserName] = useState('')
    // The mergedFromOrderDetails will now be part of the 'order' state itself,
    // so we don't need a separate state here unless we want to cache it.
    // For now, we'll rely on `order.mergedFromOrderId` and `order.mergedFromOrderDocId`.

    useEffect(() => {
        setUserName(localStorage.getItem('username') ?? 'Unidentified User');
        setOrder(initialOrder);
    }, [initialOrder]);

    const applyItemLevelDiscountsToPrice = useCallback(async (originalPrice: number, categoryDocId?: string): Promise<number> => {
        let currentPrice = originalPrice;
        let categoryName: string | undefined;

        if (categoryDocId) {
            if (categoryNameCache.has(categoryDocId)) {
                categoryName = categoryNameCache.get(categoryDocId);
            } else {
                const category = await fetchCategoryById(categoryDocId);
                if (category) {
                    categoryName = category.name;
                    categoryNameCache.set(categoryDocId, category.name);
                }
            }
        }

        // 1. Apply Khmer Customer Discount (Beer specific, fixed prices)
        if (khmerCustomerDiscount && categoryName && categoryName.toLowerCase() === 'beer') {
            if (currentPrice === 3) {
                currentPrice = 1.75;
            } else if (currentPrice === 5) {
                currentPrice = 3;
            }
        }

        // 2. Apply CBAC Members Discount (Beer specific, $1 off per item)
        if (cbacMembersDiscount && categoryName && categoryName.toLowerCase() === 'beer') {
            currentPrice = Math.max(0, currentPrice - 1);
        }

        // 3. Apply FWB Discount (20% off all beer items) - applied after fixed price/dollar off
        if (fWBDiscount && categoryName && categoryName.toLowerCase() === 'beer') {
            currentPrice = currentPrice * 0.80; // 20% off
        }

        // 4. Apply Kandal Village Friend Discount (15% off all items)
        // This discount applies to the price AFTER any previous specific discounts.
        if (kandalVillageFriendDiscount) {
            currentPrice = currentPrice * 0.85;
        }

        return currentPrice;
    }, [khmerCustomerDiscount, cbacMembersDiscount, fWBDiscount, kandalVillageFriendDiscount]); // Add fWBDiscount to dependencies

    // This useEffect recalculates totals and processes rows whenever relevant state changes
    useEffect(() => {
        const processOrderAndCalculateBaseTotals = async () => {
            const activeRows = order.order_rows.filter(row => row.orderRowStatus !== 'cancelled');
            let tempBaseGrandTotal = 0; // Sum of subtotals (incl. taxes) before custom discount
            let tempCalculatedTotalTaxes = 0; // Sum of tax portions for transparency
            let tempCalculatedTotalNoTaxes = 0; // Sum of non-tax portions for transparency
            const newProcessedRows: OrderRow[] = [];

            for (const row of activeRows) {
                const originalProductPrice = row.product?.price || 0;
                const discountedPricePerUnit = await applyItemLevelDiscountsToPrice(originalProductPrice, row.category_doc_id);
                const vatRate = row.product?.vat && row.product.vat > 0 ? row.product.vat / 100 : 0;
                const newSubtotal = discountedPricePerUnit * row.quantity;
                const taxesForThisRow = vatRate > 0 ? (newSubtotal - (newSubtotal / (1 + vatRate))) : 0;
                const priceWithoutTaxesForThisRow = newSubtotal - taxesForThisRow;

                tempBaseGrandTotal += newSubtotal; // Sum of subtotals (already includes taxes)
                tempCalculatedTotalTaxes += taxesForThisRow;
                tempCalculatedTotalNoTaxes += priceWithoutTaxesForThisRow;

                newProcessedRows.push({
                    ...row,
                    subtotal: newSubtotal, // This subtotal now reflects the discounted price (incl. taxes)
                    taxesSubtotal: taxesForThisRow, // This is the calculated tax portion of the new subtotal
                    product: row.product ? {
                        ...row.product,
                        price: discountedPricePerUnit // This price per unit is now the discounted one (incl. taxes)
                    } : row.product
                });
            }
            setBaseGrandTotalUSD(tempBaseGrandTotal);
            setCalculatedTotalTaxesUSD(tempCalculatedTotalTaxes);
            setCalculatedTotalNoTaxesUSD(tempCalculatedTotalNoTaxes);
            setProcessedOrderRows(newProcessedRows);
            setLoading(false); // Finished initial processing
        };

        processOrderAndCalculateBaseTotals();
    }, [order, khmerCustomerDiscount, cbacMembersDiscount, fWBDiscount, kandalVillageFriendDiscount, applyItemLevelDiscountsToPrice]); // Add fWBDiscount to dependencies

    const activeOrderRowsCount = processedOrderRows.filter(row => row.orderRowStatus !== 'cancelled').length;


    // --- Apply Custom Discount to the final Grand Total ---
    let finalGrandTotalUSD = baseGrandTotalUSD;
    if (customDiscount.value > 0) {
        if (customDiscount.type === 'dollar') {
            finalGrandTotalUSD = Math.max(0, baseGrandTotalUSD - customDiscount.value);
        } else { // percentage
            finalGrandTotalUSD = baseGrandTotalUSD * (1 - (customDiscount.value / 100));
        }
    }

    const refinedGrandTotalUSD = Math.ceil(finalGrandTotalUSD * 10) / 10; // Round up to one decimal place
    const grandTotalRiel = finalGrandTotalUSD * RIEL_EXCHANGE_RATE;
    const refinedGrandTotalRiel = Math.ceil(grandTotalRiel / 100) * 100; // Round to the nearest hundred Riel

    const handleApplyCustomDiscount = (value: number, type: 'dollar' | 'percentage') => {
        setCustomDiscount({ value, type });
    };

    const handlePayment = useCallback(async (totalAmount: number | string, paymentMethod: 'QR' | 'cash') => {
        setLoading(true);
        setError(null);

        try {
            // Update the main order's status to 'paid' and add checkout info
            const appliedDiscountsList: string[] = [];
            if (khmerCustomerDiscount) { appliedDiscountsList.push("Khmer Customer Discount (Beer prices adjusted)"); }
            if (cbacMembersDiscount) { appliedDiscountsList.push("CBAC Members Discount (Beer: -$1 per item)"); }
            if (fWBDiscount) { appliedDiscountsList.push("FWB Discount (Beer: 20% off)"); } // Add FWB discount string
            if (kandalVillageFriendDiscount) { appliedDiscountsList.push("Kandal Village Friend (15% off total order row)"); }
            if (customDiscount.value > 0) {
                const customDiscountText = customDiscount.type === 'dollar'
                    ? `Custom Discount: -$${customDiscount.value.toFixed(2)}`
                    : `Custom Discount: ${customDiscount.value.toFixed(1)}% off`;
                appliedDiscountsList.push(customDiscountText);
            }
            const appliedDiscountString = appliedDiscountsList.length > 0 ? appliedDiscountsList.join("; ") : "No discounts applied";

            const checkoutInfo = {
                paymentMethod: paymentMethod,
                paidAmount: totalAmount,
                paymentDaytime: new Date().toISOString(),
                appliedDiscount: appliedDiscountString,
                orderStatus: 'paid',
                processedByUserName: localStorage.getItem('username') ?? 'Unidentified User'
                // Mark current order as paid
            };

            const updateMainOrderResponse = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/orders/${order.documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: checkoutInfo }),
            });

            if (!updateMainOrderResponse.ok) {
                throw new Error(`Failed to update main order status: ${updateMainOrderResponse.statusText}`);
            }

            // If this order was merged from another, update the status of the source order to 'merged'
            if (order.mergedWithOderDocId?.length) {
                const updateMergedOrderResponse = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/orders/${order.mergedWithOderDocId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: { orderStatus: 'merged' } }), // Mark source order as merged
                });

                if (!updateMergedOrderResponse.ok) {
                    throw new Error(`Failed to update merged order status: ${updateMergedOrderResponse.statusText}`);
                }
            }

            // Update all order rows of the current order to 'paid' status
            await Promise.all(processedOrderRows.map(async (row) => {
                if (row.orderRowStatus !== 'cancelled') { // Only update non-cancelled rows
                    const res = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/order-rows/${row.documentId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: { orderRowStatus: 'paid', updatedByUserName: localStorage.getItem('username') ?? 'Unidentified User' } }),
                    });
                    if (!res.ok) {
                        console.error(`Failed to update order row ${row.documentId} to paid.`);
                    }
                }
            }));


            alert('Payment successful!');
            window.location.href = '/'; // Redirect after full process
        } catch (err: any) {
            console.error("Error during payment:", err);
            setError(`Payment failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [order, processedOrderRows, khmerCustomerDiscount, cbacMembersDiscount, fWBDiscount, kandalVillageFriendDiscount, customDiscount]); // Add fWBDiscount to dependencies





    // Handle merge operation triggered by the modal
    const handleMergeOrders = async (mergedOrderRows: OrderRow[], sourceOrderId: number, sourceOrderDocId: string) => {
        if (!order || !order.documentId) {
            console.error("Current order or its documentId is null, cannot merge.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Create new order rows in Strapi, linked to the current order
            const newOrderRowsToCreate = mergedOrderRows.map(row => ({
                quantity: row.quantity,
                subtotal: row.subtotal, // Use original subtotal/taxes for creation, recalculation will happen
                taxesSubtotal: row.taxesSubtotal,
                product_doc_id: row.product_doc_id,
                order_doc_id: order.documentId, // Link new rows to the current order
                category_doc_id: row.category_doc_id,
                orderRowStatus: 'served', // New rows typically start as pending, but if merging, they are likely served
                createdByUserName: localStorage.getItem('username') ?? 'Unidentified User',
                updatedByUserName: localStorage.getItem('username') ?? 'Unidentified User'
            }));

            const createdRowResponses = await Promise.all(newOrderRowsToCreate.map(async (newRow) => {
                const res = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/order-rows`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: newRow }),
                });
                if (!res.ok) { throw new Error(`Failed to create order row: ${res.statusText}`); }
                return (await res.json()).data;
            }));

            // Fetch the products for the newly created rows to populate their `product` field locally
            const populatedNewRows = await Promise.all(createdRowResponses.map(async (item: any) => {
                let product: Product | undefined = undefined;
                if (item.product_doc_id) {
                    const productRes = await fetch(
                        `${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/products/${item.product_doc_id}`,
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
                        }
                    }
                }
                return {
                    id: item.id,
                    documentId: item.documentId,
                    quantity: item.quantity,
                    subtotal: parseFloat(item.subtotal),
                    taxesSubtotal: parseFloat(item.taxesSubtotal),
                    product_doc_id: item.product_doc_id,
                    order_doc_id: item.order_doc_id,
                    category_doc_id: item.category_doc_id,
                    createdAt: item.createdAt,
                    orderRowStatus: item.orderRowStatus,
                    updatedAt: item.updatedAt,
                    product: product,
                } as OrderRow;
            }));

            // Corrected Merging Logic:
            // 'order' is the current order, and 'sourceOrder' is the order from which items are merged.
            // The source order should be marked as merged and linked to the current order.
            // The current order should be linked to the source order.

            // 1. Update source order
            const updateSourceOrderResponse = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/orders/${sourceOrderDocId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: {
                        orderStatus: 'merged', // Source order is now merged
                        mergedToOrderDocId: order.documentId, // Source order merged into current order
                    }
                }),
            });

            if (!updateSourceOrderResponse.ok) {
                throw new Error(`Failed to update source order with mergedToOrderDocId: ${updateSourceOrderResponse.statusText}`);
            }


            // 2. Update current order
            const updateCurrentOrderResponse = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/orders/${order.documentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: {
                        mergedWithOrderDocId: sourceOrderDocId, // Current order merged with source order
                    }
                }),
            });

            if (!updateCurrentOrderResponse.ok) {
                throw new Error(`Failed to update current order with mergedWithOrderDocId: ${updateCurrentOrderResponse.statusText}`);
            }

            // 4. Update local state of the current order immediately
            setOrder(prevOrder => ({
                ...prevOrder!,
                order_rows: [...prevOrder!.order_rows, ...populatedNewRows],
                mergedWithOrderDocId: sourceOrderDocId, // Update the mergedWithOrderDocId in the current order's state
            }));


            setIsMergeModalOpen(false); // Close the modal
            // Instead of `fetchData()`, we can trigger a reload for full consistency
            window.location.reload(); // Forces a fresh fetch of all data on the page
            onOrderMerged(sourceOrderId, sourceOrderDocId); // Notify parent component

        } catch (err: any) {
            console.error("Error merging orders:", err);
            setError(`Failed to merge orders: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };


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

    return (
        <main className="flex min-h-screen flex-col items-center px-4 sm:px-8 md:px-24 py-8 bg-background text-foreground">
            <div className='flex items-center justify-between w-full max-w-6xl mt-8 mb-6'>
                <div className="logo-container">
                    <Link href="/" passHref>
                        <Image src="/logo.png" alt="Logo" width={80} height={80} className="logo" priority />
                    </Link>
                    <p className="text-primary font-bold text-center capitalize pt-4">{userName}</p>
                </div>
                <div className="flex space-x-4">
                    <Button
                        className='bg-blue-600 text-white px-4'
                        size="lg"
                        onClick={() => setIsMergeModalOpen(true)}
                        disabled={order.orderStatus === 'paid' || order.orderStatus === 'merged'} // Disable if already paid/merged
                    >
                        Merge Order
                    </Button>
                    <Button
                        className='bg-emerald-500 text-white px-4'
                        size="lg"
                        onClick={() => setIsPaymentModalOpen(true)}
                        disabled={activeOrderRowsCount === 0 || order.orderStatus === 'paid'}
                    >
                        Pay
                    </Button>
                </div>
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
                                            : order.orderStatus === 'merged' // Added merged status color
                                                ? 'text-purple-500 ms-2'
                                                : 'text-gray-500 ms-2'
                        }
                    >
                        {order.orderStatus || 'N/A'}
                    </span></p>

                <p><strong>Table Name / Table Number:</strong> {order.tableName || 'N/A'}</p>
                <p><strong>Created At:</strong> {new Date(order.createdAt).toLocaleString('en-US')}</p> {/* Changed to en-US locale */}

                {order.mergedWithOderDocId?.length && (
                    <p className="text-purple-600 font-semibold mt-2">
                        Merged from Order: {order.mergedWithOderDocId}
                    </p>
                )}


                <h3 className="text-xl font-semibold mt-6 mb-2">Products:</h3>
                {processedOrderRows && processedOrderRows.length > 0 ? (
                    <ul className="divide-y divide-border">
                        {processedOrderRows.map(row => (
                            <div key={row.documentId} className={`py-3 ${row.orderRowStatus === 'cancelled' ? 'opacity-50 line-through bg-gray-100 dark:bg-gray-800' : ''}`}>
                                <OrderRowDisplay
                                    key={row.documentId}
                                    row={row}
                                    showPaidSwitcher={true}
                                />
                            </div>
                        ))}
                    </ul>
                ) : <p>No items in this order yet.</p>}

                {/* Discounts Section */}
                <div className="mt-8 pt-4 border-t border-border">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-2xl font-semibold">Discounts:</h2>
                        <Button onClick={() => setIsCustomDiscountModalOpen(true)} className="ml-4">
                            Add Custom Discount
                        </Button>
                    </div>
                    <div className="flex flex-col space-y-2">
                        {/* Khmer Customer Discount */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="khmerCustomer"
                                checked={khmerCustomerDiscount}
                                onChange={(e) => setKhmerCustomerDiscount(e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor="khmerCustomer" className="text-lg font-medium text-foreground">
                                Khmer Customer (Beer: $3 &rarr; $1.75, $5 &rarr; $3)
                            </label>
                        </div>

                        {/* CBAC Members Discount */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="cbacMembers"
                                checked={cbacMembersDiscount}
                                onChange={(e) => setCbacMembersDiscount(e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor="cbacMembers" className="text-lg font-medium text-foreground">
                                CBAC Members (Beer: -$1 per item)
                            </label>
                        </div>

                        {/* FWB Discount */} {/* New Discount Added */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="fWBDiscount"
                                checked={fWBDiscount}
                                onChange={(e) => setFWBDiscount(e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor="fWBDiscount" className="text-lg font-medium text-foreground">
                                FWB Discount (20% off all beers)
                            </label>
                        </div >

                        {/* Kandal Village Friend Discount */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="kandalVillageFriend"
                                checked={kandalVillageFriendDiscount}
                                onChange={(e) => setKandalVillageFriendDiscount(e.target.checked)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                            <label htmlFor="kandalVillageFriend" className="text-lg font-medium text-foreground">
                                Kandal Village Friend (15% off all items)
                            </label>
                        </div >

                        {/* Display current Custom Discount if applied */}
                        {customDiscount.value > 0 && (
                            <div className="flex items-center space-x-2 text-green-600 font-semibold">
                                <span className="text-lg">Custom Discount: </span>
                                <span>
                                    {customDiscount.type === 'dollar'
                                        ? `-$${customDiscount.value.toFixed(2)}`
                                        : `${customDiscount.value.toFixed(1)}% off`
                                    }
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setCustomDiscount({ value: 0, type: 'dollar' })}
                                        className="ml-2 text-red-500 hover:text-red-700"
                                    >
                                        (Clear)
                                    </Button>
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Display Totals */}
                {activeOrderRowsCount > 0 && (
                    <div className="mt-8 pt-4 border-t border-border">
                        <div className="flex justify-between items-center text-lg font-semibold mb-2">
                            <span>Subtotal (Net Price):</span> {/* Display non-tax portion */}
                            <span>${calculatedTotalNoTaxesUSD.toFixed(2)}</span> {/* Changed € to $ */}
                        </div>
                        <div className="flex justify-between items-center text-lg font-semibold mb-2">
                            <span>Total Taxes Included:</span> {/* Display tax portion */}
                            <span>${calculatedTotalTaxesUSD.toFixed(2)}</span> {/* Changed € to $ */}
                        </div>

                        {/* FINAL Grand Total (USD) */}
                        <div className="flex justify-between items-center text-xl font-bold text-primary mb-2">
                            <span>Final Total (USD):</span>
                            <span>${finalGrandTotalUSD.toFixed(2)}</span> {/* Changed € to $ */}
                        </div>

                        {/* Refined Grand Total (USD) */}
                        <div className="flex justify-between items-center text-xl font-bold text-primary mb-2">
                            <span>Refined Final Total (USD):</span>
                            <span>${refinedGrandTotalUSD.toFixed(1)}</span> {/* Changed € to $ */}
                        </div>

                        {/* Grand Total in Riel */}
                        <div className="flex justify-between items-center text-md mb-2">
                            <span>Final Total (KHR):</span>
                            <span>៛{grandTotalRiel.toFixed(0)}</span>
                        </div>

                        {/* Refined Grand Total in Riel */}
                        <div className="flex justify-between items-center text-xl font-bold text-primary">
                            <span>Refined Final Total (KHR):</span>
                            <span>៛{refinedGrandTotalRiel.toFixed(0)}</span>
                        </div>
                    </div>
                )}
                {activeOrderRowsCount === 0 && order.order_rows.length > 0 && (
                    <div className="mt-8 pt-4 border-t border-border text-center text-gray-500">
                        <p>All items in this order have been cancelled.</p>
                    </div>
                )}
            </div>

            {/* Custom Discount Modal */}
            <CustomDiscountModal
                isOpen={isCustomDiscountModalOpen}
                onClose={() => setIsCustomDiscountModalOpen(false)}
                onApplyDiscount={handleApplyCustomDiscount}
                currentCustomDiscount={customDiscount}
            />

            {/* Payment Modal */}
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onPaid={handlePayment}
                totalInDollars={refinedGrandTotalUSD.toFixed(1)}
                totalInRiels={refinedGrandTotalRiel.toFixed(0)}
            />

            {/* Merge Order Modal */}
            <MergeOrderModal
                isOpen={isMergeModalOpen}
                onClose={() => setIsMergeModalOpen(false)}
                onMerge={handleMergeOrders} // Pass the new handleMergeOrders function
                currentOrderId={order.id} // Pass the current order's internal ID
            />
        </main>
    );
}