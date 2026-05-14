'use client';

import React, { useState } from 'react';
import type { DailyReport } from '@/types';
import type { NormalizedRole } from '@/lib/roles';
import { openDailyReportPdfWindow } from '@/lib/dailyReportPdf';

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

/** API / JSON rows may omit fields like `expenseLines.category` or widen `branch`. */
type Row = Omit<Partial<DailyReport>, 'branch' | 'expenseLines'> & {
  id: string;
  date: string;
  branch?: string;
  expenseLines?: Array<{
    category?: string;
    description: string;
    amount: number;
    receiptImageUrls?: string[];
  }>;
  status?: string;
  branchExpensesSyncedAt?: string;
};

function statusBadge(st?: string) {
  const s = String(st || '');
  type BadgeCfg = { label: string; className: string; title?: string };
  const map: Record<string, BadgeCfg> = {
    draft: {
      label: 'Draf',
      title: 'Laporan draf cawangan — isi perbelanjaan, kemudian hantar ke Main Admin.',
      className: 'bg-amber-950/60 text-amber-50 border-amber-500/50',
    },
    submitted_daily: {
      label: 'Pending',
      title: 'Menunggu kelulusan Main Admin',
      className: 'bg-orange-950/55 text-orange-100 border-orange-600/50',
    },
    submitted: {
      label: 'Pending',
      title: 'Menunggu kelulusan Main Admin',
      className: 'bg-orange-950/55 text-orange-100 border-orange-600/50',
    },
    reviewed: {
      label: 'Pending',
      title: 'Menunggu kelulusan Main Admin',
      className: 'bg-orange-950/55 text-orange-100 border-orange-600/50',
    },
    approved_daily: {
      label: 'Diluluskan',
      title: 'Laporan telah diluluskan',
      className: 'bg-green-950/65 text-green-50 border-green-500/55 shadow-sm shadow-green-900/20',
    },
    approved: {
      label: 'Diluluskan',
      title: 'Laporan telah diluluskan',
      className: 'bg-green-950/65 text-green-50 border-green-500/55 shadow-sm shadow-green-900/20',
    },
    returned_daily: {
      label: 'Ditolak',
      title: 'Ditolak / dipulangkan ke cawangan',
      className: 'bg-red-950/65 text-red-50 border-red-500/55 shadow-sm shadow-red-900/20',
    },
    returned: {
      label: 'Ditolak',
      title: 'Ditolak / dipulangkan ke cawangan',
      className: 'bg-red-950/65 text-red-50 border-red-500/55 shadow-sm shadow-red-900/20',
    },
  };
  const cfg: BadgeCfg = map[s] || {
    label: s || '-',
    className: 'bg-slate-800 text-slate-200 border-slate-600',
  };
  return (
    <span
      title={cfg.title}
      className={`inline-flex max-w-full items-center justify-center whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold leading-none tracking-wide ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

export function DailyReportDataTable({
  rows,
  loading,
  emptyText,
  onOpenReportPdf = openDailyReportPdfWindow,
  showWorkflow = false,
  viewerRole = '',
  viewerBranch = '',
  busyReportId = null,
  onEditBranchExpenses,
  onSendToHQ,
  onApprove,
  onReject,
  onDetails,
}: {
  rows: Row[];
  loading: boolean;
  emptyText: string;
  onOpenReportPdf?: (row: Row) => void;
  showWorkflow?: boolean;
  viewerRole?: NormalizedRole | '';
  /** Branch admin must have a branch in session to use expense / send-to-HQ actions. */
  viewerBranch?: string;
  busyReportId?: string | null;
  onEditBranchExpenses?: (row: Row) => void;
  onSendToHQ?: (row: Row) => void;
  onApprove?: (row: Row) => void;
  onReject?: (row: Row) => void;
  onDetails?: (row: Row) => void;
}) {
  const [activeExpenseKey, setActiveExpenseKey] = useState<string | null>(null);

  const colCount = showWorkflow ? 6 : 4;

  if (loading) return <p className="text-slate-400 text-sm">Memuatkan laporan...</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/40">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-700">
          <tr>
            <th className="px-2 py-2 text-left">Tarikh / Masa</th>
            <th className="px-2 py-2 text-left">Source</th>
            {showWorkflow && <th className="px-2 py-2 text-left">Status</th>}
            <th className="px-2 py-2 text-left">PDF</th>
            <th className="px-2 py-2 text-left">Bukti</th>
            {showWorkflow && <th className="px-2 py-2 text-left">Tindakan</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-b border-slate-800 text-slate-300">
              <td className="px-2 py-3" colSpan={colCount}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-800 text-slate-200 align-top hover:bg-slate-900/40 transition-colors">
                <td className="px-2 py-2 min-w-[130px]">
                  <div className="text-xs text-slate-100">{row.date}</div>
                  <div className="text-xs text-slate-400">{formatDateTime(row.updatedAt || row.submittedAt)}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {row.userName} · {row.branch}
                  </div>
                </td>
                <td className="px-2 py-2 min-w-[90px]">
                  <span className="rounded bg-slate-700 px-2 py-1 text-xs uppercase">{(row as DailyReport).source || 'manual'}</span>
                </td>
                {showWorkflow && (
                  <td className="px-2 py-2 align-top min-w-[100px]">
                    {statusBadge(String((row as DailyReport).status))}
                  </td>
                )}
                <td className="px-2 py-2 min-w-[84px]">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenReportPdf(row as DailyReport)}
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
                      ? row.expenseLines.reduce(
                          (sum, line) => sum + (Array.isArray(line.receiptImageUrls) ? line.receiptImageUrls.length : 0),
                          0
                        )
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
                          {Array.isArray(row.expenseLines) &&
                            row.expenseLines.map((line, idx) => {
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
                {showWorkflow && (
                  <td className="px-2 py-2 align-top min-w-[120px]">
                    <div className="flex flex-col gap-1">
                      {onDetails && (
                        <button
                          type="button"
                          onClick={() => onDetails(row)}
                          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700"
                        >
                          Semak butiran
                        </button>
                      )}
                      {viewerRole === 'Admin' &&
                        viewerBranch.trim() !== '' &&
                        (row.status === 'draft' || row.status === 'returned_daily') && (
                          <>
                            {onEditBranchExpenses && (
                              <button
                                type="button"
                                disabled={busyReportId === row.id}
                                onClick={() => onEditBranchExpenses(row)}
                                className="rounded bg-amber-700/90 px-2 py-1 text-[10px] font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                              >
                                Isi perbelanjaan
                              </button>
                            )}
                            {onSendToHQ && (
                              <button
                                type="button"
                                disabled={
                                  busyReportId === row.id ||
                                  !(row as DailyReport).branchExpensesSyncedAt
                                }
                                title={
                                  (row as DailyReport).branchExpensesSyncedAt
                                    ? 'Hantar ke Main Admin'
                                    : 'Simpan perbelanjaan ke laporan dahulu'
                                }
                                onClick={() => onSendToHQ(row)}
                                className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                              >
                                Hantar ke Main Admin
                              </button>
                            )}
                          </>
                        )}
                      {viewerRole === 'Main Admin' &&
                        (row.status === 'submitted_daily' ||
                          row.status === 'submitted' ||
                          row.status === 'reviewed') && (
                        <>
                          {onApprove && (
                            <button
                              type="button"
                              disabled={busyReportId === row.id}
                              onClick={() => onApprove(row)}
                              className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              Lulus
                            </button>
                          )}
                          {onReject && (
                            <button
                              type="button"
                              disabled={busyReportId === row.id}
                              onClick={() => onReject(row)}
                              className="rounded bg-rose-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                            >
                              Tolak
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
