import AnalyticsDashboard from '@/components/features/admin/AnalyticsDashboard';
import { getAdminAnalyticsData } from '@/lib/adminAnalyticsData';
import AdminBranchHeader from '@/components/AdminBranchHeader';

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { transactions, products, salesUsers, stockAudits, customers } = await getAdminAnalyticsData();

  return (
    <div className="max-w-7xl mx-auto">
      <AdminBranchHeader titleKey="overview" subtitleKey="admin_welcome_subtitle" />
      
      <AnalyticsDashboard 
        transactions={transactions} 
        products={products}
        salesUsers={salesUsers}
        stockAudits={stockAudits}
        customers={customers}
        branchScope="all"
      />
    </div>
  );
}
