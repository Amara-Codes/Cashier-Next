export type OrderRowStatus =
  | "pending"
  | "served"
  | "paid"
  | "cancelled"
  | "merged";

  export type OrderStatus =
  | "pending"
  | "served"
  | "paid"
  | "cancelled"
  | "merged";

export interface Product {
  id: number;
  documentId?: string;
  name: string;
  price: number; // This price is now considered to INCLUDE VAT
  description?: string;
  vat?: number; // This should be the VAT rate (e.g., 22 for 22%, or 0.22 for 22%)
  categoryName?: string;
  imageUrl?: string; // Add categoryName to Product
}

export interface Category {
  id: number;
  documentId?: string;
  name: string;
  products?: Product[];
  isFood?: boolean; // Indicates if the category is food-related
  isAlcoholic?: boolean; // Indicates if the category is drink-related
}

export interface OrderRow {
  id: number;
  documentId: string;
  quantity: number;
  subtotal: number; // This subtotal will now include taxes
  taxesSubtotal: number; // This will represent the calculated tax portion of the subtotal
  category_doc_id?: string;
  product_doc_id?: string;
  order_doc_id?: string;
  product?: Product;
  createdAt: string;
  orderRowStatus?: OrderRowStatus;
  updatedAt: string;
  createdByUserName?: string;
  processedByUserName?: string;
  updatedByUserName?: string;
}

export interface Order {
  id: number;
  documentId?: string;
  orderStatus?: OrderStatus;
  tableName?: string;
  customerName?: string;
  createdAt: string;
  order_rows: OrderRow[];
  paymentDaytime?: string;
  mergedToOderDocId?: string;
  mergedWithOderDocId?: string;
  createdByUserName?: string;
  processedByUserName?: string;
}
