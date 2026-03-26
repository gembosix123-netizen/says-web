import AnalyticsDashboard from '@/components/features/admin/AnalyticsDashboard';
import { getAdminAnalyticsData } from '@/lib/adminAnalyticsData';
import AdminBranchHeader from '@/components/AdminBranchHeader';

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic';

export default async function KinabatanganPage() {
  const BRANCH_NAME = 'Kinabatangan';
  const { transactions, products, salesUsers, stockAudits, customers } = await getAdminAnalyticsData(BRANCH_NAME);

  return (
    <div className="max-w-7xl mx-auto">
      <AdminBranchHeader
        titleKey="kb_dashboard_title"
        subtitleKey="kb_dashboard_subtitle"
        titleClassName="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3"
        icon={<span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />}
      />
      
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
