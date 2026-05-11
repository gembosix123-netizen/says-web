'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DailyReport } from '@/types';

const EXPENSE_CATS = [
  { value: 'minyak', label: 'Petrol / Diesel' },
  { value: 'makan', label: 'Makan / F&B' },
  { value: 'tol', label: 'Tol / Parking' },
  { value: 'penginapan', label: 'Penginapan' },
  { value: 'peralatan', label: 'Peralatan' },
  { value: 'lain-lain', label: 'Lain-lain' },
];

type Line = {
  category: string;
  description: string;
  amount: string;
  receiptImageUrls: string[];
  newFiles: File[];
};

async function uploadProof(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('sales-receipts')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return supabase.storage.from('sales-receipts').getPublicUrl(path).data.publicUrl;
}

function linesFromReport(report: DailyReport): Line[] {
  const raw = Array.isArray(report.expenseLines) ? report.expenseLines : [];
  if (raw.length === 0) {
    return [{ category: 'lain-lain', description: '', amount: '', receiptImageUrls: [], newFiles: [] }];
  }
  return raw.map((l) => ({
    category: l.category || 'lain-lain',
    description: l.description || '',
    amount: String(l.amount ?? ''),
    receiptImageUrls: Array.isArray(l.receiptImageUrls) ? [...l.receiptImageUrls] : [],
    newFiles: [],
  }));
}

export function BranchDailyReportPanel({
  report,
  onSaved,
}: {
  report: DailyReport;
  onSaved: () => void;
}) {
  const [lines, setLines] = useState<Line[]>(() => linesFromReport(report));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLines(linesFromReport(report));
    setMessage(null);
  }, [report.id, report.updatedAt]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const folder = `branch-expenses/${report.date}/${report.id}`;
      const payloadLines: DailyReport['expenseLines'] = [];
      for (const line of lines) {
        const amt = Number(line.amount);
        if (amt <= 0 && line.receiptImageUrls.length === 0 && line.newFiles.length === 0) continue;
        const uploaded = await Promise.all(line.newFiles.map((f) => uploadProof(f, folder)));
        const urls = [...line.receiptImageUrls, ...uploaded];
        if (amt > 0 && urls.length === 0) {
          setMessage(`Sila muat naik resit untuk: ${line.description || 'baris'}`);
          setSaving(false);
          return;
        }
        payloadLines.push({
          category: line.category,
          description: line.description || EXPENSE_CATS.find((c) => c.value === line.category)?.label || 'Perbelanjaan',
          amount: amt,
          receiptImageUrls: urls,
        });
      }

      const res = await fetch('/api/daily-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: report.id,
          action: 'save_branch_report',
          expenseLines: payloadLines,
          bankSlipUrls: report.bankSlipUrls,
          cashProofUrls: report.cashProofUrls,
          amountBankingManual: report.amountBankingManual,
          balancePtCashManual: report.balancePtCashManual,
          totalTransfer: report.totalTransfer,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((data as { error?: string }).error || 'Gagal simpan');
        setSaving(false);
        return;
      }
      setMessage('Perbelanjaan disimpan ke dalam laporan.');
      onSaved();
    } catch (e) {
      console.error(e);
      setMessage('Ralat semasa simpan');
    } finally {
      setSaving(false);
    }
  }, [lines, onSaved, report]);

  return (
    <div className="rounded-xl border border-slate-600 bg-slate-900/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-white">Perbelanjaan (admin cawangan)</h4>
        <span className="text-[10px] text-slate-500 font-mono">{report.userName}</span>
      </div>
      <p className="text-[11px] text-slate-400">
        Isi baris perbelanjaan, muat naik resit, kemudian klik <strong className="text-slate-300">Simpan ke laporan</strong>.
        Selepas itu gunakan <strong className="text-slate-300">Hantar ke Main Admin</strong> pada jadual.
      </p>
      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
        {lines.map((line, i) => (
          <div key={i} className="rounded-lg border border-slate-700 p-2 space-y-1.5 bg-slate-950/50">
            <div className="flex flex-wrap gap-2">
              <select
                value={line.category}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, category: e.target.value } : x))
                  )
                }
                className="text-[11px] rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
              >
                {EXPENSE_CATS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Keterangan"
                value={line.description}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, description: e.target.value } : x))
                  )
                }
                className="flex-1 min-w-[120px] text-[11px] rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="RM"
                value={line.amount}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x))
                  )
                }
                className="w-24 text-[11px] rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[10px] text-slate-400 cursor-pointer">
                <span className="rounded bg-slate-700 px-2 py-0.5 text-white">Resit</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    setLines((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, newFiles: [...x.newFiles, ...files] } : x))
                    );
                    e.target.value = '';
                  }}
                />
              </label>
              {line.receiptImageUrls.length + line.newFiles.length > 0 && (
                <span className="text-[10px] text-slate-500">
                  {line.receiptImageUrls.length} URL, {line.newFiles.length} fail baharu
                </span>
              )}
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-auto text-rose-400 p-1"
                  title="Buang"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setLines((prev) => [...prev, { category: 'lain-lain', description: '', amount: '', receiptImageUrls: [], newFiles: [] }])}
        className="text-[11px] flex items-center gap-1 text-blue-400 hover:text-blue-300"
      >
        <Plus size={14} /> Tambah baris
      </button>
      {message && <p className="text-xs text-amber-200/90">{message}</p>}
      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Simpan ke laporan
      </button>
    </div>
  );
}
