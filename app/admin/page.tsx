import AnalyticsDashboard from '@/components/features/admin/AnalyticsDashboard';
import { getAdminAnalyticsData } from '@/lib/adminAnalyticsData';

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { transactions, products, salesUsers, stockAudits, customers } = await getAdminAnalyticsData();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-slate-400">Welcome back, here&apos;s what&apos;s happening with your field sales today.</p>
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
