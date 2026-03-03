'use client';

import MonthlyReportSupabase from '@/components/features/admin/MonthlyReportSupabase';

export default function ReportsPage() {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Monthly Reports</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Detailed sales analysis and performance metrics by branch</p>
        </div>
        
        <MonthlyReportSupabase />
      </div>
    </div>
  );
}
