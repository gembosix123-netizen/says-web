import AnalyticsDashboard from '@/components/features/admin/AnalyticsDashboard';
import { getAdminAnalyticsData } from '@/lib/adminAnalyticsData';

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic';

export default async function KinabatanganPage() {
  const BRANCH_NAME = 'Kinabatangan';
  const { transactions, products, salesUsers, stockAudits, customers } = await getAdminAnalyticsData(BRANCH_NAME);

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
        transactions={transactions} 
        products={products}
        salesUsers={salesUsers}
        stockAudits={stockAudits}
        customers={customers}
      />
    </div>
  );
}
