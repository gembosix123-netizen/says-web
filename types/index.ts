export type Role = 'Super Admin' | 'Admin' | 'Sales' | 'Merchandiser';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
  name: string;
  assignedShopId?: string | null;
  commissionRate?: number; // 0.05 for 5%
  branch: 'Kota Kinabalu' | 'Kinabatangan' | 'HQ';
  allowedStores?: string[]; // For merchandiser: array of customer IDs they can visit
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
  sku?: string;
  code?: string;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  outstandingBalance: number;
  lat?: number;
  lon?: number;
  sales_id?: string;
  branch?: string;
}

export interface Store {
  id: string;
  name: string;
  address?: string;
  branch?: string; // e.g., 'Kota Kinabalu' | 'Kinabatangan'
  createdAt?: string;
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

export interface PaymentData {
  method: 'cash' | 'transfer' | 'credit';
  returnAmount?: number;
  exchangeAmount?: number;
  focAmount?: number;
}

export interface Transaction {
  id: string;
  checkInTime: string | null;
  gps: { lat: number; lon: number } | null;
  customer: Customer | null;
  items: CartItem[];
  subtotal: number;
  payment: PaymentData | null;
  total: number;
  signatureUrl: string | null;
  photoUrl: string | null;
  status: OrderStatus;
  exchangeItems?: { productId: string; quantity: number; reason: string }[];
  assignedShopId?: string;
  salesmanId?: string;
  salesmanName?: string;
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
  status: 'Submitted' | 'Processed';
  branch?: string;
  submittedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Merchandiser-related types
export interface StoreVisit {
  id: string;
  merchandiser_id: string;
  customer_id: string;
  branch: 'Kota Kinabalu' | 'Kinabatangan' | 'HQ';
  
  // Visit tracking
  check_in_time: string; // ISO timestamp
  check_out_time?: string | null;
  gps_lat?: number | null;
  gps_long?: number | null;
  
  // Staff information
  staff_name?: string | null;
  staff_contact?: string | null;
  
  // Visit details
  visit_type?: 'audit' | 'inspection' | 'follow-up';
  status: 'in-progress' | 'completed' | 'cancelled';
  notes?: string | null;
  
  // Photos
  photo_urls?: string[] | null;
  
  // Metadata
  created_at: string;
  updated_at: string;
  
  // Joined data (optional, populated by API)
  customer?: Customer;
  merchandiser?: User;
}

export interface StoreAuditItem {
  id: string;
  visit_id: string;
  product_id: string;
  product_name: string;
  
  // Stock status
  balance_stock: number;
  expired_stock: number;
  damaged_stock: number;
  
  // Condition notes
  condition_notes?: string | null;
  photo_url?: string | null;
  
  created_at: string;
  
  // Joined data (optional)
  product?: Product;
}
