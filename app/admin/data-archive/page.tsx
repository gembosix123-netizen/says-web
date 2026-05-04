'use client';

import { Suspense } from 'react';
import DatabaseMonitoring from '@/components/features/admin/DatabaseMonitoring';

export default function DataArchivePage() {
  return (
    <div className="space-y-6 p-6">
      <div className="max-w-7xl mx-auto space-y-2">
        <h1 className="text-2xl font-bold text-white">Arkib & sejarah data</h1>
        <p className="text-sm text-slate-400">
          Rekod lepas yang telah dimasukkan sistem: jualan, settlement, laporan harian/mingguan/bulanan. Gunakan carian
          dan muat turun softcopy untuk simpanan.
        </p>
      </div>
      <Suspense fallback={<p className="text-slate-400">Memuatkan arkib...</p>}>
        <DatabaseMonitoring />
      </Suspense>
    </div>
  );
}
