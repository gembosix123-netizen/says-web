'use client';

import React, { useState } from 'react';
import type { DailyReport } from '@/types';
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
};

export function DailyReportDataTable({
  rows,
  loading,
  emptyText,
  onOpenReportPdf = openDailyReportPdfWindow,
}: {
  rows: Row[];
  loading: boolean;
  emptyText: string;
  onOpenReportPdf?: (row: Row) => void;
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
              <td className="px-2 py-3" colSpan={4}>
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
