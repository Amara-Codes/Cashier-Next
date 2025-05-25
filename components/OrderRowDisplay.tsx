// components/OrderItem.tsx
import React from 'react';
import OrderRowStatusSwitcher from '@/components/OrderRowStatusSwitcher';
import { useEffect, useState } from 'react';


type OrderRowStatus = 'pending' | 'served' | 'paid' | 'cancelled';

interface Category {
    id: number;
    documentId?: string; // Optional for consistency with OrderRow
    name: string;
    products?: ProductInfo[];
}

interface ProductInfo {
    id: number;
    documentId?: string; // Optional for consistency with OrderRow
    name: string;
    price: number;
    description?: string;
    vat?: number;
}

interface OrderRow {
    id: number;
    documentId: string;
    quantity: number;
    subtotal: number;
    taxesSubtotal: number;
    product_doc_id?: string;
    order_doc_id?: string;
    category_doc_id?: string;
    product?: ProductInfo;
    createdAt: string;
    orderRowStatus?: OrderRowStatus;
}

interface OrderItemProps {
    row: OrderRow;
}

async function fetchCategoryById(categoryDocId: string): Promise<Category | null> {
    if (!categoryDocId) {
        console.warn("fetchCategoryById: categoryId is null or undefined, skipping fetch.");
        return null;
    }
    try {
        console.log(`Workspaceing category for ID: ${categoryDocId}`);
        const res = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/categories/${categoryDocId}`);

        if (!res.ok) {
            console.error(`HTTP error! Status: ${res.status} for categoryId: ${categoryDocId}`);
            // Attempt to read error body if available
            const errorBody = await res.text();
            console.error('Error Response Body:', errorBody);
            throw new Error('Network response was not ok');
        }

        const data = await res.json();
        console.log("Raw category fetch response data:", data);

        // Assuming Strapi v4 structure: data.data is an array, and attributes contains the fields
        if (Array.isArray(data?.data) && data.data.length > 0) {
            const categoryData = data.data[0];


            console.log("Category data extracted----------------:", categoryData);
            // Check if 'attributes' exists, which is common in Strapi v4
            if (categoryData.id && categoryData.name) {
                console.log(`Category found: ${categoryData.name}`);
                return {
                    id: categoryData.id,
                    documentId: categoryData.documentId, // Use documentId if available, fallback to id
                    name: categoryData.name,
                    products: categoryData.products || [],
                };
            } else if (categoryData.name) { // Fallback for older Strapi or different config
                console.log(`Category found (no attributes): ${categoryData.name}`);
                return {
                    id: categoryData.id,
                    documentId: categoryData.documentId,
                    name: categoryData.name,
                    products: categoryData.products || [],
                };
            }
        }
        console.warn(`No category data found for ID: ${categoryDocId} in response.`);
        return null;
    } catch (error) {
        console.error(`Failed to fetch category for ID ${categoryDocId}:`, error);
        return null;
    }
}

const OrderRowDisplay: React.FC<OrderItemProps> = ({ row }) => {
    const [categoryName, setCategoryName] = useState<string>('');

    useEffect(() => {
        async function loadCategory() {
           
            console.log("Current row.category_id:", row.category_doc_id);

            if (row.category_doc_id) {
                const cat = await fetchCategoryById(row.category_doc_id);

                if (cat && cat.name) {
                    setCategoryName(cat.name);
                    console.log("Category name set to:", cat.name);
                } else {
                    setCategoryName('');
                    console.log("Category name set to empty string (no category or name found).");
                }
            } else {
                setCategoryName('');
                console.log("row.category_id is empty, category name cleared.");
            }
        }

        loadCategory();

        // The dependency array ensures this effect runs when row.category_id changes
    }, [row.category_doc_id]); // IMPORTANT: This dependency ensures the effect runs when categoryId changes

    return (
        <li key={row.documentId} className="flex justify-between items-center py-3">

            <div className='w-1/2'>
                <div>
                    <span className="font-medium">
                        
                        {row.quantity} x {row.product?.name || 'Prodotto sconosciuto'}
                    </span>
                    {row.product?.price && (
                        <span className="text-sm text-muted-foreground ml-2">
                            (@ €{row.product.price.toFixed(2)} each)
                        </span>
                    )}
                </div>
                <div>
                    {/* Only render if categoryName has a value */}
                    {categoryName && (
                        <span className="text-xs text-muted-foreground">
                            {categoryName}
                        </span>
                    )}
                </div>
            </div>
            <OrderRowStatusSwitcher orderRowId={row.documentId ?? ''} initialStatus={row.orderRowStatus ?? 'pending'} onStatusChange={() => window.location.reload()} />
            <div className="text-right">
                <span className="font-semibold block">€{row.subtotal.toFixed(2)}</span>
                {row.taxesSubtotal > 0 && (
                    <span className="text-xs text-muted-foreground block">
                        (Taxes: €{row.taxesSubtotal.toFixed(2)})
                    </span>
                )}
                <span className="text-xs text-muted-foreground block">
                    Added: {new Date(row.createdAt).toLocaleString('it-IT')}
                </span>
            </div>
        </li>
    );
};

export default OrderRowDisplay;