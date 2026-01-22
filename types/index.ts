export type Role = 'Admin' | 'Sales' | 'Store';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
  name: string;
  assignedShopId?: string | null;
  commissionRate?: number; // 0.05 for 5%
}

export interface CommissionPayout {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  periodStart?: string;
  periodEnd?: string;
  paidAt: string;
  paidBy?: string;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  stock: number;
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
  exchangeItems?: { productId: string; quantity: number; reason: string }[];
  assignedShopId?: string;
  salesmanId?: string;
  createdAt?: string;
  updatedAt?: string;
  branch?: string;
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

export interface VanInventory {
  id: string; // usually van_userId
  userId: string;
  items: Record<string, number>; // productId -> quantity
  lastUpdated: string;
}

export interface Settlement {
  id: string;
  userId: string;
  userName: string;
  date: string;
  totalCash: number;
  totalCredit: number;
  totalSales: number;
  vanStock: { productId: string; quantity: number }[];
  status: 'Pending' | 'Verified';
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
