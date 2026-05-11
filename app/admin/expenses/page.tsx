'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  Eye,
  FilterX,
  Search,
  Receipt,
  UserCircle,
  Calendar,
  Building2,
  Loader2,
  Plus,
} from 'lucide-react';
import { normalizeRole, type NormalizedRole } from '@/lib/roles';
import { fetchViewerInfo } from '@/lib/clientViewerSession';
import { supabase } from '@/lib/supabase';

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

type StaffOption = { id: string; name: string; username: string; role: string };

const CATEGORIES = ['minyak', 'tol', 'parking', 'makan', 'penginapan', 'telefon', 'peralatan', 'lain-lain'] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Diluluskan',
  rejected: 'Ditolak',
  paid: 'Dibayar',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

function fmt(n: number) {
  return `RM ${Number(n || 0).toFixed(2)}`;
}

async function uploadReceiptFiles(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `branch-expenses/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from('sales-receipts')
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('sales-receipts').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

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
  const [viewerRole, setViewerRole] = useState<NormalizedRole | ''>('');
  const [viewerBranch, setViewerBranch] = useState('');

  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const [formSalesmanId, setFormSalesmanId] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState<string>('minyak');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formFiles, setFormFiles] = useState<File[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const isMainAdmin = viewerRole === 'Main Admin';
  const isBranchAdmin = viewerRole === 'Admin';

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

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    void (async () => {
      const { role, branch } = await fetchViewerInfo();
      setViewerRole(role);
      setViewerBranch(branch);
    })();
  }, []);

  useEffect(() => {
    if (!isBranchAdmin) return;
    void (async () => {
      setStaffLoading(true);
      try {
        const res = await fetch('/api/users', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json().catch(() => []);
        const arr = Array.isArray(data) ? data : [];
        const salesLike = arr.filter((u: StaffOption) => {
          const r = normalizeRole(u.role);
          return r === 'Sales' || r === 'Merchandiser';
        });
        setStaffList(salesLike);
      } finally {
        setStaffLoading(false);
      }
    })();
  }, [isBranchAdmin]);

  async function handleAction(action: 'approve' | 'reject' | 'paid', expense: Expense) {
    if (action === 'reject' && !rejectReason.trim()) {
      alert('Sila masukkan sebab penolakan!');
      return;
    }
    setActionLoading(true);
    const res = await fetch('/api/expenses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: expense.id,
        status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'paid',
        reject_reason: rejectReason,
      }),
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

  const resetBranchForm = useCallback(() => {
    setFormSalesmanId('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCategory('minyak');
    setFormDescription('');
    setFormAmount('');
    setFormFiles([]);
    setFormMessage(null);
  }, []);

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);
    if (!formSalesmanId) {
      setFormMessage('Sila pilih jurujual.');
      return;
    }
    const amt = Number(formAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFormMessage('Jumlah mesti lebih RM 0.');
      return;
    }
    if (formFiles.length === 0) {
      setFormMessage('Sila muat naik sekurang-kurangnya satu gambar resit.');
      return;
    }
    setFormSubmitting(true);
    try {
      const receipt_image_urls = await uploadReceiptFiles(formFiles);
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesman_id: formSalesmanId,
          category: formCategory,
          description: formDescription.trim() || undefined,
          amount: amt,
          expense_date: formDate,
          receipt_image_urls,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormMessage((data as { error?: string }).error || 'Gagal simpan');
        setFormSubmitting(false);
        return;
      }
      resetBranchForm();
      setFormMessage('Berjaya direkod. Menunggu kelulusan Main Admin.');
      fetchExpenses();
    } catch (err) {
      console.error(err);
      setFormMessage('Ralat muat naik atau simpan. Cuba lagi.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const filtered = expenses.filter((e) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!e.salesman_name?.toLowerCase().includes(q) && !e.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPending = expenses.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const totalApproved = expenses.filter((e) => ['approved', 'paid'].includes(e.status)).reduce((s, e) => s + e.amount, 0);

  const pageTitle = useMemo(() => {
    if (isBranchAdmin) return 'Expenses cawangan';
    if (isMainAdmin) return 'Kelulusan expenses (HQ)';
    return 'Expenses';
  }, [isBranchAdmin, isMainAdmin]);

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="h-7 w-7 text-indigo-500 shrink-0" />
            {pageTitle}
          </h1>
          {isBranchAdmin && viewerBranch && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 shrink-0" />
              Cawangan: <span className="font-medium text-slate-700 dark:text-slate-200">{viewerBranch}</span>
            </p>
          )}
        </div>
      </div>

      {isBranchAdmin && (
        <section className="rounded-2xl border border-indigo-200/60 dark:border-indigo-800/80 bg-gradient-to-br from-indigo-50/90 to-white dark:from-slate-900 dark:to-slate-950 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Rekod perbelanjaan untuk jurujual</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-2xl">
            Isi borang di bawah bagi pihak jurujual cawangan anda. Resit wajib. Selepas simpan, permohonan akan{' '}
            <strong className="text-slate-800 dark:text-slate-200">menunggu kelulusan Main Admin</strong>. Untuk
            perbelanjaan yang dipautkan kepada <em>laporan harian</em> jurujual, gunakan juga{' '}
            <strong>Admin → Laporan</strong> (Isi perbelanjaan pada draf laporan).
          </p>

          <form onSubmit={handleBranchSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                  Jurujual <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserCircle className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <select
                    required
                    value={formSalesmanId}
                    onChange={(e) => setFormSalesmanId(e.target.value)}
                    disabled={staffLoading}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  >
                    <option value="">{staffLoading ? 'Memuatkan senarai…' : '— Pilih jurujual —'}</option>
                    {staffList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.username} ({normalizeRole(u.role)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                    Tarikh perbelanjaan
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                    Kategori
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm capitalize"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                  Keterangan
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Contoh: Minyak rondaan harian"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                  Jumlah (RM) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full max-w-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-right"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                  Gambar resit <span className="text-red-500">*</span>
                </label>
                <label className="flex flex-col items-center justify-center gap-2 min-h-[140px] rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40 cursor-pointer hover:border-indigo-400 transition-colors px-4 py-6">
                  <Plus className="h-8 w-8 text-slate-400" />
                  <span className="text-sm text-slate-600 dark:text-slate-300 text-center">
                    {formFiles.length > 0 ? `${formFiles.length} fail dipilih` : 'Klik atau seret gambar resit'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setFormFiles((prev) => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                </label>
                {formFiles.length > 0 && (
                  <ul className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    {formFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex justify-between gap-2">
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          className="text-rose-600 shrink-0"
                          onClick={() => setFormFiles((prev) => prev.filter((_, j) => j !== i))}
                        >
                          Buang
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {formMessage && (
                <p
                  className={`text-sm rounded-lg px-3 py-2 ${
                    formMessage.startsWith('Berjaya')
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
                  }`}
                >
                  {formMessage}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…
                    </>
                  ) : (
                    'Simpan permohonan'
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetBranchForm}
                  className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Kosongkan
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {isMainAdmin && (
        <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
          Semak permohonan di bawah: <strong>lulus</strong>, <strong>tolak</strong>, atau <strong>tandai dibayar</strong>{' '}
          untuk rekod yang telah diluluskan.
        </p>
      )}

      {!isBranchAdmin && !isMainAdmin && (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Halaman ini untuk <strong>Admin cawangan</strong> (rekod) dan <strong>Main Admin</strong> (kelulusan).
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Menunggu Kelulusan',
            value: expenses.filter((e) => e.status === 'pending').length,
            color: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20',
          },
          {
            label: 'Jumlah Pending (RM)',
            value: fmt(totalPending),
            color: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20',
          },
          {
            label: 'Diluluskan',
            value: expenses.filter((e) => ['approved', 'paid'].includes(e.status)).length,
            color: 'bg-green-50 border-green-200 dark:bg-green-900/20',
          },
          {
            label: 'Jumlah Diluluskan',
            value: fmt(totalApproved),
            color: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20',
          },
        ].map((card) => (
          <div key={card.label} className={`${card.color} border rounded-xl p-3`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="text-lg font-bold mt-1 text-slate-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama / keterangan..."
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 w-52"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800"
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800"
        >
          <option value="">Semua Kategori</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {(statusFilter || categoryFilter || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter('');
              setCategoryFilter('');
              setSearchQuery('');
            }}
            className="text-sm text-slate-500 flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <FilterX className="h-4 w-4" /> Reset
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left">
            <tr>
              {['Tarikh', 'Staff', 'Kategori', 'Keterangan', 'Jumlah', 'Status', 'Bukti', 'Tindakan'].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Memuatkan...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Tiada rekod ditemui
                </td>
              </tr>
            ) : (
              filtered.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">{exp.expense_date}</td>
                  <td className="px-4 py-3 font-medium">{exp.salesman_name}</td>
                  <td className="px-4 py-3 capitalize">{exp.category}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{exp.description || '-'}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(exp.amount)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[exp.status]}`}
                    >
                      {STATUS_LABELS[exp.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {exp.receipt_image_urls?.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setProofModal(exp.receipt_image_urls[0])}
                        className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                      >
                        <Eye className="h-3 w-3" /> Lihat
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">Tiada</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {exp.status === 'pending' && isMainAdmin && (
                      <button
                        type="button"
                        onClick={() => setSelected(exp)}
                        className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700"
                      >
                        Semak
                      </button>
                    )}
                    {exp.status === 'pending' && !isMainAdmin && (
                      <span className="text-xs text-slate-500">Tunggu Main Admin</span>
                    )}
                    {exp.status === 'approved' && isMainAdmin && (
                      <button
                        type="button"
                        onClick={() => handleAction('paid', exp)}
                        disabled={actionLoading}
                        className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        Tandai Dibayar
                      </button>
                    )}
                    {exp.status === 'approved' && !isMainAdmin && <span className="text-xs text-slate-500">—</span>}
                    {exp.status === 'rejected' && exp.reject_reason && (
                      <span className="text-xs text-red-500 italic">&quot;{exp.reject_reason}&quot;</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {proofModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setProofModal(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setProofModal(null)}
              className="absolute top-2 right-2 text-white bg-black/50 rounded-full p-1 hover:bg-black/80"
            >
              <XCircle className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofModal} alt="Bukti resit" className="w-full rounded-xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold">Semak permohonan expenses</h2>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Staff:</span>
                <span className="font-semibold">{selected.salesman_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tarikh:</span>
                <span>{selected.expense_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kategori:</span>
                <span className="capitalize">{selected.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Keterangan:</span>
                <span>{selected.description || '-'}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                <span>Jumlah:</span>
                <span>RM {Number(selected.amount).toFixed(2)}</span>
              </div>
            </div>

            {selected.receipt_image_urls?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {selected.receipt_image_urls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`Resit ${i + 1}`}
                    onClick={() => setProofModal(url)}
                    className="h-20 w-20 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                  />
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Sebab penolakan <span className="text-slate-400">(jika tolak)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                placeholder="Contoh: Resit tidak jelas"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {isMainAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleAction('approve', selected)}
                    disabled={actionLoading}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 font-semibold"
                  >
                    <CheckCircle className="h-4 w-4" /> Lulus
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('reject', selected)}
                    disabled={actionLoading || !rejectReason.trim()}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold"
                  >
                    <XCircle className="h-4 w-4" /> Tolak
                  </button>
                </>
              ) : (
                <p className="text-xs text-slate-500 flex-1">Hanya Main Admin boleh lulus atau menolak.</p>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setRejectReason('');
                }}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
