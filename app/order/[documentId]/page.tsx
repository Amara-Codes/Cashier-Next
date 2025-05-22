import OrderDisplayWrapper from "../../../components/OrderDisplayWrapper"; // Import the new client component

// Keep your existing interfaces: ProductInfo, OrderRow, CustomerInfo, Order
// ... (ProductInfo, OrderRow, CustomerInfo, Order interfaces from your original file) ...
interface ProductInfo {
    id: number;
    name: string;
    price: number;
    vat?: number; // Added for consistency with modal and calculations
    description?: string; // Added for consistency
}

interface OrderRow {
    id: number;
    quantity: number;
    subtotal: number;
    taxes: number;
    productId?: number; // Changed to productId for clarity
    product?: ProductInfo;
    createdAt: string;
}

interface CustomerInfo {
    id: number;
    name: string;
    email?: string;
}

interface Order {
    id: number;
    orderStatus?: string;
    tableName?: string;
    customerName?: string;
    customer?: CustomerInfo;
    createdAt: string;
    order_rows: OrderRow[];
}


// Define Category and Product types for getCategories function return type
interface Product {
    id: number;
    name: string;
    price: number;
    description?: string;
    vat?: number;
}

interface Category {
    id: number;
    name: string;
    products?: Product[];
}

async function getCategories(): Promise<Category[]> {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/categories?populate=*`, {
            cache: 'no-store',
        });
        if (!response.ok) {
            console.error(`Error fetching categories: ${response.status} ${response.statusText}`);
            return [];
        }
        const responseData = await response.json();
        if (!responseData.data) return [];

        return responseData.data.map((cat: any): Category => ({
            id: cat.id,
            name: cat.name,
            products: cat.products?.map((prod: any): Product => ({
                id: prod.id,
                name: prod.name,
                price: prod.price,
                description: prod.description,
                vat: prod.vat,
            })) || [],
        }));
    } catch (error) {
        console.error("Failed to fetch categories:", error);
        return [];
    }
}


async function getOrderData(orderId: string): Promise<Order | null> {
    try {
        const orderResponse = await fetch(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/orders/${orderId}?populate=*`, { // Populate customer if needed
            cache: 'no-store',
        });

        if (!orderResponse.ok) {
            if (orderResponse.status === 404) return null;
            throw new Error(`Error loading main order data: ${orderResponse.statusText}`);
        }
        const orderResponseData = await orderResponse.json();

        if (!orderResponseData.data || !orderResponseData.data.id) {
            return null;
        }

        const actualNumericOrderId = orderResponseData.data.id;
        // Adapt fetchedOrderAttributes to match the Order interface directly
        const fetchedOrderAttributes: Partial<Omit<Order, 'id' | 'order_rows'>> = {
            orderStatus: orderResponseData.data.orderStatus,
            tableName: orderResponseData.data.tableName,
            customerName: orderResponseData.data.customerName, // Assuming direct field
            createdAt: orderResponseData.data.createdAt,
        };


        // Fetch order rows with product data populated
        const orderRowsResponse = await fetch(
            `${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/order-rows?filters[order_id][$eq]=${actualNumericOrderId}&populate=*`,
            { cache: 'no-store' }
        );

        if (!orderRowsResponse.ok) {
            throw new Error(`Error loading order rows: ${orderRowsResponse.statusText}`);
        }
        const orderRowsResponseData = await orderRowsResponse.json();

        let fetchedOrderRows: OrderRow[] = [];
        if (orderRowsResponseData.data && Array.isArray(orderRowsResponseData.data)) {
            fetchedOrderRows = await Promise.all(orderRowsResponseData.data.map(async (item: any) => {
                const rowData = { id: item.id, ...item };
                rowData.subtotal = parseFloat(rowData.subtotal) || 0;
                rowData.taxesSubtotal = parseFloat(rowData.taxesSubtotal) || 0;

                if (rowData.product_id) {
                    try {
                        const productRes = await fetch(
                            `${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/products?filters[id][$eq]=${rowData.product_id}`,
                            { cache: 'no-store' }
                        );
                        if (!productRes.ok) {
                            console.log(`${process.env.NEXT_PUBLIC_STRAPI_URL || ''}/api/products/?filters[id][$eq]=${rowData.product_id}`)
                            console.warn(`Errore nel fetch del prodotto con id ${rowData.product_id}: ${productRes.status} ${productRes.statusText}`);
                        }
                        if (productRes.ok) {
                            const productData = await productRes.json();
                            if (productData.data && productData.data.length) {
                                rowData.product = {
                                    id: productData.data[0].id,
                                    ...productData.data[0],
                                };
                            }
                        }
                    } catch (err) {
                        console.warn(`Errore nel fetch del prodotto con id ${rowData.product_id}:`, err);
                    }
                }

                return rowData as OrderRow;
            }));
        }

        // Return the constructed order object
        return {
            id: actualNumericOrderId,
            ...fetchedOrderAttributes,
            order_rows: fetchedOrderRows,
        } as Order;

    } catch (err: any) {
        console.error("Error in getOrderData:", err);
        return null;
    }
}

export default async function OrderDetailPage({ params }: { params: { documentId: string } }) {
    const orderIdFromUrl = params.documentId;

    if (!orderIdFromUrl) {
        return <p>Order ID not provided.</p>;
    }

    // Fetch order and categories in parallel
    const [order, categories] = await Promise.all([
        getOrderData(orderIdFromUrl),
        getCategories()
    ]);

    if (!order) {
        return <p>Order {orderIdFromUrl} not found or data unavailable.</p>;
    }

    // Pass order and categories to the client wrapper component
    return <OrderDisplayWrapper initialOrder={order} categories={categories} />;
}