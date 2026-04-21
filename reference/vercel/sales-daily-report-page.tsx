'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Printer, Calendar, RefreshCw, Upload, CheckCircle, AlertCircle, X, Camera, Send, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface SaleItem {
  id?: string | null;
  productId?: string | null;
  product_id?: string | null;
  name?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  price?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
}

interface SaleRecord {
  id: string;
  customer_name?: string | null;
  customer_id?: string | null;
  created_at?: string;
  createdAt?: string;
  total_amount?: number | null;
  total?: number | null;
  payment_method?: string | null;
  invoice?: string | null;
  items?: SaleItem[] | null;
}

interface ReturnRecord {
  id: string;
  product_name?: string | null;
  product_id?: string | null;
  quantity?: number | null;
  type?: string | null;
  reason?: string | null;
}

interface VanProduct {
  id: string;
  name: string;
  stock?: number;
  current_stock?: number;
  unit?: string;
}

interface SaleRow {
  no: number;
  customer: string;
  item: string;
  qn: number | string;
  price: number | string;
  amount: number | string;
  billNo: string;
}

interface StockRow {
  name: string;
  stockOut: number;
  stockIn: number;
  returned: number;
  exchanged: number;
  foc: number;
}

interface DailyData {
  salesman: string;
  kawasan: string;
  dayName: string;
  dateFormatted: string;
  cashSales: SaleRow[];
  transferSales: SaleRow[];
  creditSales: SaleRow[];
  stockRows: StockRow[];
  totalCash: number;
  totalTransfer: number;
  totalCredit: number;
}

// ─── Expense entry ────────────────────────────────────────────────────────────

interface ExpenseEntry {
  category: string;
  description: string;
  amount: string;
  photos: File[];
  photoPreviews: string[];
}

const EXPENSE_CATS = [
  { value: 'minyak', label: 'Petrol / Diesel' },
  { value: 'makan', label: 'Makan / F&B' },
  { value: 'tol', label: 'Tol / Parking' },
  { value: 'penginapan', label: 'Penginapan' },
  { value: 'peralatan', label: 'Peralatan' },
  { value: 'lain-lain', label: 'Lain-lain' },
];

async function uploadProofPhoto(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('sales-receipts')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return supabase.storage.from('sales-receipts').getPublicUrl(path).data.publicUrl;
}

// ─── Sub-component: Sales Table ───────────────────────────────────────────────

