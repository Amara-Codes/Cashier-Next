// File: /app/order/[documentId]/OrderDisplayWrapper.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import ProductSelectionModal from '@/components/ProductSelectionModal'; // Adjust path as necessary
import { Button } from "@/components/ui/button";

// Re-use or import existing interfaces (ensure they are consistent)
interface ProductInfo { // From ProductSelectionModal's Product type / page.tsx ProductInfo
    id: number;
    name: string;
    price: number;
    description?: string;
    vat?: number; // Crucial for tax calculation
}

interface OrderRow { // From page.tsx
    id: number;
    quantity: number;
    subtotal: number;
    taxes: number;
    product?: ProductInfo;
    createdAt: string;
}

interface CustomerInfo { // From page.tsx
    id: number;
    name: string;
    email?: string;
}

interface Order { // From page.tsx
    id: number;
    orderStatus?: string;
    tableName?: string;
    customerName?: string;
    customer?: CustomerInfo;
    createdAt: string;
    order_rows: OrderRow[];
}

interface Category { // From ProductSelectionModal / page.tsx
    id: number;
    name: string;
    products?: ProductInfo[];
}

// For the modal's createdOrder prop
interface CreatedOrderInfo {
    id: number;
    customerName: string;
    tableName: string;
    orderStatus?: string;
}


interface OrderDisplayWrapperProps {
    initialOrder: Order;
    categories: Category[]; // Categories fetched from server
}

export default function OrderDisplayWrapper({ initialOrder, categories }: OrderDisplayWrapperProps) {
    const [order, setOrder] = useState<Order>(initialOrder);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setOrder(initialOrder);
    }, [initialOrder]); // Update state if props change (e.g., after router.refresh)

    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    const handleProductAddToOrder = async (product: ProductInfo, quantity: number, orderId: number) => {
        if (!product || typeof product.price !== 'number') {
            alert("Selected product is invalid or missing price information.");
            return;
        }

        const baseSubtotal = product.price * quantity;
        const productVatRate = product.vat ?? 0; // Default to 0 if VAT is not defined
        const calculatedTaxes = (baseSubtotal * productVatRate) / 100;
        const finalSubtotal = baseSubtotal; // Assuming subtotal is pre-tax

        const newOrderRowPayload = {
            data: { // Strapi v4 expects a 'data' wrapper for POST/PUT
                quantity: quantity,
                subtotal: parseFloat(finalSubtotal.toFixed(2)),
                taxesSubtotal: parseFloat(calculatedTaxes.toFixed(2)),
                order_id: orderId,           // Relational field: ID of the order
                product_id: product.id,      // Relational field: ID of the product
                // productName: product.name, // Optional: denormalized data if your API supports it
                // productPrice: product.price, // Optional: denormalized data
                // createdAt and updatedAt will be set by Strapi
            }
        };

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/order-rows`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add Authorization header if your API is protected
                    // 'Authorization': `Bearer YOUR_API_TOKEN_OR_JWT`,
                },
                body: JSON.stringify(newOrderRowPayload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error:", errorData);
                throw new Error(`Failed to add product to order: ${errorData.error?.message || response.statusText}`);
            }

            // const createdRow = await response.json(); // Contains the newly created order_row
            // console.log("Product added successfully:", createdRow);

            handleCloseModal();
            alert(`"${product.name}" x ${quantity} added successfully! Refreshing order details...`);
            router.refresh(); // This re-runs the server component's data fetching

        } catch (error: any) {
            console.error("Error adding product to order:", error);
            alert(`An error occurred: ${error.message}`);
        }
    };

    const createdOrderForModal: CreatedOrderInfo = {
        id: order.id,
        customerName: order.customerName || order.customer?.name || 'N/A',
        tableName: order.tableName || 'N/A',
        orderStatus: order.orderStatus || 'N/A'
    };

    return (
        <main className="flex min-h-screen flex-col items-center px-4 sm:px-8 md:px-24 py-8 bg-background text-foreground">
            <div className='flex items-center justify-between w-full max-w-5xl mt-8 mb-6'>
                <div className="logo-container">
                    <Link href="/" passHref>
                        <Image src="/logo.png" alt="Logo" width={80} height={80} className="logo" priority />
                    </Link>
                </div>
                <Button onClick={handleOpenModal} size="lg">
                    Add Product to Order
                </Button>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold my-8 text-primary">
                Order #{order.id} - {order.customerName || order.customer?.name || 'Anonymous Customer'}
            </h1>

            <div className="w-full max-w-5xl mt-4">
                <h2 className="text-2xl font-semibold mb-3">Order Details:</h2>
                <p><strong>Status:</strong> {order.orderStatus || 'N/D'}</p>
                <p><strong>Table Name / Table Number:</strong> {order.tableName || 'N/D'}</p>
                <p><strong>Created At:</strong> {new Date(order.createdAt).toLocaleString('it-IT')}</p>
                <h3 className="text-xl font-semibold mt-6 mb-2">Products:</h3>
                {order.order_rows && order.order_rows.length > 0 ? (
                    <ul className="divide-y divide-border">
                        {order.order_rows.map(row => (
                            <li key={row.id} className="flex justify-between items-center py-3">
                                <div>
                                    <span className="font-medium">{row.quantity} x {row.product?.name || 'Prodotto sconosciuto'}</span>
                                    {row.product?.price && (
                                        <span className="text-sm text-muted-foreground ml-2">
                                            (@ €{row.product.price.toFixed(2)} each)
                                        </span>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="font-semibold block">€{row.subtotal.toFixed(2)}</span>
                                    {row.taxes > 0 && (
                                        <span className="text-xs text-muted-foreground block">
                                            (Taxes: €{row.taxes.toFixed(2)})
                                        </span>
                                    )}
                                    <span className="text-xs text-muted-foreground block">
                                        Added: {new Date(row.createdAt).toLocaleString('it-IT')}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : <p>No items in this order yet.</p>}
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