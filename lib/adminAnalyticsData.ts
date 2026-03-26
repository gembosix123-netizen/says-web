import { supabaseAdmin } from '@/lib/supabase';
import { db } from '@/lib/db';
import { Transaction, Product, User, StockAudit, Customer } from '@/types';
import { getCustomersTableByBranch } from '@/lib/branchPermissions';

type SalesTransactionRow = {
  id: string;
  user_id?: string | null;
  customer_id?: string | null;
  branch?: string | null;
  created_at?: string | null;
  grand_total?: number | string | null;
  status?: string | null;
};

type SalesItemRow = {
  transaction_id: string;
  product_id?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
};

type ProductRow = {
  id: string | number;
  name?: string | null;
  price?: number | string | null;
  unit?: string | null;
  current_stock?: number | string | null;
  stock?: number | string | null;
  code?: string | null;
};

type CustomerRow = {
  id: string | number;
  name?: string | null;
  address?: string | null;
  current_balance?: number | string | null;
  outstandingBalance?: number | string | null;
  branch?: string | null;
};

type UserRow = {
  id: string | number;
  username?: string | null;
  name?: string | null;
  full_name?: string | null;
  role?: string | null;
  branch?: string | null;
  commission_rate?: number | string | null;
};

export async function getAdminAnalyticsData(branch?: string): Promise<{
  transactions: Transaction[];
  products: Product[];
  salesUsers: User[];
  stockAudits: StockAudit[];
  customers: Customer[];
}> {
  const useBranchFilter = Boolean(branch);

  if (!supabaseAdmin) {
    const transactions = (await db.transactions.getAll()) as Transaction[];
    const products = (await db.products.getAll()) as Product[];
    const users = (await db.users.getAll()) as User[];
    const stockAudits = (await db.stockAudits.getAll()) as StockAudit[];
    const customers = (await db.customers.getAll()) as Customer[];

    const filteredTransactions = useBranchFilter
      ? transactions.filter((t) => t.branch === branch)
      : transactions;
    const salesUsers = useBranchFilter
      ? users.filter((u) => u.role === 'Sales' && u.branch === branch)
      : users.filter((u) => u.role === 'Sales');

    return {
      transactions: filteredTransactions,
      products,
      salesUsers,
      stockAudits,
      customers,
    };
  }

  let txQuery = supabaseAdmin.from('sales_transactions').select('*').order('created_at', { ascending: false });
  if (useBranchFilter) {
    txQuery = txQuery.eq('branch', branch);
  }

  // Get the correct customers table based on branch
  const customersTable = getCustomersTableByBranch(branch);

  const [{ data: txRowsRaw, error: txError }, { data: productRows, error: productError }, { data: userRows, error: userError }, { data: customerRows, error: customerError }] = await Promise.all([
    txQuery,
    supabaseAdmin.from('products').select('*'),
    supabaseAdmin.from('users').select('*'),
    supabaseAdmin.from(customersTable).select('*')
  ]);

  if (txError || productError || userError || customerError) {
    const transactions = (await db.transactions.getAll()) as Transaction[];
    const products = (await db.products.getAll()) as Product[];
    const users = (await db.users.getAll()) as User[];
    const stockAudits = (await db.stockAudits.getAll()) as StockAudit[];
    const customers = (await db.customers.getAll()) as Customer[];

    const filteredTransactions = useBranchFilter
      ? transactions.filter((t) => t.branch === branch)
      : transactions;
    const salesUsers = useBranchFilter
      ? users.filter((u) => u.role === 'Sales' && u.branch === branch)
      : users.filter((u) => u.role === 'Sales');

    return {
      transactions: filteredTransactions,
      products,
      salesUsers,
      stockAudits,
      customers,
    };
  }

  const txRows = (txRowsRaw || []) as SalesTransactionRow[];
  const txIds = txRows.map((row) => row.id);

  let itemsByTxId: Record<string, SalesItemRow[]> = {};
  if (txIds.length > 0) {
    const { data: itemRowsRaw } = await supabaseAdmin
      .from('sales_items')
      .select('*')
      .in('transaction_id', txIds);

    const itemRows = (itemRowsRaw || []) as SalesItemRow[];
    itemsByTxId = itemRows.reduce<Record<string, SalesItemRow[]>>((acc, row) => {
      if (!acc[row.transaction_id]) acc[row.transaction_id] = [];
      acc[row.transaction_id].push(row);
      return acc;
    }, {});
  }

  const products = ((productRows || []) as ProductRow[]).map((row) => ({
    id: String(row.id),
    name: String(row.name || ''),
    price: Number(row.price || 0),
    unit: String(row.unit || 'unit'),
    stock: Number(row.current_stock || row.stock || 0),
    code: row.code || undefined,
  })) as Product[];

  const customers = ((customerRows || []) as CustomerRow[]).map((row) => ({
    id: String(row.id),
    name: String(row.name || ''),
    address: String(row.address || ''),
    outstandingBalance: Number(row.current_balance || row.outstandingBalance || 0),
    branch: row.branch || undefined,
  })) as Customer[];

  const users = ((userRows || []) as UserRow[]).map((row) => ({
    id: String(row.id),
    username: String(row.username || ''),
    name: String(row.name || row.full_name || row.username || ''),
    role: String(row.role || 'Sales') as User['role'],
    branch: (row.branch || 'HQ') as User['branch'],
    commissionRate: Number(row.commission_rate || 0),
  })) as User[];

  const salesUsers = useBranchFilter
    ? users.filter((u) => u.role === 'Sales' && u.branch === branch)
    : users.filter((u) => u.role === 'Sales');

  const transactions = txRows.map((row) => {
    const txItems = itemsByTxId[row.id] || [];
    const cartItems = txItems.map((item) => {
      const matchedProduct = products.find((product) => product.id === String(item.product_id || ''));
      return {
        id: String(item.product_id || `item-${row.id}`),
        name: String(item.product_name || matchedProduct?.name || 'Item'),
        price: Number(item.unit_price || matchedProduct?.price || 0),
        unit: matchedProduct?.unit || 'unit',
        stock: matchedProduct?.stock || 0,
        quantity: Number(item.quantity || 0),
      };
    });

    return {
      id: row.id,
      checkInTime: null,
      gps: null,
      customer: null,
      items: cartItems,
      subtotal: Number(row.grand_total || 0),
      payment: { method: 'cash', returnAmount: 0, exchangeAmount: 0, focAmount: 0 },
      total: Number(row.grand_total || 0),
      signatureUrl: null,
      photoUrl: null,
      status: row.status === 'pending' ? 'Pending' : 'Completed',
      salesmanId: row.user_id || undefined,
      createdAt: row.created_at || undefined,
      branch: row.branch || undefined,
    } as Transaction;
  });

  // stock audits remain on existing source if no canonical table is configured
  const stockAudits = (await db.stockAudits.getAll()) as StockAudit[];

  return {
    transactions,
    products,
    salesUsers,
    stockAudits,
    customers,
  };
}
