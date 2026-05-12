import { db } from '@/lib/db';
import type { DailyReport } from '@/types';

/**
 * Rekod laporan harian jurujual (`source: sales`) — sama stor dengan
 * GET /api/daily-reports?source=sales (perpustakaan).
 * **Hanya import dari kod server** (API routes / Route Handlers); jangan dari `'use client'`.
 */
export async function getSalesSourceDailyReportsForUser(userId: string): Promise<DailyReport[]> {
  const all = (await db.dailyReports.getAll()) as DailyReport[];
  return all.filter((r) => r.userId === userId && r.source === 'sales');
}
