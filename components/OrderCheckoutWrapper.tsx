"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Image from "next/image";
import Link from "next/link";
import OrderRowDisplay from '@/components/OrderRowDisplay'; // Adjust path as necessary
import { Button } from "@/components/ui/button";
import { CustomDiscountModal } from '@/components/CustomDiscountModal';
import { PaymentModal } from '@/components/PaymentModal'; // Import the new modal component

type OrderRowStatus = 'pending' | 'served' | 'paid' | 'cancelled';

interface ProductInfo {
    id: number;
    documentId?: string;
    name: string;
    price: number; // This price is now considered to INCLUDE VAT
    description?: string;
    vat?: number; // This should be the VAT rate (e.g., 22 for 22%, or 0.22 for 22%)
    categoryName?: string; // Add categoryName to ProductInfo
}

interface Category {
    id: number;
    documentId?: string;
    name: string;
    products?: ProductInfo[];
}

interface OrderRow {
    id: number;
    documentId: string;
    quantity: number;
    subtotal: number; // This subtotal will now include taxes
    taxesSubtotal: number; // This will represent the calculated tax portion of the subtotal
    category_doc_id?: string;
    product_doc_id?: string;
    order_doc_id?: string;
    product?: ProductInfo;
    createdAt: string;
    orderRowStatus?: OrderRowStatus;
    updatedAt: string
}

interface Order {
    id: number;
    documentId?: string;
    orderStatus?: string;
    tableName?: string;
    customerName?: string;
    createdAt: string;
    order_rows: OrderRow[];
}

interface OrderCheckoutWrapperProps {
    initialOrder: Order;
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

export default function OrderCheckoutWrapper({ initialOrder }: OrderCheckoutWrapperProps) {
    const [order, setOrder] = useState<Order>(initialOrder);
    const [khmerCustomerDiscount, setKhmerCustomerDiscount] = useState<boolean>(false);
    const [cbacMembersDiscount, setCbacMembersDiscount] = useState<boolean>(false);
    const [kandalVillageFriendDiscount, setKandalVillageFriendDiscount] = useState<boolean>(false);

    // New state for custom discount
    const [isCustomDiscountModalOpen, setIsCustomDiscountModalOpen] = useState<boolean>(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
    // Custom discount is now applied to the grand total, so its value doesn't affect `applyDiscountsToRow`'s dependencies directly
    const [customDiscount, setCustomDiscount] = useState<{ value: number; type: 'dollar' | 'percentage' }>({ value: 0, type: 'dollar' });


    // Calculated totals in USD before custom discount
    const [baseGrandTotalUSD, setBaseGrandTotalUSD] = useState<number>(0); // This is the sum of subtotals (incl. taxes)
    const [calculatedTotalTaxesUSD, setCalculatedTotalTaxesUSD] = useState<number>(0); // Total tax portion for transparency
    const [calculatedTotalNoTaxesUSD, setCalculatedTotalNoTaxesUSD] = useState<number>(0); // Total non-tax portion for transparency

    // Processed order rows for display
    const [processedOrderRows, setProcessedOrderRows] = useState<OrderRow[]>([]);

    useEffect(() => {
        setOrder(initialOrder);
    }, [initialOrder]);

    // This function only applies the fixed and percentage discounts to individual row prices (which include taxes)
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

        // 3. Apply Kandal Village Friend Discount (15% off all items)
        // This discount applies to the price AFTER any previous specific discounts.
        if (kandalVillageFriendDiscount) {
            currentPrice = currentPrice * 0.85;
        }

        // Custom discount is NOT applied here anymore. It's applied to the grand total.

        return currentPrice;
    }, [khmerCustomerDiscount, cbacMembersDiscount, kandalVillageFriendDiscount]);

