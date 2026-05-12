'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BarChart2, RefreshCw, X } from 'lucide-react';
import MonthlyReportSupabase from '@/components/features/admin/MonthlyReportSupabase';
import { DailyReportDataTable } from '@/components/features/admin/DailyReportDataTable';
import { BranchDailyReportPanel } from '@/components/features/admin/BranchDailyReportPanel';
import { openDailyReportPdfWindow } from '@/lib/dailyReportPdf';
import type { DailyReport } from '@/types';
import { normalizeRole, type NormalizedRole } from '@/lib/roles';
import { fetchViewerInfo } from '@/lib/clientViewerSession';

type ReportTab = 'daily' | 'weekly' | 'monthly';

function toLocalDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ms-MY');
}

export default function AdminReportsHub() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ReportTab>('daily');
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyViewDate, setDailyViewDate] = useState(() => toLocalDateInput(new Date()));
  const [viewerRole, setViewerRole] = useState<NormalizedRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchPanelReportId, setBranchPanelReportId] = useState<string | null>(null);
  const [detailsReport, setDetailsReport] = useState<DailyReport | null>(null);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [reportsLoadError, setReportsLoadError] = useState<'unauthorized' | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setReportsLoadError(null);
    try {
      const res = await fetch('/api/daily-reports', { cache: 'no-store' });
      if (res.status === 401) {
        setReportsLoadError('unauthorized');
        setReports([]);
        return;
      }
      const data = await res.json().catch(() => ({ reports: [] }));
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports();
  }, []);

  useEffect(() => {
    void (async () => {
      const { role } = await fetchViewerInfo();
      setViewerRole(role);
    })();
  }, []);

  useEffect(() => {
    const rawTab = searchParams.get('tab');
    if (rawTab === 'daily' || rawTab === 'weekly' || rawTab === 'monthly') {
      setTab(rawTab);
    }
  }, [searchParams]);

  const todayStr = toLocalDateInput(new Date());
  const last7DaysStart = toLocalDateInput(new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)));

  /** Laporan harian (workflow daily) untuk tarikh pilihan — bukan hanya “hari ini”. */
  const dailyReports = useMemo(
    () =>
      reports.filter(
        (item) =>
          item.date === dailyViewDate && (item.approvalStage || 'daily') === 'daily'
      ),
    [reports, dailyViewDate]
  );

  /** 7 hari lepas: semua hantaran peringkat harian (bukan laporan “weekly stage” kosong). */
  const rollingWeekDailyReports = useMemo(
    () =>
      reports.filter(
        (item) =>
          item.date >= last7DaysStart &&
          item.date <= todayStr &&
          (item.approvalStage || 'daily') === 'daily'
      ),
    [reports, last7DaysStart, todayStr]
  );

  /** Peringkat kelulusan mingguan (jarang) — diasingkan daripada gelung 7 hari. */
  const weeklyStageReports = useMemo(
    () => reports.filter((item) => item.approvalStage === 'weekly'),
    [reports]
  );
  const monthlyReports = useMemo(
    () => reports.filter((item) => (item.approvalStage || 'daily') === 'monthly'),
    [reports]
  );
  /** Semua nilai status yang sah untuk rekod laporan — elak laporan “hilang” jika legacy/konflik status vs peringkat. */
  const allowedDailyStatuses = useMemo(
    () =>
      new Set<string>([
        'draft',
        'submitted_daily',
        'approved_daily',
        'returned_daily',
        'submitted_weekly',
        'approved_weekly',
        'returned_weekly',
        'submitted_monthly',
        'approved_monthly',
        'returned_monthly',
        'submitted',
        'reviewed',
        'approved',
        'returned',
      ]),
    []
  );

  const dailyQueue = useMemo(
    () => dailyReports.filter((item) => allowedDailyStatuses.has(String(item.status))),
    [dailyReports, allowedDailyStatuses]
  );

  const filteredDailyQueue = useMemo(() => {
    if (statusFilter === 'all') return dailyQueue;
    return dailyQueue.filter((item) => String(item.status) === statusFilter);
  }, [dailyQueue, statusFilter]);

  const branchPanelReport = useMemo(
    () => reports.find((r) => r.id === branchPanelReportId) ?? null,
    [reports, branchPanelReportId]
  );

  /** Semua hantaran peringkat harian (untuk jadual “terkini”) — max 50, tarikh paling baru dahulu. */
  const recentDailyAllDates = useMemo(() => {
    const rows = reports.filter(
      (item) => (item.approvalStage || 'daily') === 'daily' && allowedDailyStatuses.has(String(item.status))
    );
    return [...rows]
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return String(b.updatedAt || b.submittedAt || '').localeCompare(String(a.updatedAt || a.submittedAt || ''));
      })
      .slice(0, 50);
  }, [reports, allowedDailyStatuses]);

  /** Tarikh yang ada sekurang-kurangnya satu laporan harian (untuk cip pantas). */
  const datesWithDailyData = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if ((r.approvalStage || 'daily') === 'daily' && allowedDailyStatuses.has(String(r.status))) {
        set.add(r.date);
      }
    });
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [reports, allowedDailyStatuses]);

  /** Selepas ada data: sekali sahaja — jika tarikh pilihan tiada rekod tetapi ada tarikh lain, lompat ke yang terbaru. */
  const didAlignInitialDate = useRef(false);
  useEffect(() => {
    if (loading || didAlignInitialDate.current) return;
    if (datesWithDailyData.length === 0) return;
    didAlignInitialDate.current = true;
    if (!datesWithDailyData.includes(dailyViewDate)) {
      const fallback =
        datesWithDailyData.includes(todayStr) ? todayStr : datesWithDailyData[0];
      setDailyViewDate(fallback);
    }
  }, [loading, datesWithDailyData, dailyViewDate, todayStr]);

  const dailyApprovedRows = useMemo(
    () => dailyReports.filter((item) => item.status === 'approved_daily'),
    [dailyReports]
  );

  const dailySummary = useMemo(() => {
    return {
      totalSales: dailyApprovedRows.reduce((sum, item) => sum + Number(item.totalSales || 0), 0),
      totalCash: dailyApprovedRows.reduce((sum, item) => sum + Number(item.totalCash || 0), 0),
      totalCredit: dailyApprovedRows.reduce((sum, item) => sum + Number(item.totalCredit || 0), 0),
      totalReports: dailyApprovedRows.length,
    };
  }, [dailyApprovedRows]);

  const rollingWeekApproved = useMemo(
    () => rollingWeekDailyReports.filter((item) => item.status === 'approved_daily'),
    [rollingWeekDailyReports]
  );

  const weeklySummary = useMemo(() => {
    return {
      totalSales: rollingWeekApproved.reduce((sum, item) => sum + Number(item.totalSales || 0), 0),
      totalCash: rollingWeekApproved.reduce((sum, item) => sum + Number(item.totalCash || 0), 0),
      totalCredit: rollingWeekApproved.reduce((sum, item) => sum + Number(item.totalCredit || 0), 0),
      totalReports: rollingWeekApproved.length,
    };
  }, [rollingWeekApproved]);

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

  const handleSendToHQ = useCallback(
    async (row: DailyReport) => {
      if (!window.confirm('Hantar laporan ini ke Main Admin untuk kelulusan akhir?')) return;
      setBusyReportId(row.id);
      try {
        const ok = await putDailyReport({
          id: row.id,
          action: 'submit_stage',
          approvalStage: 'daily',
        });
        if (ok) setBranchPanelReportId(null);
      } finally {
        setBusyReportId(null);
      }
    },
    [putDailyReport]
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

  const showWorkflow = viewerRole === 'Admin' || viewerRole === 'Main Admin';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'daily', label: 'Daily Report' },
            { key: 'weekly', label: 'Weekly Report' },
            { key: 'monthly', label: 'Monthly Report' },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === item.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'daily' && (
        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Laporan harian</h3>
              <p className="text-xs text-slate-400 mt-1">
                Filter mengikut <strong className="text-slate-300">tarikh laporan</strong> (bukan semestinya hari ini). Jika kosong, data mungkin
                pada tarikh lain — guna cip di bawah atau jadual &quot;Terkini&quot;.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchReports()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
                title="Muat semula dari pelayan"
              >
                <RefreshCw size={14} className="opacity-80" />
                Muat semula
              </button>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Tarikh
                <input
                  type="date"
                  value={dailyViewDate}
                  onChange={(e) => setDailyViewDate(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => setDailyViewDate(todayStr)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
              >
                Hari ini
              </button>
              {datesWithDailyData[0] && datesWithDailyData[0] !== dailyViewDate && (
                <button
                  type="button"
                  onClick={() => setDailyViewDate(datesWithDailyData[0])}
                  className="rounded-lg border border-amber-600/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200 hover:bg-amber-900/50"
                >
                  Tarikh terakhir ada data ({datesWithDailyData[0]})
                </button>
              )}
              <span className="rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
                {filteredDailyQueue.length} laporan
              </span>
            </div>
          </div>

          {showWorkflow && (
            <div className="rounded-lg border border-sky-800/50 bg-sky-950/35 px-3 py-2.5 text-[11px] text-sky-100/90 leading-relaxed">
              <strong className="text-sky-200">Aliran:</strong> pada baris <strong>Draf</strong> / <strong>Tolak</strong> (pulangan),{' '}
              <strong>Isi perbelanjaan</strong> dahulu, simpan ke laporan, kemudian <strong>Hantar ke Main Admin</strong>{' '}
              (butang aktif selepas simpan perbelanjaan). <strong>Main Admin:</strong> tapis <strong>Pending</strong>, kemudian{' '}
              <strong>Lulus</strong> / <strong>Tolak</strong> pada lajur Tindakan.
            </div>
          )}

          {reportsLoadError === 'unauthorized' && (
            <div className="rounded-lg border border-rose-700/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
              <strong className="text-rose-200">Sesi tidak sah atau tamat tempoh.</strong> API laporan memerlukan kuki log masuk — muat semula
              halaman selepas log masuk, atau{' '}
              <Link href="/login" className="underline font-medium text-rose-50 hover:text-white">
                log masuk semula
              </Link>
              . Tanpa itu, senarai akan sentiasa kosong walaupun data wujud di Vercel.
            </div>
          )}

          {datesWithDailyData.length > 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
              <p className="text-[11px] text-slate-500 mb-1.5">Tarikh yang ada hantaran dalam sistem:</p>
              <div className="flex flex-wrap gap-1.5">
                {datesWithDailyData.slice(0, 20).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDailyViewDate(d)}
                    className={`rounded-md px-2 py-0.5 text-xs font-mono border transition-colors ${
                      d === dailyViewDate
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {dailyQueue.length === 0 && !loading && recentDailyAllDates.length > 0 && (
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100/95">
              Tiada rekod untuk <span className="font-mono font-semibold">{dailyViewDate}</span>, tetapi sistem ada{' '}
              {recentDailyAllDates.length} laporan harian pada tarikh lain. Klik cip tarikh di atas atau rujuk jadual
              &quot;Terkini&quot; di bawah.
            </div>
          )}

          {dailyQueue.length === 0 && !loading && recentDailyAllDates.length === 0 && !reportsLoadError && (
            <div className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-3 text-sm text-slate-300 space-y-2">
              <p>
                Tiada laporan harian dipulangkan untuk akaun/cawangan ini. Semak perkara berikut:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs">
                <li>
                  <strong className="text-slate-300">Localhost vs Vercel:</strong> data tidak dikongsi — localhost guna fail{' '}
                  <code className="text-slate-300">data/</code> (atau Redis tempatan), production Vercel guna KV/Redis production. Hantaran di Vercel{' '}
                  <strong className="text-slate-300">tidak akan muncul</strong> pada dev server melainkan anda salin data atau uji pada URL production yang sama.
                </li>
                <li>
                  <strong className="text-slate-300">Admin cawangan:</strong> anda hanya nampak laporan yang{' '}
                  <code className="text-slate-300">branch</code> sepadan dengan cawangan anda (Main Admin nampak semua).
                </li>
                <li>
                  <strong className="text-slate-300">Tarikh:</strong> laporan dikumpul ikut tarikh borang — pilih tarikh yang sama atau guna cip / jadual &quot;Terkini&quot; di bawah.
                </li>
                <li>
                  Staff perlu hantar dari <strong className="text-slate-300">Jualan → Laporan harian</strong>; data disimpan di app/KV,{' '}
                  <strong className="text-slate-300">bukan</strong> sekadar jadual jualan Supabase.
                </li>
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-slate-700/60 bg-slate-950/30 px-3 py-2 mb-1">
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="font-medium text-slate-300">Apa kad ini?</span> Jumlah{' '}
              <strong className="text-slate-200">Jumlah Sales / Tunai / Kredit</strong> di bawah adalah{' '}
              <strong className="text-emerald-200/90">laporan harian yang sudah diluluskan (Main Admin)</strong> untuk{' '}
              <span className="font-mono text-amber-200/90">{dailyViewDate}</span> sahaja — bukan jumlah live dari
              Supabase.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Stat label="Jumlah Sales (diluluskan)" value={formatMoney(dailySummary.totalSales)} />
            <Stat label="Tunai (diluluskan)" value={formatMoney(dailySummary.totalCash)} />
            <Stat label="Kredit (diluluskan)" value={formatMoney(dailySummary.totalCredit)} />
            <Stat label="Bil. Laporan diluluskan" value={String(dailySummary.totalReports)} />
          </div>

          {showWorkflow && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500">Tapis status:</span>
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'draft', label: 'Draf' },
                  { id: 'submitted_daily', label: 'Pending' },
                  { id: 'approved_daily', label: 'Lulus' },
                  { id: 'returned_daily', label: 'Tolak' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStatusFilter(chip.id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium border transition-colors ${
                    statusFilter === chip.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {branchPanelReport &&
            showWorkflow &&
            (branchPanelReport.status === 'draft' || branchPanelReport.status === 'returned_daily') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">
                    Panel perbelanjaan: <span className="text-white font-mono">{branchPanelReport.date}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setBranchPanelReportId(null)}
                    className="text-[11px] text-slate-500 hover:text-white"
                  >
                    Tutup panel
                  </button>
                </div>
                <BranchDailyReportPanel report={branchPanelReport} onSaved={() => void fetchReports()} />
              </div>
            )}

          <DailyReportDataTable
            rows={filteredDailyQueue}
            loading={loading}
            emptyText={`Tiada laporan untuk tarikh ${dailyViewDate}${statusFilter !== 'all' ? ' (tapis semasa)' : ''}.`}
            onOpenReportPdf={(row) => openDailyReportPdfWindow(row as DailyReport)}
            showWorkflow={showWorkflow}
            viewerRole={viewerRole}
            busyReportId={busyReportId}
            onEditBranchExpenses={(row) => setBranchPanelReportId(row.id)}
            onSendToHQ={(row) => void handleSendToHQ(row as DailyReport)}
            onApprove={(row) => void handleApprove(row as DailyReport)}
            onReject={(row) => void handleReject(row as DailyReport)}
            onDetails={(row) => setDetailsReport(row as DailyReport)}
          />

          {recentDailyAllDates.length > 0 && (
            <div className="pt-4 border-t border-slate-700 space-y-2">
              <h4 className="text-sm font-semibold text-slate-200">Laporan harian terkini (semua tarikh)</h4>
              <p className="text-xs text-slate-500">
                Senarai pantas 50 hantaran terbaru — sentiasa ada data di sini jika pangkalan tidak kosong.
              </p>
              <DailyReportDataTable
                rows={recentDailyAllDates}
                loading={loading}
                emptyText="Tiada data."
                onOpenReportPdf={(row) => openDailyReportPdfWindow(row as DailyReport)}
                showWorkflow={showWorkflow}
                viewerRole={viewerRole}
                busyReportId={busyReportId}
                onEditBranchExpenses={(row) => setBranchPanelReportId(row.id)}
                onSendToHQ={(row) => void handleSendToHQ(row as DailyReport)}
                onApprove={(row) => void handleApprove(row as DailyReport)}
                onReject={(row) => void handleReject(row as DailyReport)}
                onDetails={(row) => setDetailsReport(row as DailyReport)}
              />
            </div>
          )}

          {detailsReport && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
              <div className="max-w-lg w-full rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-lg font-semibold text-white">Butiran laporan</h4>
                  <button
                    type="button"
                    onClick={() => setDetailsReport(null)}
                    className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800"
                    aria-label="Tutup"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-slate-300">
                  {detailsReport.userName} · {detailsReport.branch}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  {detailsReport.date} · Status: {String(detailsReport.status)}
                </p>
                {detailsReport.returnedReason && (
                  <p className="text-xs text-rose-300">Sebab: {detailsReport.returnedReason}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      openDailyReportPdfWindow(detailsReport);
                    }}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Buka PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsReport(null)}
                    className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'weekly' && (
        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 space-y-4 shadow-sm">
          <div className="rounded-xl border border-indigo-600/40 bg-indigo-950/30 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart2 size={18} className="text-indigo-400" />
                Laporan mingguan penuh (penggal ISO, Excel / PDF)
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Gunakan halaman khas untuk ringkasan mingguan berkualiti — berbeza daripada senarai hantaran harian di bawah.
              </p>
            </div>
            <Link
              href="/admin/weekly-reports"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Buka Laporan Mingguan
            </Link>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-xl font-semibold text-white">Hantaran harian (7 hari lepas)</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ringkasan semua laporan peringkat harian dalam tujuh hari terakhir.
              </p>
            </div>
            <span className="rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
              {rollingWeekDailyReports.length} laporan
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Stat label="Jumlah Sales (diluluskan)" value={formatMoney(weeklySummary.totalSales)} />
            <Stat label="Tunai (diluluskan)" value={formatMoney(weeklySummary.totalCash)} />
            <Stat label="Kredit (diluluskan)" value={formatMoney(weeklySummary.totalCredit)} />
            <Stat label="Bil. Laporan diluluskan" value={String(weeklySummary.totalReports)} />
          </div>
          <DailyReportDataTable
            rows={rollingWeekDailyReports}
            loading={loading}
            emptyText="Tiada laporan harian dalam tempoh 7 hari lepas."
            onOpenReportPdf={(row) => openDailyReportPdfWindow(row as DailyReport)}
            showWorkflow={showWorkflow}
            viewerRole={viewerRole}
            busyReportId={busyReportId}
            onEditBranchExpenses={(row) => setBranchPanelReportId(row.id)}
            onSendToHQ={(row) => void handleSendToHQ(row as DailyReport)}
            onApprove={(row) => void handleApprove(row as DailyReport)}
            onReject={(row) => void handleReject(row as DailyReport)}
            onDetails={(row) => setDetailsReport(row as DailyReport)}
          />

          {weeklyStageReports.length > 0 && (
            <div className="pt-4 border-t border-slate-700 space-y-2">
              <h4 className="text-sm font-semibold text-slate-200">Kelulusan peringkat mingguan</h4>
              <DailyReportDataTable
                rows={weeklyStageReports}
                loading={loading}
                emptyText="Tiada rekod."
                onOpenReportPdf={(row) => openDailyReportPdfWindow(row as import('@/types').DailyReport)}
              />
            </div>
          )}
        </section>
      )}

      {tab === 'monthly' && (
        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-xl font-semibold text-white">Monthly End Approval</h3>
            <span className="rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
              {monthlyReports.length} laporan
            </span>
          </div>
          <DailyReportDataTable
            rows={monthlyReports}
            loading={loading}
            emptyText="Tiada laporan month-end."
            onOpenReportPdf={(row) => openDailyReportPdfWindow(row as import('@/types').DailyReport)}
          />
          <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-3">
            <MonthlyReportSupabase />
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
