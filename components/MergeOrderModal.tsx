// components/MergeOrderModal.tsx
"use client";

import { useState, useEffect } from 'react';
import { Order, OrderRow, Product } from '@/types';
import { Button } from "@/components/ui/button";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


interface MergeOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onMerge: (mergedOrderRows: OrderRow[], mergedOrderId: number, mergedOrderDocId: string) => void;
    currentOrderId: number;
}

const MergeOrderModal: React.FC<MergeOrderModalProps> = ({ isOpen, onClose, onMerge, currentOrderId }) => {
    const [servedOrders, setServedOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

    // Helper to get the "business day" date range in ISO format for Strapi, ending at 4 AM of the next calendar day
    const getBusinessDayDateRange = () => {
        const now = new Date();
        let startOfBusinessDay = new Date(now);
        let endOfBusinessDay = new Date(now);

        // Current time: Monday, June 23, 2025 at 4:27:20 PM +07.
        // It's after 4 AM, so "today" started at Monday 00:00:00 and ends Tuesday 04:00:00.

        if (now.getHours() < 4) {
            // If it's before 4 AM (e.g., 2 AM Monday), we're in the business day that started yesterday.
            // Start: Yesterday 00:00:00
            startOfBusinessDay.setDate(now.getDate() - 1);
            startOfBusinessDay.setHours(0, 0, 0, 0);

            // End: Today 04:00:00
            endOfBusinessDay.setHours(4, 0, 0, 0);
        } else {
            // If it's 4 AM or later (e.g., 4:27 PM Monday), we're in the business day that started today.
            // Start: Today 00:00:00
            startOfBusinessDay.setHours(0, 0, 0, 0);

            // End: Tomorrow 04:00:00
            endOfBusinessDay.setDate(now.getDate() + 1);
            endOfBusinessDay.setHours(4, 0, 0, 0);
        }

        return {
            start: startOfBusinessDay.toISOString(),
            end: endOfBusinessDay.toISOString()
        };
    };

    useEffect(() => {
        if (!isOpen) {
            setSelectedOrderId(null); // Reset selection when modal closes
            return;
        }

        const fetchServedOrders = async () => {
            setLoading(true);
            setError(null);
            try {
                const { start, end } = getBusinessDayDateRange();

                // Directly fetch served orders for the current "business day" using Strapi filters
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/orders?filters[orderStatus][$eq]=served&filters[createdAt][$gte]=${start}&filters[createdAt][$lt]=${end}`,
                    {
                        cache: 'no-store',
                    }
                );

                if (!response.ok) {
                    throw new Error(`Error fetching served orders: ${response.status} ${response.statusText}`);
                }

                const responseData = await response.json();
                if (responseData.data && Array.isArray(responseData.data)) {
                    // Filter out the current order being viewed on the client side
                    // (The date filtering is now handled by the Strapi query)
                    const filteredOrders = responseData.data
                        .filter((orderItem: any) => orderItem.id !== currentOrderId)
                        .map((orderItem: any) => ({
                            id: orderItem.id,
                            documentId: orderItem.documentId || orderItem.id.toString(),
                            orderStatus: orderItem.orderStatus,
                            tableName: orderItem.tableName,
                            customerName: orderItem.customerName,
                            createdAt: orderItem.createdAt,
                            paymentDaytime: orderItem.paymentDaytime,
                            // order_rows will be fetched separately for each order, as per original logic
                            order_rows: [] // Initialize as empty, they will be populated below
                        }));

                    // Fetch order rows and product details for each filtered order,
                    // preserving your existing logic for this part.
                    const ordersWithAllDetails = await Promise.all(filteredOrders.map(async (orderItem: Order) => {
                        const orderRowsResponse = await fetch(
                            `${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/order-rows?filters[order_doc_id][$eq]=${orderItem.documentId}&populate=*`,
                            { cache: 'no-store' }
                        );

                        if (!orderRowsResponse.ok) {
                            console.warn(`Could not fetch order rows for order ${orderItem.documentId}. Error: ${orderRowsResponse.status} ${orderRowsResponse.statusText}`);
                            return { ...orderItem, order_rows: [] }; // Return order with empty rows if fetch fails
                        }

                        const orderRowsResponseData = await orderRowsResponse.json();
                        let fetchedOrderRows: OrderRow[] = [];
                        if (orderRowsResponseData.data && Array.isArray(orderRowsResponseData.data)) {
                            fetchedOrderRows = await Promise.all(orderRowsResponseData.data.map(async (item: any) => {
                                const rowAttributes = item;

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
                                            }
                                        }
                                    } catch (err) {
                                        console.error(`Error fetching product ${rowAttributes.product_doc_id}:`, err);
                                    }
                                }

                                const row: OrderRow = {
                                    id: item.id,
                                    documentId: rowAttributes.documentId || item.id.toString(),
                                    quantity: rowAttributes.quantity,
                                    subtotal: parseFloat(rowAttributes.subtotal) || 0,
                                    taxesSubtotal: parseFloat(rowAttributes.taxesSubtotal) || 0,
                                    product_doc_id: rowAttributes.product_doc_id,
                                    order_doc_id: rowAttributes.order_doc_id,
                                    category_doc_id: rowAttributes.category_doc_id,
                                    createdAt: rowAttributes.createdAt,
                                    orderRowStatus: rowAttributes.orderRowStatus,
                                    product: product,
                                    updatedAt: rowAttributes.updatedAt
                                };
                                return row;
                            }));
                        }

                        return {
                            ...orderItem,
                            order_rows: fetchedOrderRows
                        };
                    }));

                    setServedOrders(ordersWithAllDetails);
                } else {
                    setServedOrders([]);
                }
            } catch (err: any) {
                console.error("Error fetching served orders:", err);
                setError("Failed to load served orders. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        if (isOpen) {
            fetchServedOrders();
        }
    }, [isOpen, currentOrderId]); // currentOrderId is a dependency because we filter it out

    const handleMergeClick = () => {
        if (selectedOrderId) {
            const selectedOrder = servedOrders.find(order => order.id === selectedOrderId);
            if (selectedOrder) {
                // Ensure documentId is always passed, falling back to id.toString()
                onMerge(selectedOrder.order_rows, selectedOrder.id, selectedOrder.documentId || selectedOrder.id.toString());
                onClose();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-8 text-primary text-center">Merge Order</h2>
                {loading && <p className="text-center text-foreground">Loading served orders...</p>}
                {error && <p className="text-center text-red-500">{error}</p>}
                {!loading && !error && servedOrders.length === 0 && (
                    <p className="text-center text-foreground">No served orders available for merging today.</p>
                )}

                {!loading && !error && servedOrders.length > 0 && (
                    <div className="mb-6 rounded-lg border-primary border-2 p-4 bg-card ps-6">
                        <Label className="block text-foreground text-bold text-lg mb-4">Select an order to merge</Label>
                        <RadioGroup
                            value={selectedOrderId ? selectedOrderId.toString() : ''}
                            onValueChange={(value: string) => setSelectedOrderId(parseInt(value))}
                            className="space-y-3"
                        >
                            {servedOrders.map((order) => (
                                <div key={order.id} className="flex items-center space-x-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                                    <RadioGroupItem value={order.id.toString()} id={`order-${order.id}`} />
                                    <Label htmlFor={`order-${order.id}`} className="grow ps-4 cursor-pointer">
                                        <div className="flex flex-col w-full">
                                            <div className="flex justify-between text-primary text-lg font-semibold">
                                                <p>#{order.id} - {order.customerName}</p>
                                                <p>Table: {order.tableName || 'N/A'}</p>
                                            </div>
                                            <div className="flex justify-between pt-2 text-foreground text-sm">
                                                <p>Items: {order.order_rows.length}</p>
                                                <p>Created At: {new Date(order.createdAt).toLocaleTimeString('en-US')}</p> {/* Local time format */}
                                            </div>
                                        </div>
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>
                )}

                <div className="flex justify-end space-x-2 mt-8">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleMergeClick}
                        disabled={!selectedOrderId}
                    >
                        Merge Selected Order
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default MergeOrderModal;