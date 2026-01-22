import { db } from '@/lib/db';
import MonthlyReport from '@/components/features/admin/MonthlyReport';
import { Transaction, Product } from '@/types';

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  // Fetch data directly from the database (Server Component)
  // In a Supabase setup, this would be: await supabase.from('transactions').select('*')
  const transactions = (await db.transactions.getAll()) as Transaction[];
  const products = (await db.products.getAll()) as Product[];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Monthly Reports</h1>
        <p className="text-slate-400">Detailed sales analysis and performance metrics.</p>
      </div>
      
      <MonthlyReport 
        transactions={transactions} 
        products={products}
      />
    </div>
  );
}
