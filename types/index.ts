export type Role = 'Admin' | 'Sales' | 'Store';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  outstandingBalance: number;
  lat?: number;
  lon?: number;
  sales_id?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  unit: string;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
}

export type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Completed' | 'Cancelled';

export interface Transaction {
  id: string;
  checkInTime: string | null;
  gps: { lat: number; lon: number } | null;
  customer: Customer | null;
  items: CartItem[];
  subtotal: number;
  payment: any;
  total: number;
  signatureUrl: string | null;
  photoUrl: string | null;
  status: OrderStatus;
  assignedShopId?: string;
  salesmanId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockAudit {
  id: string;
  customerId: string;
  salesmanId?: string;
  items: {
    productId: string;
    productName: string;
    physicalStock: number;
  }[];
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
