'use client';

import SettlementDashboard from '@/components/features/admin/SettlementDashboard';

export default function AdminExpensesPage() {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Expenses History</h1>
          <p className="text-slate-400 mt-2">Semua rekod expenses/settlement tanpa langkah verify manual</p>
        </div>
        <SettlementDashboard />
      </div>
    </div>
  );
}
