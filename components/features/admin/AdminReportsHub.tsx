'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BarChart2, RefreshCw } from 'lucide-react';
import MonthlyReportSupabase from '@/components/features/admin/MonthlyReportSupabase';
import { DailyReportDataTable } from '@/components/features/admin/DailyReportDataTable';
import { openDailyReportPdfWindow } from '@/lib/dailyReportPdf';

type DailyReport = {
  id: string;
  userName: string;
  branch: string;
  date: string;
  submittedAt?: string;
  updatedAt?: string;
  totalSales: number;
  totalCash: number;
  totalTransfer?: number;
  totalCredit: number;
  amountBankingManual?: number;
  balancePtCashManual?: number;
  expenseLines?: { description: string; amount: number; receiptImageUrls?: string[] }[];
  bankSlipUrls?: string[];
  cashProofUrls?: string[];
  salesSnapshot?: {
    cashSales?: Array<{ customer: string; item: string; qn: number | string; price: number | string; amount: number | string; billNo: string }>;
    transferSales?: Array<{ customer: string; item: string; qn: number | string; price: number | string; amount: number | string; billNo: string }>;
    creditSales?: Array<{ customer: string; item: string; qn: number | string; price: number | string; amount: number | string; billNo: string }>;
  };
  status:
    | 'draft'
    | 'submitted_daily'
    | 'approved_daily'
    | 'returned_daily'
    | 'submitted_weekly'
    | 'approved_weekly'
    | 'returned_weekly'
    | 'submitted_monthly'
    | 'approved_monthly'
    | 'returned_monthly';
  approvalStage?: 'daily' | 'weekly' | 'monthly';
  source?: 'manual' | 'settlement' | 'sales' | 'merch';
};

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

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/daily-reports', { cache: 'no-store' });
      const data = await res.json().catch(() => ({ reports: [] }));
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReports();
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
  const allowedDailyStatuses = useMemo(
    () =>
      new Set<string>(['submitted_daily', 'approved_daily', 'returned_daily', 'draft', 'submitted', 'reviewed', 'approved', 'returned']),
    []
  );

  const dailyQueue = useMemo(
    () => dailyReports.filter((item) => allowedDailyStatuses.has(String(item.status))),
    [dailyReports, allowedDailyStatuses]
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
      setDailyViewDate(datesWithDailyData[0]);
    }
  }, [loading, datesWithDailyData, dailyViewDate]);

  const dailySummary = useMemo(() => {
    return {
      totalSales: dailyReports.reduce((sum, item) => sum + Number(item.totalSales || 0), 0),
      totalCash: dailyReports.reduce((sum, item) => sum + Number(item.totalCash || 0), 0),
      totalCredit: dailyReports.reduce((sum, item) => sum + Number(item.totalCredit || 0), 0),
      totalReports: dailyReports.length,
    };
  }, [dailyReports]);

  const weeklySummary = useMemo(() => {
    return {
      totalSales: rollingWeekDailyReports.reduce((sum, item) => sum + Number(item.totalSales || 0), 0),
      totalCash: rollingWeekDailyReports.reduce((sum, item) => sum + Number(item.totalCash || 0), 0),
      totalCredit: rollingWeekDailyReports.reduce((sum, item) => sum + Number(item.totalCredit || 0), 0),
      totalReports: rollingWeekDailyReports.length,
    };
  }, [rollingWeekDailyReports]);

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
                {dailyQueue.length} laporan
              </span>
            </div>
          </div>

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

          {dailyQueue.length === 0 && !loading && recentDailyAllDates.length === 0 && (
            <div className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-300">
              Tiada laporan harian dalam pangkalan untuk akaun/cawangan ini. Pastikan staff sudah hantar dari{' '}
              <strong>Jualan → Laporan harian</strong>, dan environment sama (data laporan disimpan di pelayan app / KV,
              bukan jadual jualan Supabase sahaja).
            </div>
          )}

          <div className="rounded-lg border border-slate-700/60 bg-slate-950/30 px-3 py-2 mb-1">
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="font-medium text-slate-300">Apa kad ini?</span> Ia menjumlahkan field{' '}
              <strong className="text-slate-200">laporan harian</strong> yang dihantar staff untuk{' '}
              <span className="font-mono text-amber-200/90">{dailyViewDate}</span> sahaja —{' '}
              <em>bukan</em> jumlah jualan live dari Supabase. Jika RM 0.00, tiada laporan untuk tarikh itu atau jumlah
              memang sifar dalam borang.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Stat label="Jumlah Sales" value={formatMoney(dailySummary.totalSales)} />
            <Stat label="Tunai" value={formatMoney(dailySummary.totalCash)} />
            <Stat label="Kredit" value={formatMoney(dailySummary.totalCredit)} />
            <Stat label="Bil. Laporan" value={String(dailySummary.totalReports)} />
          </div>
          <DailyReportDataTable
            rows={dailyQueue}
            loading={loading}
            emptyText={`Tiada laporan untuk tarikh ${dailyViewDate}.`}
            onOpenReportPdf={(row) => openDailyReportPdfWindow(row as import('@/types').DailyReport)}
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
                onOpenReportPdf={(row) => openDailyReportPdfWindow(row as import('@/types').DailyReport)}
              />
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
            <Stat label="Jumlah Sales" value={formatMoney(weeklySummary.totalSales)} />
            <Stat label="Tunai" value={formatMoney(weeklySummary.totalCash)} />
            <Stat label="Kredit" value={formatMoney(weeklySummary.totalCredit)} />
            <Stat label="Bil. Laporan" value={String(weeklySummary.totalReports)} />
          </div>
          <DailyReportDataTable
            rows={rollingWeekDailyReports}
            loading={loading}
            emptyText="Tiada laporan harian dalam tempoh 7 hari lepas."
            onOpenReportPdf={(row) => openDailyReportPdfWindow(row as import('@/types').DailyReport)}
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
