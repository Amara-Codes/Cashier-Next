// components/ProductSelectionModal.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"; // Assuming this is your shadcn/ui button

// Types (can be moved to a shared types file later)
interface Product {
  id: number;
  documentId?: string; // Optional for consistency with OrderRow
  name: string;
  price: number;
  description?: string;
  vat?: number;
}

interface Category {
  id: number;
  documentId?: string; // Optional for consistency with OrderRow
  name: string;
  products?: Product[];
}

interface CreatedOrder {
  id?: number;
  documentId?: string;
  customerName?: string;
  tableName?: string;
  orderStatus?: string;
}


interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  createdOrder?: CreatedOrder | null; // Optional to handle cases where no order is created yet
  onProductAddToOrder: (product: Product, quantity: number, orderDocId: string, categoryDocId: string) => void;
}

export default function ProductSelectionModal({
  isOpen,
  onClose,
  categories,
  createdOrder,
  onProductAddToOrder,
}: ProductSelectionModalProps) {
  const [selectedCategoryDocId, setSelectedCategoryDocId] = useState<string | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [selectedProductInModal, setSelectedProductInModal] = useState<Product | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);

  useEffect(() => {
    // Reset state when modal opens or categories change
    if (isOpen) {
      setSelectedCategoryDocId(null);
      setCategoryProducts([]);
      setSelectedProductInModal(null);
      setSelectedQuantity(1);
    }
  }, [isOpen, categories]);

  const handleCategoryClick = (categoryDocId: string) => {
    console.log("Category clicked:", categoryDocId);
    setSelectedCategoryDocId(categoryDocId);
    console.log("Selected category document ID:", categoryDocId);
    const selectedCategory = categories.find(cat => cat.documentId === categoryDocId);
    console.log("Selected category:", selectedCategory);
    const productsFromCategory = selectedCategory?.products || [];
    setCategoryProducts(productsFromCategory);
    setSelectedProductInModal(null); // Reset selected product when category changes
    setSelectedQuantity(1); // Reset quantity
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProductInModal(product);
    setSelectedQuantity(1); // Reset quantity when a new product is selected
  };

  const handleConfirmAddProduct = () => {
    if (!selectedProductInModal || selectedQuantity < 1 || createdOrder?.documentId === null) {
      alert("Please select a product, ensure quantity is valid, and an order is active.");
      return;
    }
    onProductAddToOrder(selectedProductInModal, selectedQuantity, createdOrder?.documentId || "", selectedCategoryDocId || "");
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      {/* Modifiche per mobile qui */}
      <div className="bg-card p-4 rounded-lg shadow-xl w-[95%] max-w-lg h-[95vh] flex flex-col text-foreground
                      md:p-6 md:max-w-3xl md:h-[95vh]">
        <div className="flex justify-between items-center mt-4 mb-8">
          {/* Modifiche per mobile qui */}
          <h2 className="text-xl md:text-2xl font-semibold text-primary">Order: {createdOrder?.id} - {createdOrder?.customerName}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </Button>
        </div>

        {/* Modifiche per mobile qui */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row space-x-0 md:space-x-4">
          {/* Left Column: Categories */}
          {/* Modifiche per mobile qui */}
          <div className="w-full h-1/2 md:h-auto md:w-1/3 border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-4 overflow-y-auto">
            <h3 className="lg:text-lg font-bold mb-3 text-primary">Categories</h3>
            {categories.length > 0 ? (
              <ul className="space-y-2 border border-primary rounded-md">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Button
                      variant={selectedCategoryDocId === category.documentId ? "default" : "ghost"}
                      className="w-full justify-start text-left ps-2"
                      onClick={() => handleCategoryClick(category.documentId || '')} // Ensure documentId is a string
                    >
                      {category.name ?? 'Unnamed Category'}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No categories found.</p>
            )}
          </div>

          {/* Right Column: Products */}
          {/* Modifiche per mobile qui */}
          <div className="w-full h-1/2 md:h-auto md:w-2/3 flex flex-col overflow-y-auto pt-4 md:pt-0 md:pl-4">
            <h3 className="lg:text-lg font-bold mb-3 text-primary truncate">
              Products {selectedCategoryDocId && categories.find(c => c.documentId === selectedCategoryDocId)?.name ? `in ${categories.find(c => c.documentId === selectedCategoryDocId)?.name ?? 'Selected Category'}` : ''}
            </h3>
            {selectedCategoryDocId ? (
              categoryProducts.length > 0 ? (
                <ul className="space-y-2 flex-1 overflow-y-auto border border-primary rounded-md">
                  {categoryProducts.map((product) => (
                    <li key={product.id}>
                      <Button
                        variant={selectedProductInModal?.documentId === product.documentId ? "default" : "ghost"}
                        className="w-full text-left p-3 h-auto ps-0"
                        onClick={() => handleProductSelect(product)}
                      >
                        <div className='w-3/4'>
                          <p className="font-medium truncate ps-2">{product.name ?? 'Unnamed Product'}</p>
                          {product.description && <p className="text-xs truncate ps-2">{product.description}</p>}
                        </div>
                        <span className="text-sm font-semibold w-1/4 text-end">
                          {product.price != undefined ? `€${product.price.toFixed(2)}` : 'Price N/A'}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No products found in this category.</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Select a category to see products.</p>
            )}
          </div>
        </div>

        {/* Modal Footer: Quantity and Add Button */}
        {selectedProductInModal?.name && ( // Check for product name (implies product is selected)
          <div className="mt-6 pt-4 border-t border-border flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className='flex items-center space-x-2'>
              <label htmlFor="quantity" className="text-sm font-medium text-muted-foreground">Quantity:</label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                min="1"
                value={selectedQuantity}
                onChange={(e) => setSelectedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 p-2 border border-input rounded-md text-sm bg-transparent focus:ring-primary focus:border-primary text-end md:text-start"
              />
            </div>
            {/* Modifiche per mobile qui */}
            <Button onClick={handleConfirmAddProduct} size="lg" className="w-full md:w-auto p-2 text-black">
              Add {selectedQuantity} x {selectedProductInModal.name} to Order
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}