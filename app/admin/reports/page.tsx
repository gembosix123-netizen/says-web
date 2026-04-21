'use client';

import AdminReportsHub from '@/components/features/admin/AdminReportsHub';

export default function ReportsPage() {
  return (
    <div className="min-h-screen p-6 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Pusat Laporan</h1>
          <p className="text-slate-400 mt-2">Semua laporan harian, mingguan, dan bulanan dalam satu halaman</p>
        </div>

        <AdminReportsHub />
      </div>
    </div>
  );
}
