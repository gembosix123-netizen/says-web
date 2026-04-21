'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { RefreshCw, Printer, ExternalLink } from 'lucide-react';
import { normalizeRole } from '@/lib/roles';

// ─── helpers ────────────────────────────────────────────────────────────────

function getPaymentLabel(method?: string | null) {
  const map: Record<string, string> = {
    cash: 'Tunai',
    bill_to_bill: 'Kredit (Bill-to-Bill)',
    bank_transfer: 'Pindahan Bank',
    qr_code: 'QR Code',
    card: 'Kad',
  };
  return map[method ?? ''] ?? method ?? '–';
}

function getSalesUser(sale: Transaction & { salesmanName?: string | null; payment_method?: string | null }) {
  if (sale.salesmanName && sale.salesmanName.trim()) return sale.salesmanName;
  return 'Nama staff tidak direkodkan';
}

function getRef(sale: Transaction & { receiptNo?: string | null; billingRefNo?: string | null; transferRefNo?: string | null; qrTxnRefNo?: string | null; paymentReferenceNo?: string | null }) {
  return sale.receiptNo || sale.billingRefNo || sale.transferRefNo || sale.qrTxnRefNo || sale.paymentReferenceNo || '–';
}

function getCustomerName(sale: Transaction & { customer_name?: string | null }) {
  return (typeof sale.customer === 'object' ? sale.customer?.name : null) ?? sale.customer_name ?? '–';
}

