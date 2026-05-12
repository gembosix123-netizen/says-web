import type { DailyReport } from '@/types';

/**
 * Helpers perpustakaan laporan harian — **selamat untuk bundle client**
 * (tiada `fs` / `lib/db`). Akses stor penuh: `salesmanDailyReportLibrary.server.ts`.
 */

/** Status di mana paparan jualan pada borang harian patut ikut `salesSnapshot` dalam perpustakaan (bukan agregat semula dari /api/sales). */
export function shouldReadSalesDataFromLibrarySnapshot(status: unknown): boolean {
  const s = String(status || '').trim();
  if (!s || s === 'draft' || s === 'returned_daily') return false;
  const frozen = new Set([
    'submitted_daily',
    'approved_daily',
    'submitted_weekly',
    'approved_weekly',
    'returned_weekly',
    'submitted_monthly',
    'approved_monthly',
    'returned_monthly',
    'submitted',
    'reviewed',
    'approved',
  ]);
  return frozen.has(s);
}

export function snapshotHasSaleRows(snapshot: DailyReport['salesSnapshot'] | null | undefined): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const n = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  return (
    n(snapshot.cashSales) +
      n(snapshot.transferSales) +
      n(snapshot.creditSales) +
      n(snapshot.cashPaidCustomer) >
    0
  );
}
