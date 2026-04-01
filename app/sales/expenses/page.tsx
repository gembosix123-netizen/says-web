'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Plus, Trash2, CheckCircle, Clock, XCircle, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Expense = {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  reject_reason?: string;
};

const CATEGORIES = ['minyak', 'tol', 'parking', 'makan', 'penginapan', 'telefon', 'peralatan', 'lain-lain'];

const STATUS_LABELS = { pending: 'Menunggu', approved: 'Diluluskan', rejected: 'Ditolak', paid: 'Dibayar' };
const STATUS_ICONS = {
  pending: <Clock className="h-4 w-4 text-amber-500" />,
  approved: <CheckCircle className="h-4 w-4 text-green-500" />,
  paid: <CheckCircle className="h-4 w-4 text-blue-500" />,
  rejected: <XCircle className="h-4 w-4 text-red-500" />,
};

async function uploadReceiptImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `expenses/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('sales-receipts')
    .upload(filename, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('sales-receipts').getPublicUrl(filename);
  return data.publicUrl;
}

export default function SalesExpensesPage() {
  const [history, setHistory] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'minyak',
    description: '',
    amount: '',
  });
  const [receipts, setReceipts] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/expenses');
    if (res.ok) {
      const data = await res.json();
      setHistory(data.expenses || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setReceipts((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
  }

  function removeReceipt(index: number) {
    setReceipts((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (receipts.length === 0) {
      alert('Gambar resit wajib! Sila ambil atau muat naik gambar resit sebelum hantar.');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      alert('Sila masukkan jumlah yang betul.');
      return;
    }

    setSubmitting(true);
    setUploadProgress(true);
    try {
      // Upload all receipt images
      const uploadedUrls: string[] = [];
      for (const file of receipts) {
        const url = await uploadReceiptImage(file);
        uploadedUrls.push(url);
      }
      setUploadProgress(false);

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_date: form.expense_date,
          category: form.category,
          description: form.description,
          amount: Number(form.amount),
          receipt_image_urls: uploadedUrls,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setForm({ expense_date: new Date().toISOString().split('T')[0], category: 'minyak', description: '', amount: '' });
        setReceipts([]);
        setPreviews([]);
        fetchHistory();
      } else {
        alert(data.error || 'Ralat semasa hantar permohonan.');
      }
    } catch (err) {
      console.error(err);
      alert('Ralat muat naik gambar. Cuba semula.');
    } finally {
      setSubmitting(false);
      setUploadProgress(false);
    }
  }

  const totalThisMonth = history
    .filter((e) => ['approved', 'paid'].includes(e.status) && e.expense_date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Expenses Saya</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Tambah Expense
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
          <p className="text-xs text-slate-500">Menunggu</p>
          <p className="text-lg font-bold">{history.filter(e => e.status === 'pending').length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-3">
          <p className="text-xs text-slate-500">Diluluskan Bulan Ini</p>
          <p className="text-lg font-bold">RM {totalThisMonth.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3">
          <p className="text-xs text-slate-500">Ditolak</p>
          <p className="text-lg font-bold">{history.filter(e => e.status === 'rejected').length}</p>
        </div>
      </div>

      {/* Submission Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">Hantar Permohonan Expense</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Tarikh</label>
                <input type="date" required value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kategori</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jumlah (RM)</label>
                <input type="number" step="0.01" min="0.01" required value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Keterangan <span className="text-slate-400">(pilihan)</span></label>
                <input type="text" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Contoh: Minyak dari Sandakan ke Kinabatangan"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
              </div>

              {/* Receipt upload — WAJIB */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Gambar Resit <span className="text-red-500">*WAJIB</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Resit ${i + 1}`} className="h-20 w-20 object-cover rounded-lg border" />
                      <button type="button" onClick={() => removeReceipt(i)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="h-20 w-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Camera className="h-6 w-6" />
                    <span className="text-xs mt-1">Tambah</span>
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
                  onChange={handleFileChange} className="hidden" />
                {receipts.length === 0 && (
                  <p className="text-xs text-red-500">Gambar resit diperlukan untuk semua permohonan expense</p>
                )}
              </div>

              {uploadProgress && (
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <Upload className="h-4 w-4 animate-bounce" /> Sedang muat naik gambar...
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submitting || receipts.length === 0}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-semibold text-sm">
                  {submitting ? 'Menghantar...' : 'Hantar Permohonan'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setReceipts([]); setPreviews([]); }}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-2">
        <h2 className="font-semibold text-slate-700 dark:text-slate-300">Sejarah Permohonan</h2>
        {loading ? (
          <p className="text-center text-slate-400 py-8">Memuatkan...</p>
        ) : history.length === 0 ? (
          <p className="text-center text-slate-400 py-8">Tiada rekod lagi. Tambah expense pertama anda!</p>
        ) : (
          history.map((exp) => (
            <div key={exp.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start justify-between gap-3">
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