function SalesTable({
  title,
  rows,
  minRows = 14,
}: {
  title: string;
  rows: SaleRow[];
  minRows?: number;
}) {
  const display = [...rows];
  while (display.length < minRows) {
    display.push({ no: 0, customer: '', item: '', qn: '', price: '', amount: '', billNo: '' });
  }

  return (
    <div className="mb-3">
      <div
        className="text-center font-bold py-0.5 uppercase border border-slate-500"
        style={{ backgroundColor: '#bfdbfe', fontSize: '9px' }}
      >
        {title}
      </div>
      <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
        <thead>
          <tr style={{ backgroundColor: '#dbeafe' }}>
            <th className="border border-slate-400 px-0.5 py-0.5 text-center" style={{ width: '16px' }}>NO</th>
            <th className="border border-slate-400 px-1 py-0.5 text-left" style={{ width: '155px' }}>CUSTOMER</th>
            <th className="border border-slate-400 px-1 py-0.5 text-left">ITEM</th>
            <th className="border border-slate-400 px-0.5 py-0.5 text-center" style={{ width: '22px' }}>QN</th>
            <th className="border border-slate-400 px-1 py-0.5 text-center" style={{ width: '48px' }}>PRICE</th>
            <th className="border border-slate-400 px-1 py-0.5 text-center" style={{ width: '55px' }}>AMOUNT</th>
            <th className="border border-slate-400 px-1 py-0.5 text-center" style={{ width: '100px' }}>BILL NO</th>
            <th className="border border-slate-400 px-0.5 py-0.5 text-center" style={{ width: '26px' }}>PO BY</th>
          </tr>
        </thead>
        <tbody>
          {display.map((row, i) => (
            <tr key={i} style={{ height: '14px' }}>
              <td className="border border-slate-300 px-0.5 text-center">{row.no > 0 ? row.no : ''}</td>
              <td className="border border-slate-300 px-1">{row.customer}</td>
              <td className="border border-slate-300 px-1">{row.item}</td>
              <td className="border border-slate-300 px-0.5 text-center">{row.qn !== '' && Number(row.qn) > 0 ? row.qn : ''}</td>
              <td className="border border-slate-300 px-1 text-right">{row.price !== '' && Number(row.price) > 0 ? Number(row.price).toFixed(2) : ''}</td>
              <td className="border border-slate-300 px-1 text-right font-medium">{row.amount !== '' && Number(row.amount) > 0 ? Number(row.amount).toFixed(2) : ''}</td>
              <td className="border border-slate-300 px-1 text-center" style={{ fontSize: '8px', wordBreak: 'break-all' }}>{row.billNo}</td>
              <td className="border border-slate-300" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DailyReportPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);

  // Submission state
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([
    { category: 'minyak', description: 'Petrol / Diesel', amount: '', photos: [], photoPreviews: [] },
    { category: 'makan', description: 'Makan / F&B', amount: '', photos: [], photoPreviews: [] },
  ]);
  const [bankSlip, setBankSlip] = useState<{ photos: File[]; previews: string[] }>({ photos: [], previews: [] });
  const [cashProof, setCashProof] = useState<{ photos: File[]; previews: string[] }>({ photos: [], previews: [] });
  const [showDocument, setShowDocument] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, returnsRes, vanRes, userRes] = await Promise.all([
        fetch('/api/sales'),
        fetch(`/api/exchange-returns?startDate=${date}&endDate=${date}`),
        fetch('/api/inventory/van'),
        fetch('/api/auth/me'),
      ]);

      const allSales: SaleRecord[] = await salesRes.json().catch(() => []);
      const allReturns: ReturnRecord[] = await returnsRes.json().catch(() => []);
      const vanData = await vanRes.json().catch(() => ({}));
      const userInfo = await userRes.json().catch(() => ({}));

      // Filter today's sales
      const startMs = new Date(`${date}T00:00:00`).getTime();
      const endMs = new Date(`${date}T23:59:59`).getTime();
      const todaySales = (Array.isArray(allSales) ? allSales : []).filter((s) => {
        const t = new Date(s.created_at || s.createdAt || '').getTime();
        return !isNaN(t) && t >= startMs && t <= endMs;
      });

      // Van products
      const vanProducts: VanProduct[] = Array.isArray(vanData?.products) ? vanData.products : [];

      // Build stock-out map from items sold today
      const stockOutMap: Record<string, number> = {};
      todaySales.forEach((sale) => {
        (sale.items || []).forEach((item) => {
          const key = item.product_name || item.name || '';
          if (key) stockOutMap[key] = (stockOutMap[key] || 0) + Number(item.quantity || 0);
        });
      });

      // Build return/exchange maps
      const returnMap: Record<string, number> = {};
      const exchangeMap: Record<string, number> = {};
      (Array.isArray(allReturns) ? allReturns : []).forEach((r) => {
        const key = r.product_name || '';
        if (key) {
          if (r.type === 'exchange') {
            exchangeMap[key] = (exchangeMap[key] || 0) + Number(r.quantity || 0);
          } else {
            returnMap[key] = (returnMap[key] || 0) + Number(r.quantity || 0);
          }
        }
      });

      // Stock rows from van products
      const stockRows: StockRow[] = vanProducts.map((p) => ({
        name: p.name,
        stockOut: stockOutMap[p.name] || 0,
        stockIn: 0,
        returned: returnMap[p.name] || 0,
        exchanged: exchangeMap[p.name] || 0,
        foc: 0,
      }));

      // Helper to convert sale records into display rows (one row per item)
      const toRows = (sales: SaleRecord[]): SaleRow[] => {
        const rows: SaleRow[] = [];
        let no = 1;
        for (const sale of sales) {
          const items = sale.items || [];
          if (items.length === 0) {
            rows.push({
              no: no++,
              customer: sale.customer_name || '-',
              item: '-',
              qn: '',
              price: '',
              amount: Number(sale.total_amount ?? sale.total ?? 0),
              billNo: sale.invoice || '',
            });
          } else {
            items.forEach((item, idx) => {
              rows.push({
                no: idx === 0 ? no++ : 0,
                customer: idx === 0 ? (sale.customer_name || '-') : '',
                item: item.product_name || item.name || '-',
                qn: Number(item.quantity || 0),
                price: Number(item.unit_price ?? item.price ?? 0),
                amount: Number(item.subtotal ?? ((item.price ?? 0) * (item.quantity ?? 0))),
                billNo: idx === 0 ? (sale.invoice || '') : '',
              });
            });
          }
        }
        return rows;
      };

      const cashSalesRaw = todaySales.filter((s) => s.payment_method === 'cash');
      const transferSalesRaw = todaySales.filter(
        (s) => s.payment_method === 'bank_transfer' || s.payment_method === 'qr_code'
      );
      const creditSalesRaw = todaySales.filter((s) => s.payment_method === 'bill_to_bill');

      const totalCash = cashSalesRaw.reduce((s, r) => s + Number(r.total_amount ?? r.total ?? 0), 0);
      const totalTransfer = transferSalesRaw.reduce((s, r) => s + Number(r.total_amount ?? r.total ?? 0), 0);
      const totalCredit = creditSalesRaw.reduce((s, r) => s + Number(r.total_amount ?? r.total ?? 0), 0);

      const d = new Date(`${date}T12:00:00`);
      setData({
        salesman: userInfo?.name || userInfo?.email || '-',
        kawasan: userInfo?.branch || '-',
        dayName: d.toLocaleDateString('ms-MY', { weekday: 'long' }),
        dateFormatted: d.toLocaleDateString('ms-MY'),
        cashSales: toRows(cashSalesRaw),
        transferSales: toRows(transferSalesRaw),
        creditSales: toRows(creditSalesRaw),
        stockRows,
        totalCash,
        totalTransfer,
        totalCredit,
      });
    } catch (err) {
      console.error('Error fetching daily report:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const handleSubmitReport = useCallback(async () => {
    setSubmitting(true);
    setSubmitErrors([]);
    const errors: string[] = [];

    // Submit each expense that has amount > 0
    for (const exp of expenses) {
      const amt = Number(exp.amount);
      if (amt <= 0) continue;
      if (exp.photos.length === 0) {
        errors.push(`${exp.description}: wajib upload gambar resit`);
        continue;
      }
      try {
        const urls = await Promise.all(exp.photos.map((f) => uploadProofPhoto(f, `expenses/${date}`)));
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: exp.category, description: exp.description, amount: amt, receipt_image_urls: urls, expense_date: date }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { error?: string };
          errors.push(`${exp.description}: ${json.error || 'Gagal simpan'}`);
        }
      } catch {
        errors.push(`${exp.description}: Ralat semasa upload`);
      }
    }

    // Submit banking slip
    if (bankSlip.photos.length > 0) {
      const bankAmt = (data?.totalCash || 0) + (data?.totalTransfer || 0);
      if (bankAmt > 0) {
        try {
          const urls = await Promise.all(bankSlip.photos.map((f) => uploadProofPhoto(f, `banking/${date}`)));
          const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: 'lain-lain', description: 'Slip Banking', amount: bankAmt, receipt_image_urls: urls, expense_date: date }),
          });
          if (!res.ok) errors.push('Slip Banking: Gagal simpan');
        } catch {
          errors.push('Slip Banking: Ralat upload');
        }
      }
    }

    // Submit cash proof photo
    if (cashProof.photos.length > 0) {
      const cashAmt = (data?.totalCash || 0) > 0 ? data!.totalCash : 1;
      try {
        const urls = await Promise.all(cashProof.photos.map((f) => uploadProofPhoto(f, `cash-proof/${date}`)));
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'lain-lain', description: 'Gambar Wang Tunai', amount: cashAmt, receipt_image_urls: urls, expense_date: date }),
        });
        if (!res.ok) errors.push('Gambar Wang: Gagal simpan');
      } catch {
        errors.push('Gambar Wang: Ralat upload');
      }
    }

    setSubmitErrors(errors);
    if (errors.length === 0) setSubmitDone(true);
    setSubmitting(false);
  }, [expenses, bankSlip, cashProof, date, data]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-white">Memuatkan laporan harian...</p>
      </div>
    );
  }

  const totalAll = (data?.totalCash || 0) + (data?.totalTransfer || 0) + (data?.totalCredit || 0);
  const amountBanking = (data?.totalCash || 0) + (data?.totalTransfer || 0);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .hidden { display: block !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .report-paper { box-shadow: none !important; margin: 0 !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-950">
        {/* Screen controls — sticky header */}
        <div className="no-print sticky top-0 z-50 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800">
          <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/sales')}
                className="text-white/60 hover:text-white"
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-white">Laporan Harian</h1>
                <p className="text-white/50 text-xs">Daily Sales Report — {data?.dateFormatted}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Calendar size={16} className="text-white/60 hidden sm:block" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={fetchData} className="text-white/60 hover:text-white">
                <RefreshCw size={16} />
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.print()}
                className="flex items-center gap-2"
              >
                <Printer size={16} /> <span className="hidden sm:inline">Print / PDF</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4">

        {/* ── TOGGLE DOCUMENT BUTTON ───────────────────── */}
        <div className="no-print max-w-4xl mx-auto mb-4">
          <button
            onClick={() => setShowDocument((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-blue-400" />
              <span className="font-semibold">Daily Sales Report — Dokumen</span>
              <span className="text-xs text-slate-400">{data?.dateFormatted}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              {showDocument ? (
                <><span>Sembunyikan</span><ChevronUp size={18} /></>
              ) : (
                <><span>Lihat Dokumen</span><ChevronDown size={18} /></>
              )}
            </div>
          </button>
        </div>
        <div className={showDocument ? '' : 'no-print hidden'}>
        <div
          className="report-paper bg-white text-black mx-auto max-w-4xl shadow-2xl"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >

          {/* ══ PAGE 1 ═══════════════════════════════════ */}
          <div className="p-6">
            {/* Title */}
            <div className="text-center mb-3">
              <p className="font-bold underline tracking-wide" style={{ fontSize: '11px' }}>DAILY SALES REPORT</p>
              <p className="font-bold tracking-widest" style={{ fontSize: '10px' }}>DATA</p>
            </div>

            {/* Header fields */}
            <div className="grid grid-cols-2 gap-x-12 mb-4" style={{ fontSize: '10px' }}>
              <div className="flex gap-2 mb-1 items-center">
                <span className="font-semibold w-16">Hari</span>
                <span>:</span>
                <span className="flex-1 border-b border-slate-500 pl-1 pb-0.5">{data?.dayName}</span>
              </div>
              <div className="flex gap-2 mb-1 items-center">
                <span className="font-semibold w-16">Nama</span>
                <span>:</span>
                <span className="flex-1 border-b border-slate-500 pl-1 pb-0.5">{data?.salesman}</span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="font-semibold w-16">Tarikh</span>
                <span>:</span>
                <span className="flex-1 border-b border-slate-500 pl-1 pb-0.5">{data?.dateFormatted}</span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="font-semibold w-16">Kawasan</span>
                <span>:</span>
                <span className="flex-1 border-b border-slate-500 pl-1 pb-0.5">{data?.kawasan}</span>
              </div>
            </div>

            <SalesTable title="CASH SALES" rows={data?.cashSales || []} minRows={15} />
            <SalesTable title="TRANSFER SALES" rows={data?.transferSales || []} minRows={7} />
            <SalesTable title="CASH PAID CUSTOMER" rows={[]} minRows={6} />

            {/* CHEQUE PAID */}
            <div>
              <div
                className="text-center font-bold py-0.5 uppercase border border-slate-500"
                style={{ backgroundColor: '#bfdbfe', fontSize: '9px' }}
              >
                CHEQUE PAID
              </div>
              <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#dbeafe' }}>
                    <th className="border border-slate-400 px-1 py-0.5 text-center" style={{ width: '20px' }}>NO</th>
                    <th className="border border-slate-400 px-1 py-0.5 text-left">CUSTOMER</th>
                    <th className="border border-slate-400 px-1 py-0.5 text-center" style={{ width: '80px' }}>NO. CER</th>
                    <th className="border border-slate-400 px-1 py-0.5 text-center" style={{ width: '70px' }}>AMNT</th>
                    <th className="border border-slate-400 px-1 py-0.5 text-center" style={{ width: '80px' }}>P.C CLEAR</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3].map((i) => (
                    <tr key={i} style={{ height: '14px' }}>
                      <td className="border border-slate-300" />
                      <td className="border border-slate-300" />
                      <td className="border border-slate-300" />
                      <td className="border border-slate-300" />
                      <td className="border border-slate-300" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ══ PAGE 2 ═══════════════════════════════════ */}
          <div className="p-6 page-break">

            <SalesTable title="CREDIT TERMS CUSTOMER" rows={data?.creditSales || []} minRows={12} />

            {/* Expenses + Sales Summary side by side */}
            <div className="grid grid-cols-2 gap-6 mb-5">
              {/* Descriptions / Expenses */}
              <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
                <thead>
                  <tr>
                    <th className="border border-slate-500 px-2 py-1 text-left" style={{ backgroundColor: '#bfdbfe' }}>
                      DESCRIPTIONS
                    </th>
                    <th className="border border-slate-500 px-2 py-1 text-center" style={{ backgroundColor: '#bfdbfe', width: '100px' }}>
                      AMOUNT (RM)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {['Expenses Sales', 'Petrol / Diesel', 'Food & Beverage', 'Advance', 'Others', 'Balance PTCash'].map(
                    (desc, i) => (
                      <tr key={i} style={{ height: '18px' }}>
                        <td className="border border-slate-300 px-2">
                          {i + 1}. {desc}
                        </td>
                        <td className="border border-slate-300 px-2" />
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              {/* Sales Totals */}
              <table className="w-full border-collapse self-start" style={{ fontSize: '9px' }}>
                <thead>
                  <tr>
                    <th className="border border-slate-500 px-2 py-1 text-left" style={{ backgroundColor: '#bfdbfe' }}>
                      SALES
                    </th>
                    <th className="border border-slate-500 px-2 py-1 text-center" style={{ backgroundColor: '#bfdbfe', width: '110px' }}>
                      AMOUNT (RM)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Cash', value: data?.totalCash },
                    { label: 'Transfer', value: data?.totalTransfer },
                    { label: 'Credit', value: data?.totalCredit },
                    { label: 'Total', value: totalAll },
                    { label: 'Amount Banking', value: amountBanking },
                  ].map((row) => (
                    <tr key={row.label} style={{ height: '18px' }}>
                      <td
                        className={`border border-slate-300 px-2 ${
                          row.label === 'Total' || row.label === 'Amount Banking' ? 'font-bold' : ''
                        }`}
                      >
                        {row.label}
                      </td>
                      <td className="border border-slate-300 px-2 text-right font-medium">
                        {row.value != null && row.value > 0 ? row.value.toFixed(2) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stock Movement Table */}
            <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
              <thead>
                <tr>
                  <th className="border border-slate-500 px-2 py-1 text-left" style={{ backgroundColor: '#f1f5f9' }}>
                    Stock
                  </th>
                  {['Stock Out', 'Stock In', 'Return', 'Exchange', 'Foc'].map((h) => (
                    <th
                      key={h}
                      className="border border-slate-500 px-2 py-1 text-center"
                      style={{ backgroundColor: '#dbeafe', width: '60px' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.stockRows || []).length === 0 ? (
                  <tr style={{ height: '14px' }}>
                    <td className="border border-slate-300 px-2 text-slate-400 italic" style={{ fontSize: '8px' }}>
                      Tiada data stok van
                    </td>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <td key={i} className="border border-slate-300" />
                    ))}
                  </tr>
                ) : (
                  (data?.stockRows || []).map((row, i) => (
                    <tr key={i} style={{ height: '14px' }}>
                      <td className="border border-slate-300 px-2">{row.name}</td>
                      <td className="border border-slate-300 px-2 text-center font-medium">
                        {row.stockOut > 0 ? row.stockOut : ''}
                      </td>
                      <td className="border border-slate-300 px-2 text-center">
                        {row.stockIn > 0 ? row.stockIn : ''}
                      </td>
                      <td className="border border-slate-300 px-2 text-center" style={{ color: '#92400e' }}>
                        {row.returned > 0 ? row.returned : ''}
                      </td>
                      <td className="border border-slate-300 px-2 text-center" style={{ color: '#c2410c' }}>
                        {row.exchanged > 0 ? row.exchanged : ''}
                      </td>
                      <td className="border border-slate-300 px-2 text-center">
                        {row.foc > 0 ? row.foc : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* ══ END PAPER ════════════════════════════════ */}
        </div>
        </div>{/* end showDocument wrapper */}

        {/* ── HANTAR LAPORAN SECTION ───────────────────────────────────── */}
        <div className="no-print max-w-4xl mx-auto mt-8 mb-10 bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Send size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Hantar Laporan Hari</h2>
              <p className="text-slate-400 text-sm">Upload bukti &amp; perbelanjaan sebelum tutup hari</p>
            </div>
          </div>

          <div className="p-6 space-y-6">

            {/* ── Gambar Wang Tunai ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Camera size={16} className="text-amber-400" />
                <span className="text-white font-medium text-sm">Gambar Wang Tunai yang Dikutip</span>
                {(data?.totalCash || 0) > 0 && (
                  <span className="ml-auto text-amber-300 text-sm font-mono">RM {(data?.totalCash || 0).toFixed(2)}</span>
                )}
              </div>
              <label className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-amber-500 transition-colors">
                <Camera size={20} className="text-slate-400" />
                <span className="text-slate-400 text-sm">
                  {cashProof.photos.length > 0 ? `${cashProof.photos.length} gambar dipilih` : 'Ambil gambar wang tunai'}
                </span>
                <input
                  type="file" accept="image/*" capture="environment" multiple className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    const previews = files.map((f) => URL.createObjectURL(f));
                    setCashProof((p) => ({ photos: [...p.photos, ...files], previews: [...p.previews, ...previews] }));
                    e.target.value = '';
                  }}
                />
              </label>
              {cashProof.previews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {cashProof.previews.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-600" />
                      <button
                        onClick={() => setCashProof((p) => ({ photos: p.photos.filter((_, j) => j !== i), previews: p.previews.filter((_, j) => j !== i) }))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Perbelanjaan ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Upload size={16} className="text-green-400" />
                  <span className="text-white font-medium text-sm">Perbelanjaan Hari Ini</span>
                </div>
                <button
                  onClick={() => setExpenses((prev) => [...prev, { category: 'lain-lain', description: 'Lain-lain', amount: '', photos: [], photoPreviews: [] }])}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 px-3 py-1 rounded-lg border border-blue-700 hover:border-blue-500 transition-colors"
                >
                  + Tambah
                </button>
              </div>
              <div className="space-y-3">
                {expenses.map((exp, i) => (
                  <div key={i} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <select
                        value={exp.category}
                        onChange={(e) => {
                          const cat = EXPENSE_CATS.find((c) => c.value === e.target.value);
                          setExpenses((prev) => prev.map((x, j) => j === i ? { ...x, category: e.target.value, description: cat?.label || x.description } : x));
                        }}
                        className="flex-1 bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                      >
                        {EXPENSE_CATS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="RM 0.00"
                        value={exp.amount}
                        onChange={(e) => setExpenses((prev) => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                        className="w-28 bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500 text-right"
                      />
                      {expenses.length > 1 && (
                        <button
                          onClick={() => setExpenses((prev) => prev.filter((_, j) => j !== i))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <label className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-green-500 text-xs text-slate-400 hover:text-green-400 transition-colors">
                      <Camera size={14} />
                      {exp.photos.length > 0 ? `${exp.photos.length} gambar resit` : 'Upload gambar resit (wajib)'}
                      <input
                        type="file" accept="image/*" capture="environment" multiple className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          const previews = files.map((f) => URL.createObjectURL(f));
                          setExpenses((prev) => prev.map((x, j) => j === i ? { ...x, photos: [...x.photos, ...files], photoPreviews: [...x.photoPreviews, ...previews] } : x));
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {exp.photoPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {exp.photoPreviews.map((src, pi) => (
                          <div key={pi} className="relative">
                            <img src={src} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-600" />
                            <button
                              onClick={() => setExpenses((prev) => prev.map((x, j) => j === i ? { ...x, photos: x.photos.filter((_, k) => k !== pi), photoPreviews: x.photoPreviews.filter((_, k) => k !== pi) } : x))}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                            >
                              <X size={8} className="text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Slip Banking ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Upload size={16} className="text-blue-400" />
                <span className="text-white font-medium text-sm">Slip Banking / Deposit</span>
                {amountBanking > 0 && (
                  <span className="ml-auto text-blue-300 text-sm font-mono">RM {amountBanking.toFixed(2)}</span>
                )}
              </div>
              <label className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                <Upload size={20} className="text-slate-400" />
                <span className="text-slate-400 text-sm">
                  {bankSlip.photos.length > 0 ? `${bankSlip.photos.length} gambar slip` : 'Upload gambar slip bank'}
                </span>
                <input
                  type="file" accept="image/*" capture="environment" multiple className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    const previews = files.map((f) => URL.createObjectURL(f));
                    setBankSlip((p) => ({ photos: [...p.photos, ...files], previews: [...p.previews, ...previews] }));
                    e.target.value = '';
                  }}
                />
              </label>
              {bankSlip.previews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {bankSlip.previews.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-600" />
                      <button
                        onClick={() => setBankSlip((p) => ({ photos: p.photos.filter((_, j) => j !== i), previews: p.previews.filter((_, j) => j !== i) }))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Errors ── */}
            {submitErrors.length > 0 && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 space-y-1">
                {submitErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-red-300 text-sm">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Submit / Success ── */}
            {submitDone ? (
              <div className="flex items-center gap-3 px-4 py-4 bg-emerald-900/30 border border-emerald-700/50 rounded-xl">
                <CheckCircle size={22} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-emerald-300 font-semibold">Laporan berjaya dihantar!</p>
                  <p className="text-emerald-400/70 text-sm">Admin akan semak dan approve perbelanjaan anda.</p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleSubmitReport}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? (
                  <><RefreshCw size={18} className="animate-spin" /> Menghantar...</>
                ) : (
                  <><Send size={18} /> Hantar Laporan Hari</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>{/* end p-4 content wrapper */}
      </div>{/* end min-h-screen */}
    </>
  );
}