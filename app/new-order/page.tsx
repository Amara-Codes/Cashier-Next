// app/new-order/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import ProductSelectionModal from '@/components/ProductSelectionModal'; 


interface OrderData {
  customerName: string;
  tableName: string;
  orderStatus?: string;
}


interface Product {
  id: number;
  documentId?: string; 
  name: string;
  price: number;
  description?: string;
  vat?: number;
}


interface Category {
  id: number;
  documentId?: string; 
  name: string;
  products?: Product[];
}

// Define a type for the created order
interface CreatedOrder {
  id: number;
  documentId?: string; 
  customerName: string;
  tableName: string;
  orderStatus?: string;
}


export default function NewOrderPage() {
  const [customerName, setCustomerName] = useState('');
  const [tableName, setTableName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

  const handleCreateOrderAndFetchCategories = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setCreatedOrder(null);
    setCategories([]);

    if (!strapiUrl) {
      setError("Strapi URL is not configured. Please set NEXT_PUBLIC_STRAPI_URL environment variable.");
      setIsLoading(false);
      return;
    }

    const orderPayload: OrderData = {
      customerName: customerName,
      tableName: tableName,
      orderStatus: "pending",
    };

    try {
      const orderResponse = await fetch(`${strapiUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: orderPayload }), 
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        console.error("Strapi order creation error:", errorData);
        throw new Error(`Failed to create order: ${errorData.error?.message || orderResponse.statusText}`);
      }

      const newOrderResponse = await orderResponse.json();
      if (newOrderResponse && newOrderResponse.data) {
        setCreatedOrder(newOrderResponse.data);
        console.log('Order created successfully:', newOrderResponse.data);
      } else {
        console.error("Unexpected response structure from Strapi after order creation (missing data wrapper):", newOrderResponse);
        throw new Error("Order created, but response format was unexpected. Check console.");
      }

      const categoriesApiUrl = `${strapiUrl}/api/categories?populate=*`;
      console.log("Fetching categories with URL:", categoriesApiUrl);

      const categoriesResponse = await fetch(categoriesApiUrl, {
        method: 'GET',
      });

      if (!categoriesResponse.ok) {
        const errorData = await categoriesResponse.json();
        console.error("Strapi categories fetch error:", errorData);
        throw new Error(`Failed to fetch categories: ${errorData.error?.message || categoriesResponse.statusText}`);
      }

      const categoriesApiResponse = await categoriesResponse.json();
      const fetchedCategories: Category[] = (categoriesApiResponse.data || []).map((catFromApi: any) => ({
        id: catFromApi.id,
        name: catFromApi.name ?? 'Unnamed Category',
        documentId: catFromApi.documentId,
        products: (catFromApi.products || []).map((prodFromApi: any) => ({
          id: prodFromApi.id,
          documentId: prodFromApi.documentId ?? "", 
          name: prodFromApi.name ?? 'Unnamed Product',
          price: prodFromApi.price ?? 0,
          description: prodFromApi.description,
          vat: prodFromApi.vat ?? 0,
        })),
      }));

      setCategories(fetchedCategories);
      console.log('Categories (with products) fetched and mapped:', fetchedCategories);

      if (fetchedCategories.length > 0) {
        setIsModalOpen(true); // Open modal after categories are fetched and mapped
      } else {
        alert("Order created, but no categories found to add items.");
      }

    } catch (err: any) {
      console.error('An error occurred:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductAddToOrderCallback = async ( 
    product: Product,
    quantity: number,
    orderDocId: string,
    categoryDocId: string, 
  ) => {
    //setUserMessage(null); // Opzionale: resetta messaggi precedenti

   
    // 1. Validazione dei dati di input (opzionale ma consigliata)
    if (typeof product.price !== 'number' || isNaN(product.price)) {
      console.error('Errore: prezzo del prodotto non valido.', product);
      // setUserMessage({ text: `Errore: prezzo non valido per ${product.name}.`, type: 'error' });
      alert(`Errore: prezzo non valido per ${product.name}.`); // Fallback se setUserMessage non è disponibile
      return;
    }
    if (typeof product.vat !== 'number' || isNaN(product.vat)) {
      console.error('Errore: IVA del prodotto non valida.', product);
      // setUserMessage({ text: `Errore: IVA non valida per ${product.name}.`, type: 'error' });
      alert(`Errore: IVA non valida per ${product.name}.`); // Fallback
      return;
    }
    if (quantity <= 0) {
      console.error('Errore: quantità non valida.', quantity);
      // setUserMessage({ text: 'Errore: la quantità deve essere maggiore di zero.', type: 'error' });
      alert('Errore: la quantità deve essere maggiore di zero.'); // Fallback
      return;
    }

    // 2. Calcolo di subtotal e taxes
    const unitPrice = product.price;
    const vatRate = product.vat / 100; // Es. se product.vat è 22, vatRate diventa 0.22

    const subtotal = quantity * unitPrice;
    const taxes = quantity * (unitPrice * vatRate); // Tassa totale per la quantità di questo prodotto

    // 3. Preparazione del payload per la POST request
    const payload = {
      order_doc_id: orderDocId,
      product_doc_id: product.documentId,
      category_doc_id: categoryDocId, // Aggiungiamo categoryId per il contesto
      quantity: quantity,
      subtotal: parseFloat(subtotal.toFixed(2)), // Arrotonda a 2 decimali, invia come numero
      taxesSubtotal: parseFloat(taxes.toFixed(2)),  
      orderRowStatus: 'pending'      // Arrotonda a 2 decimali, invia come numero
    };

   

    try {
      // 4. Effettua la chiamata POST
      const response = await fetch(`${strapiUrl}/api/order-rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload }), // 
      });

      if (response.ok) {
        const responseData = await response.json(); // Supponendo che il backend risponda con JSON
        console.log('Riga ordine aggiunta con successo:', responseData);
        // setUserMessage({ text: `${quantity} x ${product.name} aggiunto con successo all'ordine!`, type: 'success' });
        window.location.href = `/order/${createdOrder?.documentId}`;

        // Qui potresti voler aggiornare lo stato dell'ordine nella UI, chiudere il modale, ecc.
        // Esempio: setIsModalOpen(false);
        // Esempio: fetchOrderDetails(orderId); // Per ricaricare i dettagli dell'ordine
      } else {
        // Il server ha risposto con un errore (es. 400, 404, 422, 500)
        const errorData = await response.json().catch(() => ({ message: `Errore server: ${response.status}` }));
        console.error('Errore dal server durante l\'aggiunta della riga ordine:', response.status, errorData);
        // setUserMessage({ text: `Errore ${response.status}: ${errorData.message || 'Impossibile aggiungere il prodotto.'}`, type: 'error' });
        alert(`Errore ${response.status}: ${errorData.message || 'Impossibile aggiungere il prodotto.'}`); // Fallback
      }
    } catch (error) {
      // Errore di rete o altro errore JavaScript imprevisto
      console.error('Errore di rete o JavaScript durante la POST a /order_rows:', error);
      // setUserMessage({ text: 'Errore di connessione o elaborazione. Riprova.', type: 'error' });
      alert('Errore di connessione o elaborazione. Riprova.'); // Fallback
    }
  };


  return (
    <main className="flex min-h-screen flex-col items-center px-4 sm:px-8 md:px-24 py-8 bg-background text-foreground">
      <div className='flex items-center justify-between w-full max-w-5xl mt-8'>
        <div className="logo-container">
          <Link href="/" passHref>
            <Image
              src="/logo.png" // Make sure this path is correct in your `public` folder
              alt="Logo"
              width={80}
              height={80}
              className="logo"
              priority
            />
          </Link>
        </div>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold my-8 text-primary">Create New Order</h1>

      <div className="form-wrapper flex w-full max-w-md justify-center pt-8">
        <form onSubmit={handleCreateOrderAndFetchCategories} className="w-full space-y-6 p-6 shadow-md rounded-lg bg-card">
          {/* Customer Name and Table Name inputs */}
          <div className="relative z-0 w-full group">
            <input
              type="text" name="customer_name" id="customer_name"
              className="block py-2.5 px-0 w-full text-sm text-foreground bg-transparent border-0 border-b-2 border-input appearance-none focus:outline-none focus:ring-0 focus:border-primary peer"
              placeholder=" " required value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={isLoading}
            />
            <label htmlFor="customer_name" className="peer-focus:font-medium absolute text-sm text-muted-foreground duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
              Customer Name
            </label>
          </div>
          <div className="relative z-0 w-full group">
            <input
              type="text" name="table_name" id="table_name"
              className="block py-2.5 px-0 w-full text-sm text-foreground bg-transparent border-0 border-b-2 border-input appearance-none focus:outline-none focus:ring-0 focus:border-primary peer"
              placeholder=" " value={tableName} onChange={(e) => setTableName(e.target.value)} disabled={isLoading}
            />
            <label htmlFor="table_name" className="peer-focus:font-medium absolute text-sm text-muted-foreground duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
              Table Name / Number (Optional)
            </label>
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>}
          <div className="mt-10 flex justify-end">
            <Button type="submit" disabled={isLoading || !customerName.trim()}>
              {isLoading ? 'Processing...' : 'Create Order & Select Products'}
            </Button>
          </div>
        </form>
      </div>

      {/* Render the Product Selection Modal */}
      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
        createdOrder={createdOrder} // Pass the ID of the created order
        onProductAddToOrder={handleProductAddToOrderCallback}
      />
    </main>
  );
}
