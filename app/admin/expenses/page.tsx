'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Eye, FilterX, Search } from 'lucide-react';

type Expense = {
  id: string;
  salesman_name: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  receipt_image_urls: string[];
  reject_reason?: string;
  approved_by_name?: string;
  branch?: string;
};

const CATEGORIES = ['minyak', 'tol', 'parking', 'makan', 'penginapan', 'telefon', 'peralatan', 'lain-lain'];
const STATUS_LABELS: Record<string, string> = { pending: 'Menunggu', approved: 'Diluluskan', rejected: 'Ditolak', paid: 'Dibayar' };
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

function fmt(n: number) { return `RM ${Number(n || 0).toFixed(2)}`; }

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [proofModal, setProofModal] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    const res = await fetch(`/api/expenses?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : (data.expenses || []));
    }
    setLoading(false);
  }, [statusFilter, categoryFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  async function handleAction(action: 'approve' | 'reject' | 'paid', expense: Expense) {
    if (action === 'reject' && !rejectReason.trim()) {
      alert('Sila masukkan sebab penolakan!');
      return;
    }
    setActionLoading(true);
    const res = await fetch('/api/expenses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: expense.id, status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'paid', reject_reason: rejectReason }),
    });
    const data = await res.json();
    if (res.ok) {
      setSelected(null);
      setRejectReason('');
      fetchExpenses();
    } else {
      alert(data.error || 'Ralat berlaku');
    }
    setActionLoading(false);
  }

  const filtered = expenses.filter((e) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!e.salesman_name?.toLowerCase().includes(q) && !e.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPending = expenses.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const totalApproved = expenses.filter((e) => ['approved', 'paid'].includes(e.status)).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Pengurusan Expenses</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Menunggu Kelulusan', value: expenses.filter(e => e.status === 'pending').length, color: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20' },
          { label: 'Jumlah Pending (RM)', value: fmt(totalPending), color: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20' },
          { label: 'Diluluskan', value: expenses.filter(e => ['approved','paid'].includes(e.status)).length, color: 'bg-green-50 border-green-200 dark:bg-green-900/20' },
          { label: 'Jumlah Diluluskan', value: fmt(totalApproved), color: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20' },
        ].map((card) => (
          <div key={card.label} className={`${card.color} border rounded-xl p-3`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="text-lg font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama / keterangan..."
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 w-52"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
          <option value="">Semua Kategori</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        {(statusFilter || categoryFilter || searchQuery) && (
          <button onClick={() => { setStatusFilter(''); setCategoryFilter(''); setSearchQuery(''); }}
            className="text-sm text-slate-500 flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <FilterX className="h-4 w-4" /> Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left">
            <tr>
              {['Tarikh', 'Staff', 'Kategori', 'Keterangan', 'Jumlah', 'Status', 'Bukti', 'Tindakan'].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Memuatkan...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Tiada rekod ditemui</td></tr>
            ) : filtered.map((exp) => (
              <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">{exp.expense_date}</td>
                <td className="px-4 py-3 font-medium">{exp.salesman_name}</td>
                <td className="px-4 py-3 capitalize">{exp.category}</td>
                <td className="px-4 py-3 max-w-xs truncate">{exp.description || '-'}</td>
                <td className="px-4 py-3 font-semibold">{fmt(exp.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[exp.status]}`}>
                    {STATUS_LABELS[exp.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {exp.receipt_image_urls?.length > 0 ? (
                    <button onClick={() => setProofModal(exp.receipt_image_urls[0])}
                      className="text-blue-600 hover:underline flex items-center gap-1 text-xs">
                      <Eye className="h-3 w-3" /> Lihat
                    </button>
                  ) : <span className="text-slate-400 text-xs">Tiada</span>}
                </td>
                <td className="px-4 py-3">
                  {exp.status === 'pending' && (
                    <button onClick={() => setSelected(exp)}
                      className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700">
                      Semak
                    </button>
                  )}
                  {exp.status === 'approved' && (
                    <button onClick={() => handleAction('paid', exp)} disabled={actionLoading}
                      className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50">
                      Tandai Dibayar
                    </button>
                  )}
                  {exp.status === 'rejected' && exp.reject_reason && (
                    <span className="text-xs text-red-500 italic">"{exp.reject_reason}"</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Proof Image Modal */}
      {proofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setProofModal(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setProofModal(null)}
              className="absolute top-2 right-2 text-white bg-black/50 rounded-full p-1 hover:bg-black/80">
              <XCircle className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofModal} alt="Bukti resit" className="w-full rounded-xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}

      {/* Approve/Reject Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold">Semak Permohonan Expenses</h2>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Staff:</span><span className="font-semibold">{selected.salesman_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tarikh:</span><span>{selected.expense_date}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Kategori:</span><span className="capitalize">{selected.category}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Keterangan:</span><span>{selected.description || '-'}</span></div>
              <div className="flex justify-between text-base font-bold border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                <span>Jumlah:</span><span>RM {Number(selected.amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Proof images */}
            {selected.receipt_image_urls?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {selected.receipt_image_urls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Resit ${i + 1}`} onClick={() => setProofModal(url)}
                    className="h-20 w-20 object-cover rounded-lg border cursor-pointer hover:opacity-80" />
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Sebab Penolakan <span className="text-slate-400">(jika tolak, wajib diisi)</span></label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                rows={2} placeholder="Contoh: Resit tidak jelas / kategori salah..."
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => handleAction('approve', selected)} disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 font-semibold">
                <CheckCircle className="h-4 w-4" /> Lulus
              </button>
              <button onClick={() => handleAction('reject', selected)} disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold">
                <XCircle className="h-4 w-4" /> Tolak
              </button>
              <button onClick={() => { setSelected(null); setRejectReason(''); }}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
