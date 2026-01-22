import { db } from '@/lib/db';
import AnalyticsDashboard from '@/components/features/admin/AnalyticsDashboard';
import { Transaction, Product, User, StockAudit, Customer } from '@/types';

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Fetch data directly from the database (Server Component)
  const transactions = (await db.transactions.getAll()) as Transaction[];
  const products = (await db.products.getAll()) as Product[];
  const users = (await db.users.getAll()) as User[];
  const stockAudits = (await db.stockAudits.getAll()) as StockAudit[];
  const customers = (await db.customers.getAll()) as Customer[];

  // Filter for sales users only if needed, or pass all
  const salesUsers = users.filter(u => u.role === 'Sales');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-slate-400">Welcome back, here's what's happening with your field sales today.</p>
      </div>
      
      <AnalyticsDashboard 
        transactions={transactions} 
        products={products}
        salesUsers={salesUsers}
        stockAudits={stockAudits}
        customers={customers}
      />
    </div>
  );
}
