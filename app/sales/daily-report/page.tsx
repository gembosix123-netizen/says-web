'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Printer, Calendar, RefreshCw, Upload, CheckCircle, AlertCircle, X, Camera, Send, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

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

interface ExpenseEntry {
  category: string;
  description: string;
  amount: string;
  photos: File[];
  photoPreviews: string[];
}

interface SubmittedExpenseLine {
  category: string;
  description: string;
  amount: number;
  receiptImageUrls: string[];
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

export default function DailyReportPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [reportId, setReportId] = useState<string | null>(null);
  const [amountBankingInput, setAmountBankingInput] = useState('');
  const [balancePtCashInput, setBalancePtCashInput] = useState('');
  const [savingBanking, setSavingBanking] = useState(false);
  const [bankingSaved, setBankingSaved] = useState(false);
  const [bankingMessage, setBankingMessage] = useState('');
  const [submittedExpenseLines, setSubmittedExpenseLines] = useState<SubmittedExpenseLine[]>([]);
  const [liveSalesRefs, setLiveSalesRefs] = useState<string[]>([]);
  const [pendingAutoPrint, setPendingAutoPrint] = useState(false);
  const printableContainerRef = useRef<HTMLDivElement | null>(null);

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

      const startMs = new Date(`${date}T00:00:00`).getTime();
      const endMs = new Date(`${date}T23:59:59`).getTime();
      const todaySales = (Array.isArray(allSales) ? allSales : []).filter((s) => {
        const t = new Date(s.created_at || s.createdAt || '').getTime();
        return !isNaN(t) && t >= startMs && t <= endMs;
      });

      const vanProducts: VanProduct[] = Array.isArray(vanData?.products) ? vanData.products : [];
      const stockOutMap: Record<string, number> = {};
      todaySales.forEach((sale) => {
        (sale.items || []).forEach((item) => {
          const key = item.product_name || item.name || '';
          if (key) stockOutMap[key] = (stockOutMap[key] || 0) + Number(item.quantity || 0);
        });
      });

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

      const stockRows: StockRow[] = vanProducts.map((p) => ({
        name: p.name,
        stockOut: stockOutMap[p.name] || 0,
        stockIn: 0,
        returned: returnMap[p.name] || 0,
        exchanged: exchangeMap[p.name] || 0,
        foc: 0,
      }));

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
      setLiveSalesRefs(todaySales.map((sale) => sale.id));
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

      const existingReportRes = await fetch(`/api/daily-reports?date=${date}&source=sales`, { cache: 'no-store' });
      const existingReportData = await existingReportRes.json().catch(() => ({ reports: [] })) as { reports?: Array<Record<string, unknown>> };
      const existing = Array.isArray(existingReportData.reports) ? existingReportData.reports[0] : null;
      if (existing) {
        setReportId(String(existing.id || ''));
        setAmountBankingInput(String(existing.amountBankingManual ?? ''));
        setBalancePtCashInput(String(existing.balancePtCashManual ?? ''));
        setBankingSaved(true);
        setBankingMessage('Nilai banking/PT cash sudah disimpan.');
        const existingLines = Array.isArray(existing.expenseLines)
          ? existing.expenseLines.map((line) => ({
            category: String((line as Record<string, unknown>).category || 'lain-lain'),
            description: String((line as Record<string, unknown>).description || ''),
            amount: Number((line as Record<string, unknown>).amount || 0),
            receiptImageUrls: Array.isArray((line as Record<string, unknown>).receiptImageUrls)
              ? ((line as Record<string, unknown>).receiptImageUrls as unknown[]).map((url) => String(url))
              : [],
          }))
          : [];
        setSubmittedExpenseLines(existingLines);
      } else {
        setReportId(null);
        setSubmittedExpenseLines([]);
        setBankingSaved(false);
        setBankingMessage('');
      }
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
    const amountBankingManual = Number(amountBankingInput || 0);
    const balancePtCashManual = Number(balancePtCashInput || 0);
    if (amountBankingManual < 0 || balancePtCashManual < 0) {
      errors.push('Amount Banking dan Balance PT Cash mesti 0 atau lebih.');
    }
    const expenseLines: SubmittedExpenseLine[] = [];
    for (const exp of expenses) {
      const amt = Number(exp.amount);
      if (amt <= 0) continue;
      if (exp.photos.length === 0) {
        errors.push(`${exp.description}: wajib upload gambar resit`);
        continue;
      }
      try {
        const urls = await Promise.all(exp.photos.map((f) => uploadProofPhoto(f, `expenses/${date}`)));
        expenseLines.push({
          category: exp.category,
          description: exp.description,
          amount: amt,
          receiptImageUrls: urls,
        });
      } catch {
        errors.push(`${exp.description}: Ralat semasa upload`);
      }
    }
    let bankSlipUrls: string[] = [];
    let cashProofUrls: string[] = [];
    if (bankSlip.photos.length > 0) {
      try {
        bankSlipUrls = await Promise.all(bankSlip.photos.map((f) => uploadProofPhoto(f, `banking/${date}`)));
      } catch {
        errors.push('Slip Banking: Ralat upload');
      }
    }
    if (cashProof.photos.length > 0) {
      try {
        cashProofUrls = await Promise.all(cashProof.photos.map((f) => uploadProofPhoto(f, `cash-proof/${date}`)));
      } catch {
        errors.push('Gambar Wang: Ralat upload');
      }
    }

