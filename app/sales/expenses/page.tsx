'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

type Expense = {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  reject_reason?: string;
};

const STATUS_LABELS = { pending: 'Menunggu', approved: 'Diluluskan', rejected: 'Ditolak', paid: 'Dibayar' };
const STATUS_ICONS = {
  pending: <Clock className="h-4 w-4 text-amber-500" />,
  approved: <CheckCircle className="h-4 w-4 text-green-500" />,
  paid: <CheckCircle className="h-4 w-4 text-blue-500" />,
  rejected: <XCircle className="h-4 w-4 text-red-500" />,
};

export default function SalesExpensesPage() {
  const [history, setHistory] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/expenses');
    if (res.ok) {
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : (data.expenses || []));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const totalThisMonth = history
    .filter((e) => ['approved', 'paid'].includes(e.status) && e.expense_date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">Expenses</h1>

      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        Permohonan expense baharu <strong>tidak dibuka untuk jurujual</strong>. Admin cawangan akan rekod perbelanjaan
        bagi pihak anda (contohnya melalui laporan harian). Sejarah di bawah (jika ada) ialah rekod yang telah
        dimasukkan oleh admin / Main Admin.
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
          <p className="text-xs text-slate-500">Menunggu</p>
          <p className="text-lg font-bold">{history.filter((e) => e.status === 'pending').length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-3">
          <p className="text-xs text-slate-500">Diluluskan Bulan Ini</p>
          <p className="text-lg font-bold">RM {totalThisMonth.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3">
          <p className="text-xs text-slate-500">Ditolak</p>
          <p className="text-lg font-bold">{history.filter((e) => e.status === 'rejected').length}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold text-slate-700 dark:text-slate-300">Sejarah</h2>
        {loading ? (
          <p className="text-center text-slate-400 py-8">Memuatkan...</p>
        ) : history.length === 0 ? (
          <p className="text-center text-slate-400 py-8">Tiada rekod expense dalam sistem untuk akaun anda.</p>
        ) : (
          history.map((exp) => (
            <div
              key={exp.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="capitalize font-semibold text-sm">{exp.category}</span>
                  <span className="text-xs text-slate-400">{exp.expense_date}</span>
                </div>
                {exp.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{exp.description}</p>}
                {exp.status === 'rejected' && exp.reject_reason && (
                  <p className="text-xs text-red-500 mt-1 italic">Ditolak: {exp.reject_reason}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className="font-bold text-sm">RM {Number(exp.amount).toFixed(2)}</span>
                <div className="flex items-center gap-1 text-xs">
                  {STATUS_ICONS[exp.status]}
                  <span>{STATUS_LABELS[exp.status]}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
