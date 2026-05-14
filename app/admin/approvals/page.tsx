'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardCheck, RefreshCw, FileText, ShieldAlert } from 'lucide-react';
import { DailyReportDataTable } from '@/components/features/admin/DailyReportDataTable';
import { StockGrantsPanel } from '@/components/features/admin/StockGrantsPanel';
import { openDailyReportPdfWindow } from '@/lib/dailyReportPdf';
import type { DailyReport } from '@/types';
import { fetchViewerInfo } from '@/lib/clientViewerSession';
import type { NormalizedRole } from '@/lib/roles';

type HqTab = 'laporan' | 'stok';

function isDailyPendingForHq(r: DailyReport): boolean {
  const stage = r.approvalStage || 'daily';
  if (stage !== 'daily') return false;
  const s = String(r.status);
  return s === 'submitted_daily' || s === 'submitted' || s === 'reviewed';
}

function HqApprovalsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [hqTab, setHqTab] = useState<HqTab>('laporan');

  const [viewerRole, setViewerRole] = useState<NormalizedRole | ''>('');
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportsError, setReportsError] = useState<'unauthorized' | null>(null);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [stockPendingCount, setStockPendingCount] = useState<number | null>(null);

  useEffect(() => {
    const raw = (searchParams.get('tab') || '').toLowerCase();
    setHqTab(raw === 'stok' ? 'stok' : 'laporan');
  }, [searchParams]);

  const setHqTabAndUrl = useCallback(
    (tab: HqTab) => {
      setHqTab(tab);
      const url = tab === 'stok' ? '/admin/approvals?tab=stok' : '/admin/approvals';
      router.replace(url, { scroll: false });
    },
    [router]
  );

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    setReportsError(null);
    try {
      const res = await fetch('/api/daily-reports', { cache: 'no-store' });
      if (res.status === 401) {
        setReportsError('unauthorized');
        setReports([]);
        return;
      }
      const data = await res.json().catch(() => ({ reports: [] }));
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const refreshStockPending = useCallback(async () => {
    try {
      const res = await fetch('/api/stock-grants?status=pending', { cache: 'no-store' });
      if (!res.ok) {
        setStockPendingCount(null);
        return;
      }
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data.items) ? data.items : [];
      setStockPendingCount(items.length);
    } catch {
      setStockPendingCount(null);
    }
  }, []);

  useEffect(() => {
    void fetchReports();
    void refreshStockPending();
  }, [fetchReports, refreshStockPending]);

  useEffect(() => {
    void (async () => {
      const { role } = await fetchViewerInfo();
      setViewerRole(role);
    })();
  }, []);

  const pendingDailyForHq = useMemo(
    () =>
      [...reports.filter(isDailyPendingForHq)].sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return String(b.updatedAt || b.submittedAt || '').localeCompare(String(a.updatedAt || a.submittedAt || ''));
      }),
    [reports]
  );

  const putDailyReport = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch('/api/daily-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string }).error || 'Permintaan gagal');
        return false;
      }
      await fetchReports();
      return true;
    },
    [fetchReports]
  );

  const handleApprove = useCallback(
    async (row: DailyReport) => {
      setBusyReportId(row.id);
      try {
        await putDailyReport({ id: row.id, action: 'approve_stage', approvalStage: 'daily' });
      } finally {
        setBusyReportId(null);
      }
    },
    [putDailyReport]
  );

  const handleReject = useCallback(
    async (row: DailyReport) => {
      const notes = window.prompt('Nyatakan sebab penolakan / pulangan:');
      if (!notes?.trim()) return;
      setBusyReportId(row.id);
      try {
        await putDailyReport({
          id: row.id,
          action: 'return_stage',
          approvalStage: 'daily',
          reviewNotes: notes.trim(),
        });
      } finally {
        setBusyReportId(null);
      }
    },
    [putDailyReport]
  );

  const forbidden = viewerRole && viewerRole !== 'Main Admin';

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-400/90">
          <ClipboardCheck size={16} className="text-amber-400" />
          Kelulusan HQ
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pusat kelulusan</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          Pilih <strong className="text-slate-800 dark:text-slate-200">Laporan</strong> atau <strong className="text-slate-800 dark:text-slate-200">Stok</strong> di bar di bawah. Untuk arkib / tab mingguan &amp; bulanan, guna{' '}
          <Link href="/admin/reports" className="text-cyan-600 dark:text-cyan-400 font-medium hover:underline">
            Laporan
          </Link>
          .
        </p>
      </header>

      {/* Mini headbar: gabungan dua aliran kelulusan */}
      <div className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-100/90 dark:bg-slate-900/90 p-1.5 flex flex-wrap gap-1 shadow-sm">
        <button
          type="button"
          onClick={() => setHqTabAndUrl('laporan')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            hqTab === 'laporan'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow ring-1 ring-cyan-500/40'
              : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/60'
          }`}
        >
          <FileText size={18} className={hqTab === 'laporan' ? 'text-cyan-600 dark:text-cyan-400' : ''} />
          Kelulusan laporan
          {pendingDailyForHq.length > 0 ? (
            <span className="rounded-full bg-amber-500/25 dark:bg-amber-500/30 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-200">
              {pendingDailyForHq.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setHqTabAndUrl('stok')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
            hqTab === 'stok'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow ring-1 ring-amber-500/40'
              : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/60'
          }`}
        >
          <ShieldAlert size={18} className={hqTab === 'stok' ? 'text-amber-600 dark:text-amber-400' : ''} />
          Kelulusan stok
          {stockPendingCount !== null && stockPendingCount > 0 ? (
            <span className="rounded-full bg-amber-500/25 dark:bg-amber-500/30 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-200">
              {stockPendingCount}
            </span>
          ) : null}
        </button>
      </div>

      {forbidden ? (
        <div className="rounded-xl border border-rose-700/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          Halaman ini hanya untuk Main Admin.
        </div>
      ) : hqTab === 'stok' ? (
        <div className="rounded-2xl border border-slate-700/80 bg-slate-950 p-4 sm:p-5">
          <StockGrantsPanel />
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 shrink-0">
                <FileText size={22} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Laporan harian — menunggu kelulusan</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Rekod yang admin cawangan sudah hantar ke HQ. <strong>Lulus</strong> atau <strong>Tolak</strong> di jadual.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void fetchReports();
                void refreshStockPending();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <RefreshCw size={14} />
              Muat semula
            </button>
          </div>

          {reportsError === 'unauthorized' && (
            <p className="text-sm text-rose-600 dark:text-rose-300">Sesi tidak sah — log masuk semula.</p>
          )}

          <DailyReportDataTable
            rows={pendingDailyForHq}
            loading={loadingReports}
            emptyText="Tiada laporan harian menunggu kelulusan."
            onOpenReportPdf={(row) => openDailyReportPdfWindow(row as DailyReport)}
            showWorkflow
            viewerRole="Main Admin"
            viewerBranch=""
            busyReportId={busyReportId}
            onApprove={(row) => void handleApprove(row as DailyReport)}
            onReject={(row) => void handleReject(row as DailyReport)}
          />

          <p className="text-[11px] text-slate-500 dark:text-slate-500">
            Draf, tarikh lain, ringkatan diluluskan, laporan mingguan/bulanan —{' '}
            <Link href="/admin/reports" className="text-cyan-600 dark:text-cyan-400 hover:underline">
              Pusat Laporan penuh
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}

export default function HqApprovalsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-slate-500 dark:text-slate-400 text-sm py-8">Memuatkan pusat kelulusan…</div>
      }
    >
      <HqApprovalsPageInner />
    </Suspense>
  );
}