    useEffect(() => {
        const processOrderAndCalculateBaseTotals = async () => {
            const activeRows = order.order_rows.filter(row => row.orderRowStatus !== 'cancelled');
            let tempBaseGrandTotal = 0; // Sum of subtotals (incl. taxes) before custom discount
            let tempCalculatedTotalTaxes = 0; // Sum of tax portions for transparency
            let tempCalculatedTotalNoTaxes = 0; // Sum of non-tax portions for transparency
            const newProcessedRows: OrderRow[] = [];

            for (const row of activeRows) {
                const originalProductPrice = row.product?.price || 0;
                // Use the modified function that only applies item-level discounts
                const discountedPricePerUnit = await applyItemLevelDiscountsToPrice(originalProductPrice, row.category_doc_id);

                // Assuming `row.product?.vat` is the VAT percentage (e.g., 22 for 22%)
                const vatRate = row.product?.vat && row.product.vat > 0 ? row.product.vat / 100 : 0;

                // The new subtotal is the discounted price per unit multiplied by quantity.
                // This `newSubtotal` ALREADY INCLUDES TAXES, as per your requirement.
                const newSubtotal = discountedPricePerUnit * row.quantity;

                // Calculate the tax portion of this new subtotal for transparency
                // If price includes VAT, then: price_excl_vat = price_incl_vat / (1 + vat_rate)
                // VAT amount = price_incl_vat - price_excl_vat
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
        };

        processOrderAndCalculateBaseTotals();
    }, [order, khmerCustomerDiscount, cbacMembersDiscount, kandalVillageFriendDiscount, applyItemLevelDiscountsToPrice]);

    const activeOrderRowsCount = order.order_rows.filter(row => row.orderRowStatus !== 'cancelled').length;

    // --- Apply Custom Discount to the final Grand Total ---
    let finalGrandTotalUSD = baseGrandTotalUSD;
    if (customDiscount.value > 0) {
        if (customDiscount.type === 'dollar') {
            finalGrandTotalUSD = Math.max(0, baseGrandTotalUSD - customDiscount.value);
        } else { // percentage
            finalGrandTotalUSD = baseGrandTotalUSD * (1 - (customDiscount.value / 100));
        }
    }
    // --- End Custom Discount Application ---

    const refinedGrandTotalUSD = Math.ceil(finalGrandTotalUSD * 10) / 10; // Round up to one decimal place
    const grandTotalRiel = finalGrandTotalUSD * RIEL_EXCHANGE_RATE;
    const refinedGrandTotalRiel = Math.ceil(grandTotalRiel / 100) * 100; // Round to the nearest hundred Riel

    const handleApplyCustomDiscount = (value: number, type: 'dollar' | 'percentage') => {
        setCustomDiscount({ value, type });
        // No need to explicitly trigger recalculation here as customDiscount is now a dependency
        // in the main useEffect that calculates finalGrandTotalUSD
    };

    const handlePayment = (totalAmount: number | string, paymentMethod: 'QR' | 'cash') => {
        if (processedOrderRows.length) {
            processedOrderRows.forEach(row => {
                fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/order-rows/${row.documentId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ data: { orderRowStatus: 'paid' } }),
                })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Failed to update order row ${row.documentId}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log(`Order row ${row.documentId} updated to paid:`, data);
                    })
                    .catch(error => {
                        console.error(`Error updating order row ${row.documentId}:`, error);
                    });
            });
        }

           // --- Start of Modified Logic for appliedDiscount ---
        const appliedDiscountsList: string[] = [];
        if (khmerCustomerDiscount) {
            appliedDiscountsList.push("Khmer Customer Discount (Beer prices adjusted)");
        }
        if (cbacMembersDiscount) {
            appliedDiscountsList.push("CBAC Members Discount (Beer: -$1 per item)");
        }
        if (kandalVillageFriendDiscount) {
            appliedDiscountsList.push("Kandal Village Friend Discount (15% off total order row)");
        }
        if (customDiscount.value > 0) {
            const customDiscountText = customDiscount.type === 'dollar'
                ? `Custom Discount: -$${customDiscount.value.toFixed(2)}`
                : `Custom Discount: ${customDiscount.value.toFixed(1)}% off`;
            appliedDiscountsList.push(customDiscountText);
        }

        const appliedDiscountString = appliedDiscountsList.length > 0
            ? appliedDiscountsList.join("; ")
            : "No discounts applied";
        

        const checkoutInfo = { 
            paymentMethod: paymentMethod,
            paidAmount: totalAmount,
            paymentDaytime: new Date().toISOString(),
            appliedDiscount: appliedDiscountString,
            orderStatus: 'paid',
        }
        fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/orders/${order.documentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: checkoutInfo }),
        }).then(response => {
            if (!response.ok) {
                throw new Error(`Failed to update order ${order.documentId}`);
            }
            return response.json();
        })
            .then(data => {
                console.log(`Order ${order.documentId} updated to paid:`, data);
                window.location.href = '/'; // Redirect to home after payment
            })
            .catch(error => {
                console.error(`Error updating order ${order.documentId}:`, error);
            });
        // Here you would typically send this payment information to your backend
        // and update the order status to 'paid' in your database.
        // For demonstration, we'll just log it and potentially update local order status.
        /*
        setOrder(prevOrder => ({
            ...prevOrder,
            orderStatus: 'paid' // Update order status locally for display
        }));
        */
        // You might also clear discounts or reset the order in a real scenario
    };

    return (
        <main className="flex min-h-screen flex-col items-center px-4 sm:px-8 md:px-24 py-8 bg-background text-foreground">
            <div className='flex items-center justify-between w-full max-w-6xl mt-8 mb-6'>
                <div className="logo-container">
                    <Link href="/" passHref>
                        <Image src="/logo.png" alt="Logo" width={80} height={80} className="logo" priority />
                    </Link>
                </div>
                <Button className='bg-emerald-500 text-white px-4' size="lg" onClick={() => setIsPaymentModalOpen(true)}>
                    Pay
                </Button>
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
                {processedOrderRows && processedOrderRows.length > 0 ? (
                    <ul className="divide-y divide-border">
                        {processedOrderRows.map(row => (
                            <div key={row.documentId} className={`py-3 ${row.orderRowStatus === 'cancelled' ? 'opacity-50 line-through bg-gray-100 dark:bg-gray-800' : ''}`}>
                                <OrderRowDisplay key={row.documentId} row={row} showPaidSwitcher={true}/>
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
                                Kandal Village Friend (15% off total order row)
                            </label>
                        </div>

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
                            <span>€{calculatedTotalNoTaxesUSD.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-semibold mb-2">
                            <span>Total Taxes Included:</span> {/* Display tax portion */}
                            <span>€{calculatedTotalTaxesUSD.toFixed(2)}</span>
                        </div>
              
                        {/* FINAL Grand Total (USD) */}
                        <div className="flex justify-between items-center text-xl font-bold text-primary mb-2">
                            <span>Final Total (USD):</span>
                            <span>€{finalGrandTotalUSD.toFixed(2)}</span>
                        </div>

                        {/* Refined Grand Total (USD) */}
                        <div className="flex justify-between items-center text-xl font-bold text-primary mb-2">
                            <span>Refined Final Total (USD):</span>
                            <span>€{refinedGrandTotalUSD.toFixed(1)}</span>
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

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onPaid={handlePayment}
                totalInDollars={refinedGrandTotalUSD.toFixed(1)}
                totalInRiels={refinedGrandTotalRiel.toFixed(0)} // Pass the refined Riel total
            />
        </main>
    );
}