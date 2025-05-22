// components/ProductSelectionModal.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"; // Assuming this is your shadcn/ui button

// Types (can be moved to a shared types file later)
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

interface CreatedOrder {
    id: number;
   customerName: string;
  tableName: string;
  orderStatus?: string;
}


interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  createdOrder?: CreatedOrder 
  onProductAddToOrder: (product: Product, quantity: number, orderId: number) => void;
}

export default function ProductSelectionModal({
  isOpen,
  onClose,
  categories,
  createdOrder,
  onProductAddToOrder,
}: ProductSelectionModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [selectedProductInModal, setSelectedProductInModal] = useState<Product | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);

  useEffect(() => {
    // Reset state when modal opens or categories change
    if (isOpen) {
      setSelectedCategoryId(null);
      setCategoryProducts([]);
      setSelectedProductInModal(null);
      setSelectedQuantity(1);
    }
  }, [isOpen, categories]);

  const handleCategoryClick = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    const selectedCategory = categories.find(cat => cat.id === categoryId);
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
    if (!selectedProductInModal || selectedQuantity < 1 || createdOrder?.id === null) {
      alert("Please select a product, ensure quantity is valid, and an order is active.");
      return;
    }
    onProductAddToOrder(selectedProductInModal, selectedQuantity, createdOrder?.id || 0);
    // Optionally, reset selection after adding or keep modal open for more items
    // setSelectedProductInModal(null);
    // setSelectedQuantity(1);
    // onClose(); // Or keep it open
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-3xl h-[80vh] flex flex-col text-foreground">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-primary">Order: {createdOrder?.id} - {createdOrder?.customerName}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden space-x-4">
          {/* Left Column: Categories */}
          <div className="w-1/3 border-r border-border pr-4 overflow-y-auto">
            <h3 className="text-lg font-medium mb-3 text-muted-foreground">Categories</h3>
            {categories.length > 0 ? (
              <ul className="space-y-2">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Button
                      variant={selectedCategoryId === category.id ? "secondary" : "ghost"}
                      className="w-full justify-start text-left"
                      onClick={() => handleCategoryClick(category.id)}
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
          <div className="w-2/3 flex flex-col overflow-y-auto pl-4">
            <h3 className="text-lg font-medium mb-3 text-muted-foreground">
              Products {selectedCategoryId && categories.find(c=>c.id === selectedCategoryId)?.name ? `in ${categories.find(c=>c.id === selectedCategoryId)?.name ?? 'Selected Category'}` : ''}
            </h3>
            {selectedCategoryId ? (
              categoryProducts.length > 0 ? (
                <ul className="space-y-2 flex-1 overflow-y-auto">
                  {categoryProducts.map((product) => (
                    <li key={product.id}>
                      <Button
                        variant={selectedProductInModal?.id === product.id ? "outline" : "ghost"}
                        className="w-full justify-between text-left p-3 h-auto"
                        onClick={() => handleProductSelect(product)}
                      >
                        <div>
                            <span className="font-medium">{product.name ?? 'Unnamed Product'}</span>
                            {product.description && <p className="text-xs text-muted-foreground">{product.description}</p>}
                        </div>
                        <span className="text-sm font-semibold">
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
          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between space-x-4">
            <div className='flex items-center space-x-2'>
                <label htmlFor="quantity" className="text-sm font-medium text-muted-foreground">Quantity:</label>
                <input
                type="number"
                id="quantity"
                name="quantity"
                min="1"
                value={selectedQuantity}
                onChange={(e) => setSelectedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 p-2 border border-input rounded-md text-sm bg-transparent focus:ring-primary focus:border-primary"
                />
            </div>
            <Button onClick={handleConfirmAddProduct} size="lg">
              Add {selectedQuantity} x {selectedProductInModal.name} to Order
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