function fmtTime(iso?: string | null) {
  if (!iso) return '–';
  return new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getProofPhotos(sale: { proofPhotoUrl?: string | null; proofPhotoUrls?: string[] | null }) {
  const urls = Array.isArray(sale.proofPhotoUrls) ? sale.proofPhotoUrls.filter(Boolean) : [];
  if (urls.length > 0) return urls;
  return sale.proofPhotoUrl ? [sale.proofPhotoUrl] : [];
}

// ─── types ───────────────────────────────────────────────────────────────────

type Sale = Transaction & {
  salesmanName?: string | null;
  payment_method?: string | null;
  paymentStatus?: string | null;
  customer_name?: string | null;
  area?: string | null;
  invoice?: string | null;
  receiptNo?: string | null;
  billingRefNo?: string | null;
  transferRefNo?: string | null;
  qrTxnRefNo?: string | null;
  paymentReferenceNo?: string | null;
  proofPhotoUrl?: string | null;
  proofPhotoUrls?: string[] | null;
  transactionDate?: string | null;
};

type QuickRange = 'day' | 'week' | 'month' | 'overall';

function getSaleDate(sale: Sale): Date | null {
  const raw = sale.transactionDate || sale.createdAt || null;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinQuickRange(sale: Sale, range: QuickRange) {
  if (range === 'overall') return true;
  const saleDate = getSaleDate(sale);
  if (!saleDate) return false;

  const now = new Date();

  if (range === 'day') {
    return saleDate.toDateString() === now.toDateString();
  }

  if (range === 'week') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(now.getDate() - 6);
    return saleDate >= start && saleDate <= now;
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return saleDate >= startOfMonth && saleDate <= now;
}

function normalizePaymentCategory(method?: string | null) {
  const value = String(method || '').toLowerCase();
  if (value === 'bill_to_bill') return 'credit';
  if (value === 'bank_transfer') return 'transfer';
  if (value === 'qr_code') return 'qr';
  if (value === 'card') return 'card';
  return 'cash';
}

function normalizeOutstandingStatus(sale: Sale) {
  const status = String(sale.paymentStatus || sale.status || '').toLowerCase().trim();
  if (status.includes('pending')) return 'unpaid';
  if (status === 'paid' || status === 'completed') return 'paid';
  if (normalizePaymentCategory(sale.payment_method ?? sale.payment?.method) === 'credit') return 'unpaid';
  return 'paid';
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function AdminLiveSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [branch, setBranch] = useState('all');
  const [salesStaff, setSalesStaff] = useState('all');
  const [area, setArea] = useState('all');
  const [paymentCategory, setPaymentCategory] = useState('all');
  const [outstandingStatus, setOutstandingStatus] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [quickRange, setQuickRange] = useState<QuickRange>('overall');
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!response.ok) return;

        const user = await response.json();
        const normalized = normalizeRole(user?.role || '');

        if (normalized === 'Admin' && user?.branch) {
          setBranch(String(user.branch));
        }
      } catch (error) {
        console.error('Failed to load user context for live sales filters:', error);
      }
    };

    void getCurrentUser();
  }, []);

  const load = useCallback(async (spinner = true) => {
    if (spinner) setLoading(true);
    try {
      const q = branch !== 'all' ? `?branch=${encodeURIComponent(branch)}` : '';
      const res = await fetch(`/api/sales${q}`, { cache: 'no-store' });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error ?? 'Gagal memuatkan data');
      const rows: Sale[] = Array.isArray(data) ? data : [];
      setSales(rows);
      setSynced(new Date().toISOString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [branch]);

  // initial load & reload on branch change
  useEffect(() => {
    void load();
  }, [load]);

  // realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`live-sales-admin-${branch}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_transactions' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => void load(false), 400);
      })
      .subscribe(status => setLive(status === 'SUBSCRIBED'));

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [branch, load]);

  // 60s polling fallback
  useEffect(() => {
    const id = setInterval(() => void load(false), 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    setSalesStaff('all');
    setArea('all');
  }, [branch]);

  const areaOptions = React.useMemo(() => {
    const unique = new Set<string>();
    sales.forEach((sale) => {
      const value = String(sale.area || '').trim();
      if (value) unique.add(value);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [sales]);

  const salesStaffOptions = React.useMemo(() => {
    const unique = new Map<string, string>();

    sales.forEach((sale) => {
      const label = getSalesUser(sale);
      const key = sale.salesmanId ? `id:${sale.salesmanId}` : `name:${label}`;
      if (!unique.has(key)) {
        unique.set(key, label);
      }
    });

    return Array.from(unique.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sales]);

  const baseFilteredSales = React.useMemo(() => {
    return sales.filter((sale) => {
      if (salesStaff !== 'all') {
        const label = getSalesUser(sale);
        const key = sale.salesmanId ? `id:${sale.salesmanId}` : `name:${label}`;
        if (key !== salesStaff) return false;
      }

      if (area !== 'all') {
        const saleArea = String(sale.area || '').trim();
        if (saleArea !== area) return false;
      }

      if (paymentCategory !== 'all') {
        const category = normalizePaymentCategory(sale.payment_method ?? sale.payment?.method);
        if (category !== paymentCategory) return false;
      }

      if (!isWithinQuickRange(sale, quickRange)) {
        return false;
      }

      return true;
    });
  }, [sales, salesStaff, area, paymentCategory, quickRange]);

  const filteredSales = React.useMemo(() => {
    if (outstandingStatus === 'all') return baseFilteredSales;
    return baseFilteredSales.filter((sale) => normalizeOutstandingStatus(sale) === outstandingStatus);
  }, [baseFilteredSales, outstandingStatus]);

  const tallySummary = React.useMemo(() => {
    let unpaidCount = 0;
    let paidCount = 0;
    let unpaidAmount = 0;
    let paidAmount = 0;

    baseFilteredSales.forEach((sale) => {
      const amount = Number(sale.total ?? 0);
      if (normalizeOutstandingStatus(sale) === 'unpaid') {
        unpaidCount += 1;
        unpaidAmount += amount;
      } else {
        paidCount += 1;
        paidAmount += amount;
      }
    });

    const totalCount = unpaidCount + paidCount;
    const collectionRate = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

    return {
      unpaidCount,
      paidCount,
      unpaidAmount,
      paidAmount,
      collectionRate,
    };
  }, [baseFilteredSales]);

  const totalRevenue = filteredSales.reduce((s, r) => s + Number(r.total ?? 0), 0);

  const handlePrint = (sale: Sale) => {
    const win = window.open('', '_blank', 'width=800,height=700');
    if (!win) return;
    const proofPhotos = getProofPhotos(sale);
    const rows = (sale.items ?? []).map(i => `
      <tr>
        <td>${escHtml(String(i.name ?? ''))}</td>
        <td>${Number(i.quantity ?? 0)}</td>
        <td>RM ${Number(i.price ?? 0).toFixed(2)}</td>
        <td>RM ${(Number(i.quantity ?? 0) * Number(i.price ?? 0)).toFixed(2)}</td>
      </tr>`).join('');
    win.document.write(`<!DOCTYPE html><html lang="ms"><head><meta charset="UTF-8">
      <title>Resit ${escHtml(sale.invoice ?? sale.id)}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:28px;color:#0f172a}
        .sheet{max-width:860px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden}
        .hero{display:flex;justify-content:space-between;gap:24px;padding:24px 28px;background:#0f172a;color:#fff}
        .hero h1{margin:0;font-size:24px}.hero p{margin:6px 0 0;color:#cbd5e1;font-size:13px}
        .doc{text-align:right}.doc .title{font-size:16px;font-weight:800;letter-spacing:.08em}
        .doc .meta{margin-top:10px;font-size:12px;color:#e2e8f0;line-height:1.7}
        .body{padding:24px 28px 28px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px}
        .card{border:1px solid #cbd5e1;border-radius:12px;padding:14px;background:#f8fafc}
        .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px}
        .val{font-weight:700}
        table{width:100%;border-collapse:collapse;margin-top:6px}
        th,td{border-bottom:1px solid #e2e8f0;padding:10px 8px;text-align:left}
        th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#475569;background:#e2e8f0}
        .total-wrap{display:flex;justify-content:flex-end;margin-top:18px}
        .total{min-width:220px;background:#0f172a;color:#fff;padding:14px 18px;border-radius:14px;text-align:right}
        .total .label{font-size:11px;letter-spacing:.08em;color:#cbd5e1;text-transform:uppercase}
        .total .amount{font-size:24px;font-weight:800;margin-top:4px}
        .proof{margin-top:24px}.proof h3{margin:0 0 6px}.proof p{margin:0 0 14px;color:#64748b;font-size:13px}
        .proof-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .proof-card{border:1px solid #cbd5e1;border-radius:14px;padding:10px;background:#fff}
        .proof-card img{width:100%;height:220px;object-fit:cover;border-radius:10px}
        .proof-card span{display:block;margin-top:8px;font-size:12px;color:#475569}
        .foot{margin-top:22px;font-size:11px;color:#64748b}
        @media print{body{background:#fff;padding:0}.sheet{border:none;border-radius:0}}
      </style></head><body>
      <div class="sheet">
        <div class="hero">
          <div>
            <h1>Haja Yanons Industries</h1>
            <p>Slip transaksi lapangan untuk semakan operasi dan pelanggan.</p>
          </div>
          <div class="doc">
            <div class="title">RESIT / INVOIS</div>
            <div class="meta">
              <div>Dokumen: ${escHtml(sale.invoice ?? sale.id)}</div>
              <div>Tarikh: ${escHtml(fmtTime(sale.transactionDate ?? sale.createdAt))}</div>
              <div>Rujukan: ${escHtml(getRef(sale))}</div>
            </div>
          </div>
        </div>
        <div class="body">
          <div class="grid">
            <div class="card"><div class="lbl">Kedai / Pelanggan</div><div class="val">${escHtml(getCustomerName(sale))}</div></div>
            <div class="card"><div class="lbl">Branch</div><div class="val">${escHtml(sale.branch ?? '–')}</div></div>
            <div class="card"><div class="lbl">User Sales</div><div class="val">${escHtml(getSalesUser(sale))}</div></div>
            <div class="card"><div class="lbl">Kaedah Bayaran</div><div class="val">${escHtml(getPaymentLabel(sale.payment_method ?? sale.payment?.method))}</div></div>
          </div>
          <table><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Jumlah</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">Tiada item</td></tr>'}</tbody></table>
          <div class="total-wrap"><div class="total"><div class="label">Jumlah Bayaran</div><div class="amount">RM ${Number(sale.total ?? 0).toFixed(2)}</div></div></div>
          ${proofPhotos.length > 0 ? `<div class="proof"><h3>Bukti Pembayaran</h3><p>${proofPhotos.length} lampiran imej disertakan bersama transaksi ini.</p><div class="proof-grid">${proofPhotos.map((photo, index) => `<div class="proof-card"><img src="${escHtml(photo)}" alt="Bukti ${index + 1}" /><span>Lampiran ${index + 1}</span></div>`).join('')}</div></div>` : ''}
          <div class="foot">Dokumen ini dijana secara automatik untuk rekod jualan branch.</div>
        </div>
      </div>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="min-h-screen soft-page-bg p-6 space-y-6">

      {/* ── header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Live Sales History</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Semua transaksi jualan ikut branch &mdash; realtime, bukti bayaran, user sales &amp; cetakan resit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${live ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300'}`}>
            <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            {live ? 'Realtime aktif' : 'Polling aktif'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {synced ? `Sync: ${new Date(synced).toLocaleTimeString('ms-MY')}` : 'Belum sync'}
          </span>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── primary filter bar ── */}
      <div className="soft-panel p-4 rounded-xl flex flex-wrap items-center gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">Area:</label>
          <select
            value={area}
            onChange={e => setArea(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">Semua Area</option>
            {areaOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">Select Sales Staff:</label>
          <select
            value={salesStaff}
            onChange={e => setSalesStaff(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 min-w-[220px] disabled:opacity-60"
          >
            <option value="all">Semua Sales Staff</option>
            {salesStaffOptions.map((staff) => (
              <option key={staff.key} value={staff.key}>{staff.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4 ml-auto text-sm">
          <span className="text-slate-500 dark:text-slate-400"><span className="font-bold text-slate-900 dark:text-white">{filteredSales.length}</span> rekod</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRevenue)}</span>
        </div>
      </div>

      {/* ── secondary filter bar ── */}
      <div className="soft-panel p-4 rounded-xl flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status Hutang</span>
          {([
            { key: 'all', label: 'Semua' },
            { key: 'unpaid', label: 'Belum Dibayar' },
            { key: 'paid', label: 'Sudah Dibayar' },
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => setOutstandingStatus(item.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                outstandingStatus === item.key
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kategori Payment</span>
          <select
            value={paymentCategory}
            onChange={(e) => setPaymentCategory(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">Semua Kategori</option>
            <option value="cash">Tunai</option>
            <option value="credit">Kredit (Bill-to-Bill)</option>
            <option value="transfer">Pindahan Bank</option>
            <option value="qr">QR Code</option>
            <option value="card">Kad</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Range</span>
          {([
            { key: 'day', label: 'Day' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
            { key: 'overall', label: 'Overall' },
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => setQuickRange(item.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                quickRange === item.key
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── tally summary ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="soft-panel p-4 rounded-xl border border-amber-300/40 dark:border-amber-700/40">
          <p className="text-xs uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-300">Belum Terbayar</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-300">{formatCurrency(tallySummary.unpaidAmount)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tallySummary.unpaidCount} rekod</p>
        </div>
        <div className="soft-panel p-4 rounded-xl border border-emerald-300/40 dark:border-emerald-700/40">
          <p className="text-xs uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300">Sudah Terbayar</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(tallySummary.paidAmount)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tallySummary.paidCount} rekod</p>
        </div>
        <div className="soft-panel p-4 rounded-xl border border-blue-300/40 dark:border-blue-700/40">
          <p className="text-xs uppercase tracking-wide font-semibold text-blue-700 dark:text-blue-300">Kadar Kutipan</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-300">{tallySummary.collectionRate.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Berdasarkan set filter semasa (kecuali status hutang)</p>
        </div>
      </div>

      {/* ── table ── */}
      <div className="soft-panel rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 dark:text-slate-400">
            <RefreshCw size={20} className="animate-spin mr-3" /> Memuatkan…
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-sm">
            Tiada rekod jualan untuk branch ini.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[68vh]">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">No. Invois</th>
                  <th className="px-4 py-3">Kedai / Pelanggan</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">User Sales</th>
                  <th className="px-4 py-3">Masa</th>
                  <th className="px-4 py-3">Kaedah Bayaran</th>
                  <th className="px-4 py-3">Status Hutang</th>
                  <th className="px-4 py-3">No. Rujukan</th>
                  <th className="px-4 py-3">Bukti</th>
                  <th className="px-4 py-3 text-right">Jumlah</th>
                  <th className="px-4 py-3 text-center">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">{sale.invoice || sale.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{getCustomerName(sale)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{sale.area || '–'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">{getSalesUser(sale)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">{fmtTime(sale.transactionDate ?? sale.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-slate-100 dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300">
                        {getPaymentLabel(sale.payment_method ?? sale.payment?.method)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {normalizeOutstandingStatus(sale) === 'unpaid' ? (
                        <span className="inline-block rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300">
                          Belum Dibayar
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                          Sudah Terbayar
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{getRef(sale)}</td>
                    <td className="px-4 py-3 text-center">
                      {getProofPhotos(sale).length > 0 ? (
                        <a href={getProofPhotos(sale)[0]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400">
                          <ExternalLink size={13} /> Lihat {getProofPhotos(sale).length > 1 ? `(${getProofPhotos(sale).length})` : ''}
                        </a>
                      ) : (
                        <span className="text-xs text-amber-500">Tiada</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrency(Number(sale.total ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handlePrint(sale)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        <Printer size={13} /> Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
