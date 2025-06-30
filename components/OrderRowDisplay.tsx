// components/OrderItem.tsx
import React from 'react';
import OrderRowStatusSwitcher from '@/components/OrderRowStatusSwitcher';
import { useEffect, useState } from 'react';

import { Category, OrderRow  } from '@/types';



interface OrderItemProps {
    row: OrderRow;
    showPaidSwitcher?: boolean;
    showSwitcher?: boolean;// New prop: controls visibility of paid status switcher
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
        if (data?.data) {
            const categoryData = data.data;


            console.log("Category data extracted----------------:", categoryData);
            // Check if 'attributes' exists, which is common in Strapi v4
            if (categoryData.id && categoryData.name) {
                console.log(`Category found: ${categoryData.name}`);
                return {
                    id: categoryData.id,
                    documentId: categoryData.documentId, // Use documentId if available, fallback to id
                    name: categoryData.name,
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

const OrderRowDisplay: React.FC<OrderItemProps> = ({ row, showPaidSwitcher = false, showSwitcher = false }) => { // Set default to false
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
                        {row.quantity} x {row.product?.name || 'Unknown Product'}
                    </span>
                    {row.product?.price && (
                        <span className="text-sm text-muted-foreground block">
                            (@ ${row.product.price.toFixed(2)} each)
                        </span>
                    )}

                </div>
                <div>
                    {/* Only render if categoryName has a value */}
                    {categoryName && (
                        <div className="text-xs text-muted-foreground mt-2">
                            <strong>Category: </strong> <span className='text-primary'> {categoryName}</span>
                        </div>
                    )}
                </div>

            </div>
            {showSwitcher && (
                <OrderRowStatusSwitcher
                    orderRowId={row.documentId ?? ''}
                    initialStatus={row.orderRowStatus ?? 'pending'}
                    onStatusChange={() => window.location.reload()}
                    showingPaidStatus={showPaidSwitcher} // Pass the value of showPaidSwitcher
                />
            )}


            <div className="text-right">
                <span className="font-semibold block">${row.subtotal.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground block">
                    Added: {new Date(row.createdAt).toLocaleTimeString('it-IT')}
                </span>
                <span className="text-xs text-muted-foreground block">
                    Updated: {new Date(row.updatedAt).toLocaleTimeString('it-IT')}
                </span>
            </div>
        </li>
    );
};

export default OrderRowDisplay;