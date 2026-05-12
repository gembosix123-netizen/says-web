'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { DailyReport } from '@/types';

function salesReportStatusLabel(status: string): string {
  const s = String(status);
  if (s === 'draft') return 'Draf';
  if (s === 'submitted_daily') return 'Menunggu admin cawangan';
  if (s === 'returned_daily') return 'Dikembalikan — sila betulkan';
  if (s === 'approved_daily') return 'Diluluskan HQ';
  return s;
}

function formatHistoryWhen(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ms-MY', { dateStyle: 'short', timeStyle: 'short' });
}

export default function DailyReportLibraryPage() {
  const router = useRouter();
  const [reportHistory, setReportHistory] = useState<DailyReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const fetchReportHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch('/api/daily-reports?source=sales&approvalStage=daily', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHistoryError(typeof data.error === 'string' ? data.error : 'Gagal muat sejarah');
        setReportHistory([]);
        return;
      }
      const rows: DailyReport[] = Array.isArray(data.reports) ? data.reports : [];
      rows.sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      });
      setReportHistory(rows);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReportHistory();
  }, [fetchReportHistory]);

  const openDateOnMainForm = useCallback((reportDate: string) => {
    router.push(`/sales/daily-report?date=${encodeURIComponent(reportDate)}`);
  }, [router]);

  const handleResendPendingToAdmin = useCallback(
    async (row: DailyReport) => {
      if (String(row.status) !== 'submitted_daily') return;
      setResendingId(row.id);
      setHistoryError(null);
      try {
        const res = await fetch('/api/daily-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: row.date,
            source: 'sales',
            resend: true,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setHistoryError(typeof json.error === 'string' ? json.error : 'Gagal hantar semula');
          return;
        }
        setResendNotice(`Laporan ${row.date} dihantar semula — admin boleh muat semula senarai mereka.`);
        await fetchReportHistory();
        window.setTimeout(() => setResendNotice(null), 8000);
      } finally {
        setResendingId(null);
      }
    },
    [fetchReportHistory]
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/sales/daily-report')}
              className="text-white/60 hover:text-white shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white truncate">Urus laporan harian</h1>
              <p className="text-white/50 text-xs">Sejarah hantaran · hantar semula kepada admin jika perlu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchReportHistory()}
            disabled={historyLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
            Muat semula
          </button>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">
              <History size={18} className="text-slate-200" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Senarai laporan anda</h2>
              <p className="text-slate-400 text-sm">
                Status setiap tarikh. Untuk isi semula atau muat naik bukti, gunakan{' '}
                <Link href="/sales/daily-report" className="text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline">
                  borang laporan harian
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {resendNotice && (
              <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
                {resendNotice}
              </div>
            )}
            {historyError && (
              <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{historyError}</div>
            )}
            {historyLoading && reportHistory.length === 0 ? (
              <p className="text-slate-500 text-sm">Memuat sejarah...</p>
            ) : reportHistory.length === 0 ? (
              <p className="text-slate-500 text-sm">
                Tiada rekod lagi — selepas anda menghantar dari{' '}
                <Link href="/sales/daily-report" className="text-blue-400 hover:underline">
                  halaman laporan harian
                </Link>
                , rekod akan muncul di sini.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-950/80 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-medium">Tarikh</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">Jumlah (RM)</th>
                      <th className="px-4 py-3 font-medium">Kemaskini</th>
                      <th className="px-4 py-3 font-medium text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {reportHistory.map((row) => (
                      <tr key={row.id} className="text-slate-300 hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono text-white">{row.date}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-full border border-slate-600 bg-slate-800/80 px-2.5 py-0.5 text-xs">
                            {salesReportStatusLabel(String(row.status))}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-400">{Number(row.totalSales ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatHistoryWhen(row.updatedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDateOnMainForm(row.date)}
                              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                            >
                              Buka borang
                            </button>
                            {String(row.status) === 'submitted_daily' && (
                              <button
                                type="button"
                                disabled={resendingId === row.id}
                                onClick={() => void handleResendPendingToAdmin(row)}
                                className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-900/50 disabled:opacity-50"
                              >
                                {resendingId === row.id ? 'Menghantar...' : 'Hantar semula'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
