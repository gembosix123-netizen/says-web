import { Suspense } from 'react';
import DatabaseMonitoring from '@/components/features/admin/DatabaseMonitoring';

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-slate-400">Memuatkan pangkalan data...</p>}>
      <DatabaseMonitoring cardNav />
    </Suspense>
  );
}
