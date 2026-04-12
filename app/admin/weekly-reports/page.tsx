'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, TrendingUp, TrendingDown, ShoppingCart, DollarSign } from 'lucide-react';

type DailyTrend = {
  date: string;
  gross: number;
  refund: number;
  net: number;
  cash: number;
  credit: number;
  txCount: number;
  storeCount: number;
};

type TopProduct = { name: string; qty: number; revenue: number };

type WeeklyData = {
  weekLabel: string;
  dateStart: string;
  dateEnd: string;
  branch: string;
  totalGross: number;
  totalRefund: number;
  totalNet: number;
  totalExpense: number;
  netAfterExpense: number;
  totalTransactions: number;
  dailyTrend: DailyTrend[];
  topProducts: TopProduct[];
};

function fmt(n: number) {
  return `RM ${Number(n || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function weekOf(d: Date): string {
  const mon = new Date(d);
  const day = mon.getDay();
  mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return mon.toISOString().split('T')[0];
}

export default function WeeklyReportsPage() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(weekOf(today));
  // Month for full-month Excel export (all weeks WEEK 1 / TRANSFER / CREDIT …)
  const [selectedMonth, setSelectedMonth] = useState(today.toISOString().slice(0, 7));
  const [branch, setBranch] = useState('');
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingMonth, setExportingMonth] = useState(false);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userBranch, setUserBranch] = useState('');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUserRole(u.role || '');
      setUserBranch(u.branch || '');
      if (u.role === 'Admin') setBranch(u.branch || '');
    } catch {}
  }, []);

  const availableBranches = ['Kota Kinabalu', 'Kinabatangan', 'HQ'].filter(
    (b) => userRole === 'Admin' ? b === userBranch : true
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await fetch(`/api/reports/weekly?date=${selectedDate}&branch=${branch}`);
    if (res.ok) {
      setData(await res.json());
    } else {
      setError('Gagal memuatkan data laporan mingguan.');
    }
    setLoading(false);
  }, [selectedDate, branch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Export single-week Excel (backward compat)
  async function handleExport() {
    setExporting(true);
    const res = await fetch('/api/reports/weekly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, branch }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WeeklyReport_${data?.weekLabel || selectedDate}_${branch || 'All'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert('Gagal jana laporan Excel.');
    }
    setExporting(false);
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    const params = new URLSearchParams({ date: selectedDate, branch });
    const res = await fetch(`/api/reports/weekly/pdf?${params.toString()}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WeeklyReport_${data?.weekLabel || selectedDate}_${branch || 'All'}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert('Gagal jana laporan PDF.');
    }
    setExportingPdf(false);
  }

  // Export full-month Excel (WEEK 1 / WEEK 1 (TRANSFER) / WEEK 1 (CREDIT) … format)
  async function handleExportMonth() {
    setExportingMonth(true);
    const res = await fetch('/api/reports/weekly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: selectedMonth, branch }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WeeklyReport_${selectedMonth}_${branch || 'All'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert('Gagal jana laporan Excel bulan.');
    }
    setExportingMonth(false);
  }

  const kpiCards = data
    ? [
        { label: 'Jualan Kasar', value: fmt(data.totalGross), icon: <ShoppingCart className="h-5 w-5 text-indigo-500" />, delta: null },
        { label: 'Refund Diluluskan', value: fmt(data.totalRefund), icon: <TrendingDown className="h-5 w-5 text-red-500" />, delta: null },
        { label: 'Jualan Bersih', value: fmt(data.totalNet), icon: <TrendingUp className="h-5 w-5 text-green-500" />, delta: null },
        { label: 'Expenses', value: fmt(data.totalExpense), icon: <DollarSign className="h-5 w-5 text-amber-500" />, delta: null },
        { label: 'Baki Bersih', value: fmt(data.netAfterExpense), icon: <DollarSign className="h-5 w-5 text-blue-500" />, delta: null },
        { label: 'Bil Transaksi', value: String(data.totalTransactions), icon: <ShoppingCart className="h-5 w-5 text-slate-500" />, delta: null },
      ]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Laporan Mingguan</h1>
          {data && (
            <p className="text-sm text-slate-500 mt-0.5">
              {data.weekLabel} &mdash; {new Date(data.dateStart).toLocaleDateString('ms-MY')} hingga {new Date(data.dateEnd).toLocaleDateString('ms-MY')}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Week date picker (for preview) */}
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800" />
          <select value={branch} onChange={(e) => setBranch(e.target.value)}
            disabled={userRole === 'Admin'}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed">
            {userRole !== 'Admin' && <option value="">Semua Cawangan</option>}
            {availableBranches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {/* Single-week export */}
          <button onClick={handleExport} disabled={exporting || loading || !data}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-50">
            <Download className="h-4 w-4" />
            {exporting ? 'Jana...' : 'Excel (Minggu)'}
          </button>
          <button onClick={handleExportPdf} disabled={exportingPdf || loading || !data}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:opacity-50">
            <Download className="h-4 w-4" />
            {exportingPdf ? 'Jana...' : 'PDF (Minggu)'}
          </button>
        </div>
      </div>

      {/* Full-month Excel export panel */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Export bulanan (WEEK 1 / TRANSFER / CREDIT …):</span>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800"
        />
        <button
          onClick={handleExportMonth}
          disabled={exportingMonth}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-semibold disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exportingMonth ? 'Jana Excel...' : 'Muat Turun Excel Bulan'}
        </button>
        <span className="text-xs text-slate-500">Termasuk data backdated — muat turun untuk bulan mana-mana</span>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((card) => (
            <div key={card.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">{card.icon}<p className="text-xs text-slate-500">{card.label}</p></div>
              <p className="font-bold text-sm">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Daily Trend Table  — gaya sama dengan Excel rujukan */}
      {data && data.dailyTrend.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold text-sm">
            Trend Harian
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  {['TARIKH', 'JUALAN KASAR (RM)', 'REFUND (RM)', 'JUALAN BERSIH (RM)', 'TUNAI (RM)', 'KREDIT (RM)', 'BIL TXN', 'BIL KEDAI'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.dailyTrend.map((d) => (
                  <tr key={d.date} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-2.5 font-medium">{new Date(d.date + 'T12:00:00').toLocaleDateString('ms-MY')}</td>
                    <td className="px-4 py-2.5">{Number(d.gross).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-red-600">{Number(d.refund).toFixed(2)}</td>
                    <td className="px-4 py-2.5 font-semibold">{Number(d.net).toFixed(2)}</td>
                    <td className="px-4 py-2.5">{Number(d.cash).toFixed(2)}</td>
                    <td className="px-4 py-2.5">{Number(d.credit).toFixed(2)}</td>
                    <td className="px-4 py-2.5">{d.txCount}</td>
                    <td className="px-4 py-2.5">{d.storeCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-indigo-50 dark:bg-indigo-900/20 font-bold">
                <tr>
                  <td className="px-4 py-2.5">TOTAL</td>
                  <td className="px-4 py-2.5">{Number(data.totalGross).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-red-600">{Number(data.totalRefund).toFixed(2)}</td>
                  <td className="px-4 py-2.5">{Number(data.totalNet).toFixed(2)}</td>
                  <td className="px-4 py-2.5">{data.dailyTrend.reduce((s, d) => s + d.cash, 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5">{data.dailyTrend.reduce((s, d) => s + d.credit, 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5">{data.totalTransactions}</td>
                  <td className="px-4 py-2.5">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Top Products */}
      {data && data.topProducts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold text-sm">
            Top Produk Minggu Ini
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  {['#', 'PRODUK', 'QTY', 'HASIL (RM)'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.topProducts.map((p, i) => (
                  <tr key={p.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5">{p.qty}</td>
                    <td className="px-4 py-2.5 font-semibold">{Number(p.revenue).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-12 text-slate-400">Memuatkan data laporan...</div>
      )}
      {!loading && data && data.totalTransactions === 0 && (
        <div className="text-center py-12 text-slate-400">Tiada transaksi pada minggu ini.</div>
      )}
    </div>
  );
}
