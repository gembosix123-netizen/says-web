'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import MonthlyReportSupabase from '@/components/features/admin/MonthlyReportSupabase';

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

  const dailyReports = useMemo(() => reports.filter((item) => item.date === todayStr), [reports, todayStr]);
  const weeklyReports = useMemo(
    () => reports.filter((item) => item.date >= last7DaysStart && item.date <= todayStr && (item.approvalStage || 'daily') === 'weekly'),
    [reports, last7DaysStart, todayStr]
  );
  const monthlyReports = useMemo(
    () => reports.filter((item) => (item.approvalStage || 'daily') === 'monthly'),
    [reports]
  );
  const dailyQueue = useMemo(
    () => dailyReports.filter((item) => ['submitted_daily', 'approved_daily', 'returned_daily', 'draft'].includes(item.status)),
    [dailyReports]
  );

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
      totalSales: weeklyReports.reduce((sum, item) => sum + Number(item.totalSales || 0), 0),
      totalCash: weeklyReports.reduce((sum, item) => sum + Number(item.totalCash || 0), 0),
      totalCredit: weeklyReports.reduce((sum, item) => sum + Number(item.totalCredit || 0), 0),
      totalReports: weeklyReports.length,
    };
  }, [weeklyReports]);

  const handleOpenReportPdf = (row: DailyReport) => {
    const expenseRows = Array.isArray(row.expenseLines) ? row.expenseLines : [];
    const format = (value: number | undefined) => (Number(value || 0) > 0 ? Number(value || 0).toFixed(2) : '');
    const totalAll = Number(row.totalCash || 0) + Number(row.totalTransfer || 0) + Number(row.totalCredit || 0);
    const proofLinks = {
      cash: Array.isArray(row.cashProofUrls) ? row.cashProofUrls : [],
      banking: Array.isArray(row.bankSlipUrls) ? row.bankSlipUrls : [],
      expenses: expenseRows.flatMap((line) => (Array.isArray(line.receiptImageUrls) ? line.receiptImageUrls : [])),
    };
    const expenseDisplayRows = [
      { label: 'Expenses Sales', value: expenseRows.reduce((sum, item) => sum + Number(item.amount || 0), 0) },
      ...expenseRows.slice(0, 4).map((item) => ({ label: item.description, value: Number(item.amount || 0) })),
      { label: 'Balance PTCash', value: Number(row.balancePtCashManual || 0) },
    ];
    const renderSalesRows = (
      rows: Array<{ customer: string; item: string; qn: number | string; price: number | string; amount: number | string; billNo: string }>
    ) => {
      const normalizedRows = Array.isArray(rows) ? rows : [];
      const hasAnyValue = normalizedRows.some(
        (r) => (r.customer || r.item || r.billNo || Number(r.amount || 0) > 0 || Number(r.qn || 0) > 0)
      );
      const effectiveRows = hasAnyValue
        ? normalizedRows
        : [{ customer: '', item: '', qn: '', price: '', amount: '', billNo: '' }];
      const filledRows = effectiveRows
        .map((r, idx) => `<tr><td>${idx + 1}</td><td>${r.customer || ''}</td><td>${r.item || ''}</td><td>${r.qn || ''}</td><td>${r.price || ''}</td><td>${r.amount || ''}</td><td>${r.billNo || ''}</td><td></td></tr>`)
        .join('');
      const minRows = 8;
      const blanksNeeded = Math.max(0, minRows - effectiveRows.length);
      const blankRows = Array.from({ length: blanksNeeded })
        .map(() => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>')
        .join('');
      return `${filledRows}${blankRows}`;
    };
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Daily Report ${row.date}</title>
          <style>
            body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 18px; }
            .header { text-align: center; margin-bottom: 12px; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
            th, td { border: 1px solid #8a8a8a; padding: 4px; }
            th { background: #dbeafe; }
            .sectionTitle { font-size: 10px; font-weight: bold; text-transform: uppercase; text-align: center; background: #bfdbfe; }
            .proofs { margin-top: 12px; font-size: 10px; }
            .proofs h4 { margin: 6px 0; font-size: 10px; }
            .toolbar { margin-bottom: 10px; display: flex; gap: 8px; }
            .toolbar button { font-size: 11px; padding: 6px 10px; }
            @media print { .toolbar { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button onclick="window.print()">Print / Save PDF</button>
          </div>
          <div class="header">
            <h2>Daily Sales Report</h2>
            <h2>Data</h2>
          </div>
          <div class="meta">
            <div>Tarikh: ${row.date}<br/>Staff: ${row.userName}</div>
            <div>Kawasan: ${row.branch}<br/>Status: ${row.status}</div>
          </div>

          <table>
            <thead><tr><th colspan="8" class="sectionTitle">Cash Sales</th></tr><tr><th>No</th><th>Customer</th><th>Item</th><th>QN</th><th>Price</th><th>Amount</th><th>Bill No</th><th>PO By</th></tr></thead>
            <tbody>${renderSalesRows(row.salesSnapshot?.cashSales || [])}</tbody>
          </table>
          <table>
            <thead><tr><th colspan="8" class="sectionTitle">Transfer Sales</th></tr><tr><th>No</th><th>Customer</th><th>Item</th><th>QN</th><th>Price</th><th>Amount</th><th>Bill No</th><th>PO By</th></tr></thead>
            <tbody>${renderSalesRows(row.salesSnapshot?.transferSales || [])}</tbody>
          </table>
          <table>
            <thead><tr><th colspan="8" class="sectionTitle">Credit Terms Customer</th></tr><tr><th>No</th><th>Customer</th><th>Item</th><th>QN</th><th>Price</th><th>Amount</th><th>Bill No</th><th>PO By</th></tr></thead>
            <tbody>${renderSalesRows(row.salesSnapshot?.creditSales || [])}</tbody>
          </table>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <table>
              <thead><tr><th>Descriptions</th><th style="width:120px;">Amount (RM)</th></tr></thead>
              <tbody>
                ${expenseDisplayRows.map((item, idx) => `<tr><td>${idx + 1}. ${item.label}</td><td style="text-align:right;">${format(item.value)}</td></tr>`).join('')}
              </tbody>
            </table>
            <table>
              <thead><tr><th>Sales</th><th style="width:120px;">Amount (RM)</th></tr></thead>
              <tbody>
                <tr><td>Cash</td><td style="text-align:right;">${format(Number(row.totalCash || 0))}</td></tr>
                <tr><td>Transfer</td><td style="text-align:right;">${format(Number(row.totalTransfer || 0))}</td></tr>
                <tr><td>Credit</td><td style="text-align:right;">${format(Number(row.totalCredit || 0))}</td></tr>
                <tr><td><b>Total</b></td><td style="text-align:right;"><b>${format(totalAll)}</b></td></tr>
                <tr><td><b>Amount Banking</b></td><td style="text-align:right;"><b>${format(Number(row.amountBankingManual || 0))}</b></td></tr>
              </tbody>
            </table>
          </div>

          <div class="proofs">
            <h4>Lampiran Bukti (asing dari borang PDF)</h4>
            <div>Cash Proof: ${proofLinks.cash.length > 0 ? proofLinks.cash.map((url, idx) => `<a href="${url}" target="_blank">Cash ${idx + 1}</a>`).join(' | ') : 'Tiada'}</div>
            <div>Banking Slip: ${proofLinks.banking.length > 0 ? proofLinks.banking.map((url, idx) => `<a href="${url}" target="_blank">Bank ${idx + 1}</a>`).join(' | ') : 'Tiada'}</div>
            <div>Resit Expenses: ${proofLinks.expenses.length > 0 ? proofLinks.expenses.map((url, idx) => `<a href="${url}" target="_blank">Resit ${idx + 1}</a>`).join(' | ') : 'Tiada'}</div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
  };

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
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-xl font-semibold text-white">Daily Report (Hari Ini)</h3>
            <span className="rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
              {dailyQueue.length} laporan
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Stat label="Jumlah Sales" value={formatMoney(dailySummary.totalSales)} />
            <Stat label="Tunai" value={formatMoney(dailySummary.totalCash)} />
            <Stat label="Kredit" value={formatMoney(dailySummary.totalCredit)} />
            <Stat label="Bil. Laporan" value={String(dailySummary.totalReports)} />
          </div>
          <ReportTable
            rows={dailyQueue}
            loading={loading}
            emptyText="Tiada laporan harian untuk hari ini."
            onOpenReportPdf={handleOpenReportPdf}
          />
        </section>
      )}

      {tab === 'weekly' && (
        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-xl font-semibold text-white">Weekly Report (7 Hari Terakhir)</h3>
            <span className="rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
              {weeklyReports.length} laporan
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Stat label="Jumlah Sales" value={formatMoney(weeklySummary.totalSales)} />
            <Stat label="Tunai" value={formatMoney(weeklySummary.totalCash)} />
            <Stat label="Kredit" value={formatMoney(weeklySummary.totalCredit)} />
            <Stat label="Bil. Laporan" value={String(weeklySummary.totalReports)} />
          </div>
          <ReportTable
            rows={weeklyReports}
            loading={loading}
            emptyText="Tiada laporan mingguan."
            onOpenReportPdf={handleOpenReportPdf}
          />
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
          <ReportTable
            rows={monthlyReports}
            loading={loading}
            emptyText="Tiada laporan month-end."
            onOpenReportPdf={handleOpenReportPdf}
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

function ReportTable({
  rows,
  loading,
  emptyText,
  onOpenReportPdf,
}: {
  rows: DailyReport[];
  loading: boolean;
  emptyText: string;
  onOpenReportPdf: (row: DailyReport) => void;
}) {
  const [activeExpenseKey, setActiveExpenseKey] = useState<string | null>(null);

  if (loading) return <p className="text-slate-400 text-sm">Memuatkan laporan...</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/40">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-700">
          <tr>
            <th className="px-2 py-2 text-left">Tarikh / Masa</th>
            <th className="px-2 py-2 text-left">Source</th>
            <th className="px-2 py-2 text-left">PDF</th>
            <th className="px-2 py-2 text-left">Bukti</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-b border-slate-800 text-slate-300">
              <td className="px-2 py-3" colSpan={4}>{emptyText}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-800 text-slate-200 align-top hover:bg-slate-900/40 transition-colors">
                <td className="px-2 py-2 min-w-[130px]">
                  <div className="text-xs text-slate-100">{row.date}</div>
                  <div className="text-xs text-slate-400">{formatDateTime(row.updatedAt || row.submittedAt)}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{row.userName} · {row.branch}</div>
                </td>
                <td className="px-2 py-2 min-w-[90px]">
                  <span className="rounded bg-slate-700 px-2 py-1 text-xs uppercase">
                    {row.source || 'manual'}
                  </span>
                </td>
                <td className="px-2 py-2 min-w-[84px]">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenReportPdf(row)}
                      className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
                    >
                      Open PDF
                    </button>
                  </div>
                </td>
                <td className="px-2 py-2 min-w-[290px]">
                  {(() => {
                    const cashCount = Array.isArray(row.cashProofUrls) ? row.cashProofUrls.length : 0;
                    const bankCount = Array.isArray(row.bankSlipUrls) ? row.bankSlipUrls.length : 0;
                    const expenseCount = Array.isArray(row.expenseLines) ? row.expenseLines.length : 0;
                    const receiptCount = Array.isArray(row.expenseLines)
                      ? row.expenseLines.reduce((sum, line) => sum + (Array.isArray(line.receiptImageUrls) ? line.receiptImageUrls.length : 0), 0)
                      : 0;
                    return (
                      <details className="rounded-md border border-slate-700 bg-slate-900/60">
                        <summary className="cursor-pointer list-none px-2 py-1.5 flex items-center justify-between">
                          <span className="text-[11px] text-slate-200">
                            Cash: {cashCount} | Bank: {bankCount} | Expenses: {expenseCount} | Resit: {receiptCount}
                          </span>
                          <span className="text-[11px] text-slate-400">Lihat</span>
                        </summary>
                        <div className="px-2 pb-2 space-y-1.5 border-t border-slate-700">
                          <div className="pt-1.5 flex flex-wrap gap-1">
                            {(row.cashProofUrls || []).map((url, idx) => (
                              <button
                                key={`${row.id}-cash-${idx}`}
                                type="button"
                                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                                className="rounded bg-emerald-700/80 px-2 py-0.5 text-[10px] text-white"
                              >
                                Cash {idx + 1}
                              </button>
                            ))}
                            {(row.bankSlipUrls || []).map((url, idx) => (
                              <button
                                key={`${row.id}-bank-${idx}`}
                                type="button"
                                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                                className="rounded bg-blue-700/80 px-2 py-0.5 text-[10px] text-white"
                              >
                                Bank {idx + 1}
                              </button>
                            ))}
                          </div>
                          <div className="space-y-1">
                            {[
                              {
                                key: `${row.id}-cash-proof`,
                                label: 'Cash',
                                value: Number(row.totalCash || 0),
                                proofs: Array.isArray(row.cashProofUrls) ? row.cashProofUrls : [],
                                color: 'text-emerald-400',
                                buttonClass: 'bg-emerald-700/80',
                              },
                              {
                                key: `${row.id}-bank-proof`,
                                label: 'Amount Banking',
                                value: Number(row.amountBankingManual || 0),
                                proofs: Array.isArray(row.bankSlipUrls) ? row.bankSlipUrls : [],
                                color: 'text-blue-400',
                                buttonClass: 'bg-blue-700/80',
                              },
                              {
                                key: `${row.id}-pt-cash-proof`,
                                label: 'Balance PT Cash',
                                value: Number(row.balancePtCashManual || 0),
                                proofs: Array.isArray(row.cashProofUrls) ? row.cashProofUrls : [],
                                color: 'text-amber-300',
                                buttonClass: 'bg-amber-700/80',
                              },
                            ].map((item) => {
                              const open = activeExpenseKey === item.key;
                              return (
                                <div key={item.key} className="rounded border border-slate-700/70 bg-slate-900/60 px-2 py-1">
                                  <button
                                    type="button"
                                    onClick={() => setActiveExpenseKey(open ? null : item.key)}
                                    className="w-full flex items-center justify-between text-left"
                                  >
                                    <span className="text-[10px] text-slate-200">{item.label}</span>
                                    <span className={`text-[10px] font-semibold ${item.color}`}>{formatMoney(item.value)}</span>
                                  </button>
                                  {open && (
                                    <div className="mt-1 flex flex-wrap gap-1 border-t border-slate-700 pt-1">
                                      {item.proofs.length > 0 ? (
                                        item.proofs.map((url, idx) => (
                                          <button
                                            key={`${item.key}-proof-${idx}`}
                                            type="button"
                                            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                                            className={`rounded px-2 py-0.5 text-[10px] text-white ${item.buttonClass}`}
                                          >
                                            Bukti {idx + 1}
                                          </button>
                                        ))
                                      ) : (
                                        <span className="text-[10px] text-amber-300">Tiada bukti</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {Array.isArray(row.expenseLines) && row.expenseLines.map((line, idx) => {
                            const expenseKey = `${row.id}-exp-${idx}`;
                            const proofs = Array.isArray(line.receiptImageUrls) ? line.receiptImageUrls : [];
                            const isOpen = activeExpenseKey === expenseKey;
                            return (
                              <div key={expenseKey} className="text-[10px] text-slate-300">
                                <button
                                  type="button"
                                  onClick={() => setActiveExpenseKey(isOpen ? null : expenseKey)}
                                  className="text-left underline decoration-dotted text-slate-200 hover:text-white"
                                >
                                  {idx + 1}. {line.description} ({formatMoney(Number(line.amount || 0))})
                                </button>
                                {isOpen && (
                                  <div className="mt-1 flex flex-wrap gap-1 rounded border border-slate-700 bg-slate-900 p-1.5">
                                    {proofs.length > 0 ? (
                                      proofs.map((url, proofIdx) => (
                                        <button
                                          key={`${expenseKey}-proof-${proofIdx}`}
                                          type="button"
                                          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                                          className="rounded bg-indigo-700/80 px-2 py-0.5 text-[10px] text-white hover:bg-indigo-600"
                                        >
                                          Bukti {proofIdx + 1}
                                        </button>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-amber-300">Tiada bukti resit</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
