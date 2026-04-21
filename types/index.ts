export type Role = 'Super Admin' | 'Main Admin' | 'Admin' | 'Sales' | 'Merchandiser';

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

export interface KPITierRule {
  minSales: number;
  maxSales?: number | null;
  payout: number;
}

export interface CommissionPolicy {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'draft' | 'active' | 'archived';
  branch: 'Kota Kinabalu' | 'Kinabatangan' | 'HQ' | 'all';
  cashCommissionRate: number;
  creditCommissionRate: number;
  marginCommissionEnabled: boolean;
  marginCommissionPerUnit?: number;
  kpiTiers: KPITierRule[];
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  stock: number;
  current_stock?: number;
  sku?: string;
  code?: string;
  branch?: 'Kota Kinabalu' | 'Kinabatangan' | 'HQ' | string;
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
  amount?: number;
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
  salesmanName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  branch?: string;
  invoice?: string;
  receiptNo?: string | null;
  billingRefNo?: string | null;
  transferRefNo?: string | null;
  qrTxnRefNo?: string | null;
  paymentReferenceNo?: string | null;
  receiptUrl?: string | null;
  proofPhotoUrl?: string | null;
  proofPhotoUrls?: string[] | null;
  paymentStatus?: 'paid' | 'pending' | 'partial' | 'cancelled';
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

export interface DailyReport {
  id: string;
  userId: string;
  userName: string;
  branch: 'Kota Kinabalu' | 'Kinabatangan' | 'HQ';
  date: string;
  totalSales: number;
  totalCash: number;
  totalCredit: number;
  totalTransfer?: number;
  amountBankingManual?: number;
  balancePtCashManual?: number;
  expenseLines?: {
    category: string;
    description: string;
    amount: number;
    receiptImageUrls?: string[];
  }[];
  expensesTotal?: number;
  bankSlipUrls?: string[];
  cashProofUrls?: string[];
  salesSnapshot?: {
    cashSales?: {
      customer: string;
      item: string;
      qn: number | string;
      price: number | string;
      amount: number | string;
      billNo: string;
    }[];
    transferSales?: {
      customer: string;
      item: string;
      qn: number | string;
      price: number | string;
      amount: number | string;
      billNo: string;
    }[];
    creditSales?: {
      customer: string;
      item: string;
      qn: number | string;
      price: number | string;
      amount: number | string;
      billNo: string;
    }[];
  };
  status:
    | 'draft'
    | 'submitted_daily'
    | 'approved_daily'
    | 'returned_daily'
    | 'submitted_weekly'
    | 'approved_weekly'
    | 'returned_weekly'
    | 'submitted_monthly'
    | 'approved_monthly'
    | 'returned_monthly'
    | 'submitted'
    | 'reviewed'
    | 'approved'
    | 'returned';
  source: 'manual' | 'settlement' | 'sales' | 'merch';
  settlementId?: string;
  approvalStage?: 'daily' | 'weekly' | 'monthly';
  liveSalesRefs?: string[];
  returnedReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  submittedAt: string;
  approvedDailyAt?: string;
  approvedDailyBy?: string;
  approvedWeeklyAt?: string;
  approvedWeeklyBy?: string;
  approvedMonthlyAt?: string;
  approvedMonthlyBy?: string;
  weeklySubmittedAt?: string;
  monthlySubmittedAt?: string;
  updatedAt: string;
}

export interface MonthlyReportDailyEntry {
  date: string;
  amount: number;
  transactions: number;
  branch: string;
}

export interface MonthlyReportBranchSummary {
  branch: string;
  totalRevenue: number;
  transactionCount: number;
  avgTransaction: number;
  topProduct: string;
}

export interface MonthlyReportTopProduct {
  name: string;
  quantity: number;
}

export interface MonthlyReportSnapshot {
  month: string;
  totalRevenue: number;
  totalTransactions: number;
  dailyData: MonthlyReportDailyEntry[];
  branchSummaries: MonthlyReportBranchSummary[];
  topProducts: MonthlyReportTopProduct[];
}

export interface MonthlyReportHistory {
  id: string;
  month: string;
  branch: string;
  status: 'draft' | 'closed';
  submittedAt: string;
  submittedBy: string;
  submittedById?: string;
  notes?: string;
  snapshot: MonthlyReportSnapshot;
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