    if (expenseLines.length === 0) {
      errors.push('Sila isi sekurang-kurangnya satu perbelanjaan dengan gambar resit.');
    }

    setSubmitErrors(errors);
    if (errors.length === 0) {
      if (!bankingSaved) {
        setSubmitErrors(['Sila submit Amount Banking & Balance PT Cash dahulu sebelum hantar laporan hari.']);
        setSubmitting(false);
        return;
      }
      const res = await fetch('/api/daily-reports', {
        method: reportId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reportId || undefined,
          action: reportId ? 'submit_stage' : undefined,
          approvalStage: 'daily',
          source: 'sales',
          date,
          totalSales: (data?.totalCash || 0) + (data?.totalTransfer || 0) + (data?.totalCredit || 0),
          totalCash: data?.totalCash || 0,
          totalTransfer: data?.totalTransfer || 0,
          totalCredit: data?.totalCredit || 0,
          amountBankingManual,
          balancePtCashManual,
          expenseLines,
          bankSlipUrls,
          cashProofUrls,
          salesSnapshot: {
            cashSales: (data?.cashSales || []).filter((row) => Number(row.amount || 0) > 0 || row.customer || row.item),
            transferSales: (data?.transferSales || []).filter((row) => Number(row.amount || 0) > 0 || row.customer || row.item),
            creditSales: (data?.creditSales || []).filter((row) => Number(row.amount || 0) > 0 || row.customer || row.item),
          },
          liveSalesRefs,
          ...(reportId ? {} : { status: 'submitted_daily' }),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setSubmitErrors([json.error || 'Gagal menghantar laporan.']);
      } else {
        const json = await res.json().catch(() => ({})) as { report?: { id?: string } };
        if (json.report?.id) setReportId(json.report.id);
        setSubmittedExpenseLines(expenseLines);
        setSubmitDone(true);
        setShowDocument(true);
        setPendingAutoPrint(true);
      }
    }
    setSubmitting(false);
  }, [amountBankingInput, balancePtCashInput, bankingSaved, expenses, bankSlip, cashProof, date, data, liveSalesRefs, reportId]);

  const handleSubmitBanking = useCallback(async () => {
    setSavingBanking(true);
    setBankingMessage('');
    const amountBankingManual = Number(amountBankingInput || 0);
    const balancePtCashManual = Number(balancePtCashInput || 0);
    if (amountBankingManual < 0 || balancePtCashManual < 0) {
      setBankingMessage('Nilai tidak sah. Sila masukkan 0 atau lebih.');
      setSavingBanking(false);
      return;
    }

    const res = await fetch('/api/daily-reports', {
      method: reportId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: reportId || undefined,
        approvalStage: 'daily',
        source: 'sales',
        date,
        status: 'draft',
        totalSales: (data?.totalCash || 0) + (data?.totalTransfer || 0) + (data?.totalCredit || 0),
        totalCash: data?.totalCash || 0,
        totalTransfer: data?.totalTransfer || 0,
        totalCredit: data?.totalCredit || 0,
        amountBankingManual,
        balancePtCashManual,
        liveSalesRefs,
      }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      setBankingMessage(json.error || 'Gagal simpan Amount Banking / Balance PT Cash.');
      setSavingBanking(false);
      return;
    }

    const json = await res.json().catch(() => ({})) as { report?: { id?: string } };
    if (json.report?.id) setReportId(json.report.id);
    setBankingSaved(true);
    setBankingMessage('Berjaya simpan Amount Banking & Balance PT Cash.');
    setSavingBanking(false);
  }, [amountBankingInput, balancePtCashInput, date, data, liveSalesRefs, reportId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!pendingAutoPrint || !showDocument) return;
    if (!printableContainerRef.current) return;
    const timer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.print();
        setPendingAutoPrint(false);
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [pendingAutoPrint, showDocument]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-white">Memuatkan laporan harian...</p>
      </div>
    );
  }

  const totalAll = (data?.totalCash || 0) + (data?.totalTransfer || 0) + (data?.totalCredit || 0);
  const amountBanking = Number(amountBankingInput || 0);
  const balancePtCash = Number(balancePtCashInput || 0);
  const printableExpenseLines = (submittedExpenseLines.length > 0 ? submittedExpenseLines : expenses
    .filter((exp) => Number(exp.amount) > 0)
    .map((exp) => ({ category: exp.category, description: exp.description, amount: Number(exp.amount), receiptImageUrls: [] })));

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
        <div className="no-print sticky top-0 z-50 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800">
          <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push('/sales')} className="text-white/60 hover:text-white">
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-white">Laporan Harian</h1>
                <p className="text-white/50 text-xs">Daily Sales Report - {data?.dateFormatted}</p>
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
              <Button variant="primary" size="sm" onClick={() => window.print()} className="flex items-center gap-2">
                <Printer size={16} /> <span className="hidden sm:inline">Print / PDF</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="no-print max-w-4xl mx-auto mb-4">
            <button
              onClick={() => setShowDocument((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-blue-400" />
                <span className="font-semibold">Daily Sales Report - Dokumen</span>
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
          <div ref={printableContainerRef} className={showDocument ? '' : 'no-print hidden'}>
            <div className="report-paper bg-white text-black mx-auto max-w-4xl shadow-2xl" style={{ fontFamily: 'Arial, sans-serif' }}>
              <div className="p-6">
                <div className="text-center mb-3">
                  <p className="font-bold underline tracking-wide" style={{ fontSize: '11px' }}>DAILY SALES REPORT</p>
                  <p className="font-bold tracking-widest" style={{ fontSize: '10px' }}>DATA</p>
                </div>
                <div className="grid grid-cols-2 gap-x-12 mb-4" style={{ fontSize: '10px' }}>
                  <div className="flex gap-2 mb-1 items-center"><span className="font-semibold w-16">Hari</span><span>:</span><span className="flex-1 border-b border-slate-500 pl-1 pb-0.5">{data?.dayName}</span></div>
                  <div className="flex gap-2 mb-1 items-center"><span className="font-semibold w-16">Nama</span><span>:</span><span className="flex-1 border-b border-slate-500 pl-1 pb-0.5">{data?.salesman}</span></div>
                  <div className="flex gap-2 items-center"><span className="font-semibold w-16">Tarikh</span><span>:</span><span className="flex-1 border-b border-slate-500 pl-1 pb-0.5">{data?.dateFormatted}</span></div>
                  <div className="flex gap-2 items-center"><span className="font-semibold w-16">Kawasan</span><span>:</span><span className="flex-1 border-b border-slate-500 pl-1 pb-0.5">{data?.kawasan}</span></div>
                </div>

                <SalesTable title="CASH SALES" rows={data?.cashSales || []} minRows={15} />
                <SalesTable title="TRANSFER SALES" rows={data?.transferSales || []} minRows={7} />
                <SalesTable title="CASH PAID CUSTOMER" rows={[]} minRows={6} />
              </div>

              <div className="p-6 page-break">
                <SalesTable title="CREDIT TERMS CUSTOMER" rows={data?.creditSales || []} minRows={12} />

                <div className="grid grid-cols-2 gap-6 mb-5">
                  <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
                    <thead><tr><th className="border border-slate-500 px-2 py-1 text-left" style={{ backgroundColor: '#bfdbfe' }}>DESCRIPTIONS</th><th className="border border-slate-500 px-2 py-1 text-center" style={{ backgroundColor: '#bfdbfe', width: '100px' }}>AMOUNT (RM)</th></tr></thead>
                    <tbody>
                      <tr style={{ height: '18px' }}>
                        <td className="border border-slate-300 px-2">1. Expenses Sales</td>
                        <td className="border border-slate-300 px-2 text-right font-medium">
                          {printableExpenseLines.reduce((sum, line) => sum + Number(line.amount || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                      {printableExpenseLines.slice(0, 4).map((line, i) => (
                        <tr key={`${line.category}-${i}`} style={{ height: '18px' }}>
                          <td className="border border-slate-300 px-2">{i + 2}. {line.description}</td>
                          <td className="border border-slate-300 px-2 text-right">{line.amount > 0 ? line.amount.toFixed(2) : ''}</td>
                        </tr>
                      ))}
                      <tr style={{ height: '18px' }}>
                        <td className="border border-slate-300 px-2">6. Balance PTCash</td>
                        <td className="border border-slate-300 px-2 text-right font-medium">{balancePtCash > 0 ? balancePtCash.toFixed(2) : ''}</td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="w-full border-collapse self-start" style={{ fontSize: '9px' }}>
                    <thead><tr><th className="border border-slate-500 px-2 py-1 text-left" style={{ backgroundColor: '#bfdbfe' }}>SALES</th><th className="border border-slate-500 px-2 py-1 text-center" style={{ backgroundColor: '#bfdbfe', width: '110px' }}>AMOUNT (RM)</th></tr></thead>
                    <tbody>
                      {[
                        { label: 'Cash', value: data?.totalCash },
                        { label: 'Transfer', value: data?.totalTransfer },
                        { label: 'Credit', value: data?.totalCredit },
                        { label: 'Total', value: totalAll },
                        { label: 'Amount Banking', value: amountBanking },
                      ].map((row) => (
                        <tr key={row.label} style={{ height: '18px' }}>
                          <td className={`border border-slate-300 px-2 ${row.label === 'Total' || row.label === 'Amount Banking' ? 'font-bold' : ''}`}>{row.label}</td>
                          <td className="border border-slate-300 px-2 text-right font-medium">{row.value != null && row.value > 0 ? row.value.toFixed(2) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="no-print max-w-4xl mx-auto mt-8 mb-10 bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Send size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Hantar Laporan Hari</h2>
                <p className="text-slate-400 text-sm">Upload bukti & perbelanjaan sebelum tutup hari</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
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
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    const previews = files.map((f) => URL.createObjectURL(f));
                    setCashProof((p) => ({ photos: [...p.photos, ...files], previews: [...p.previews, ...previews] }));
                    e.target.value = '';
                  }} />
                </label>
              </div>

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
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-700 text-slate-200 text-xs cursor-pointer hover:border-green-500">
                          <Camera size={14} className="text-green-400" />
                          <span>{exp.photos.length > 0 ? `${exp.photos.length} gambar resit` : 'Buka Camera Resit'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (!files.length) return;
                              const previews = files.map((f) => URL.createObjectURL(f));
                              setExpenses((prev) =>
                                prev.map((x, j) =>
                                  j === i
                                    ? {
                                      ...x,
                                      photos: [...x.photos, ...files],
                                      photoPreviews: [...x.photoPreviews, ...previews],
                                    }
                                    : x
                                )
                              );
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setExpenses((prev) => {
                              const next = prev.filter((_, j) => j !== i);
                              if (next.length === 0) {
                                return [{ category: 'lain-lain', description: 'Lain-lain', amount: '', photos: [], photoPreviews: [] }];
                              }
                              return next;
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-800 bg-red-900/30 text-red-300 text-xs hover:bg-red-900/50"
                        >
                          <X size={13} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleSubmitReport}
                    disabled={submitting}
                    className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Submit Perbelanjaan Hari Ini
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Upload size={16} className="text-blue-400" />
                  <span className="text-white font-medium text-sm">Slip Banking / Deposit</span>
                  {amountBanking > 0 && <span className="ml-auto text-blue-300 text-sm font-mono">RM {amountBanking.toFixed(2)}</span>}
                </div>
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                  <Upload size={20} className="text-slate-400" />
                  <span className="text-slate-400 text-sm">
                    {bankSlip.photos.length > 0 ? `${bankSlip.photos.length} gambar slip` : 'Upload gambar slip bank'}
                  </span>
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    const previews = files.map((f) => URL.createObjectURL(f));
                    setBankSlip((p) => ({ photos: [...p.photos, ...files], previews: [...p.previews, ...previews] }));
                    e.target.value = '';
                  }} />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 space-y-1">
                  <span className="text-slate-300 text-xs uppercase tracking-wide">Amount Banking (Manual)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountBankingInput}
                    onChange={(e) => {
                      setAmountBankingInput(e.target.value);
                      setBankingSaved(false);
                      setBankingMessage('');
                    }}
                    placeholder="0.00"
                    className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 space-y-1">
                  <span className="text-slate-300 text-xs uppercase tracking-wide">Balance PT Cash (Manual)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={balancePtCashInput}
                    onChange={(e) => {
                      setBalancePtCashInput(e.target.value);
                      setBankingSaved(false);
                      setBankingMessage('');
                    }}
                    placeholder="0.00"
                    className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSubmitBanking}
                  disabled={savingBanking}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {savingBanking ? 'Menyimpan...' : 'Submit Amount Banking + Balance PT Cash'}
                </button>
                {bankingMessage && (
                  <span className={`text-xs ${bankingSaved ? 'text-emerald-400' : 'text-amber-400'}`}>{bankingMessage}</span>
                )}
              </div>

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
                  disabled={submitting || !bankingSaved}
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
        </div>
      </div>
    </>
  );
}
