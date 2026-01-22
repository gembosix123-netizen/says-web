import { db } from '@/lib/db';
import AnalyticsDashboard from '@/components/features/admin/AnalyticsDashboard';
import { Transaction, Product, User, StockAudit, Customer } from '@/types';

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic';

export default async function KinabatanganPage() {
  // Fetch data
  const transactions = (await db.transactions.getAll()) as Transaction[];
  const products = (await db.products.getAll()) as Product[];
  const users = (await db.users.getAll()) as User[];
  const stockAudits = (await db.stockAudits.getAll()) as StockAudit[];
  const customers = (await db.customers.getAll()) as Customer[];

  // Filter for Kinabatangan
  const BRANCH_NAME = 'Kinabatangan';

  const branchTransactions = transactions.filter(t => t.branch === BRANCH_NAME);
  const branchUsers = users.filter(u => u.branch === BRANCH_NAME && u.role === 'Sales');
  const branchCustomers = customers.filter(c => c.branch === BRANCH_NAME);
  
  // Filter audits based on customer branch
  const branchStockAudits = stockAudits.filter(audit => {
      const customer = customers.find(c => c.id === audit.customerId);
      return customer?.branch === BRANCH_NAME;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            Kinabatangan Dashboard
        </h1>
        <p className="text-slate-400">Real-time sales monitoring for Kinabatangan branch.</p>
      </div>
      
      <AnalyticsDashboard 
        transactions={branchTransactions} 
        products={products}
        salesUsers={branchUsers}
        stockAudits={branchStockAudits}
        customers={branchCustomers}
      />
    </div>
  );
}
