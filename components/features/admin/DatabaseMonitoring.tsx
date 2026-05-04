'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Database, Download, FileText, Receipt, Search, ShoppingCart } from 'lucide-react';
import type { DailyReport, Transaction } from '@/types';
import { DailyReportDataTable } from '@/components/features/admin/DailyReportDataTable';
import ArchiveSalesTable from '@/components/features/admin/ArchiveSalesTable';

type SaleRow = Transaction & {
  area?: string | null;
  transactionDate?: string | null;
  payment_method?: string | null;
  customer_name?: string | null;
};

function getSaleStaffKey(s: SaleRow) {
  const label = s.salesmanName?.trim() ? s.salesmanName : 'Nama staff tidak direkodkan';
  return s.salesmanId ? `id:${s.salesmanId}` : `name:${label}`;
}

function saleTimeMs(s: SaleRow) {
  const raw = s.transactionDate || s.createdAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

interface SettlementRecord {
  id: string;
  userName?: string;
  date?: string;
  totalSales?: number;
  branch?: string;
  submittedAt?: string;
}

type HistoryItem = {
  id: string;
  type: 'sale' | 'settlement' | 'daily_report' | 'weekly_end' | 'month_end';
  timestamp: string;
  title: string;
  branch: string;
  amount: number;
  status: string;
};

type DatabaseMonitoringProps = {
  /** Kad ringkas di Pangkalan Data → paut ke halaman arkib penuh */
  cardNav?: boolean;
};

export default function DatabaseMonitoring({ cardNav = false }: DatabaseMonitoringProps) {
  const searchParams = useSearchParams();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [reportBundle, setReportBundle] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | HistoryItem['type']>('all');

  const [drYear, setDrYear] = useState('all');
  const [drMonth, setDrMonth] = useState('all');
  const [drFrom, setDrFrom] = useState('');
  const [drTo, setDrTo] = useState('');
  const [drStaff, setDrStaff] = useState('all');

  const [saleYear, setSaleYear] = useState('all');
  const [saleMonth, setSaleMonth] = useState('all');
  const [saleStaffKey, setSaleStaffKey] = useState('all');
  const [saleArea, setSaleArea] = useState('all');

  const dailyReports = useMemo(
    () => reportBundle.filter((r) => (r.approvalStage || 'daily') === 'daily'),
    [reportBundle]
  );
  const weeklyReports = useMemo(
    () => reportBundle.filter((r) => r.approvalStage === 'weekly'),
    [reportBundle]
  );
  const monthlyReports = useMemo(
    () => reportBundle.filter((r) => r.approvalStage === 'monthly'),
    [reportBundle]
  );

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (focus === 'sales' || focus === 'sale') setTypeFilter('sale');
    else if (focus === 'settlement') setTypeFilter('settlement');
    else if (focus === 'daily') setTypeFilter('daily_report');
    else if (focus === 'weekly') setTypeFilter('weekly_end');
    else if (focus === 'monthly') setTypeFilter('month_end');
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [salesRes, settlementRes, reportsBundle] = await Promise.allSettled([
          fetch('/api/sales').then((r) => (r.ok ? r.json() : Promise.resolve([]))),
          fetch('/api/settlements').then((r) => (r.ok ? r.json() : Promise.resolve([]))),
          fetch('/api/daily-reports', { cache: 'no-store' }).then((r) =>
            r.ok ? r.json() : Promise.resolve({ reports: [] })
          ),
        ]);

        if (salesRes.status === 'fulfilled' && Array.isArray(salesRes.value)) {
          setSales(salesRes.value as SaleRow[]);
        } else {
          setSales([]);
        }

        if (settlementRes.status === 'fulfilled' && Array.isArray(settlementRes.value)) {
          setSettlements(settlementRes.value as SettlementRecord[]);
        } else {
          setSettlements([]);
        }

        const bundle =
          reportsBundle.status === 'fulfilled' && reportsBundle.value && Array.isArray(reportsBundle.value.reports)
            ? (reportsBundle.value.reports as DailyReport[])
            : [];
        setReportBundle(bundle);
      } catch {
        setError('Gagal memuatkan rekod data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const history = useMemo(() => {
    const saleItems: HistoryItem[] = sales.map((s) => ({
      id: `sale-${s.id}`,
      type: 'sale',
      timestamp: s.createdAt || '',
      title: `Jualan ${s.invoice || s.id}`,
      branch: s.branch || 'N/A',
      amount: Number(s.total || 0),
      status: s.payment?.method || 'paid',
    }));

    const settlementItems: HistoryItem[] = settlements.map((s) => ({
      id: `settlement-${s.id}`,
      type: 'settlement',
      timestamp: s.submittedAt || (s.date ? `${s.date}T00:00:00.000Z` : ''),
      title: `Settlement ${s.userName || s.id}`,
      branch: s.branch || 'N/A',
      amount: Number(s.totalSales || 0),
      status: 'submitted',
    }));

    const reportItems: HistoryItem[] = dailyReports.map((r) => ({
      id: `daily-${r.id}`,
      type: 'daily_report',
      timestamp: r.updatedAt || (r.date ? `${r.date}T00:00:00.000Z` : ''),
      title: `Laporan Harian ${r.userName || r.id}`,
      branch: r.branch || 'N/A',
      amount: Number(r.totalSales || 0),
      status: r.status || 'draft',
    }));
    const weeklyItems: HistoryItem[] = weeklyReports.map((r) => ({
      id: `weekly-${r.id}`,
      type: 'weekly_end',
      timestamp: r.updatedAt || (r.date ? `${r.date}T00:00:00.000Z` : ''),
      title: `Weekly End ${r.userName || r.id}`,
      branch: r.branch || 'N/A',
      amount: Number(r.totalSales || 0),
      status: r.status || 'approved_weekly',
    }));
    const monthlyItems: HistoryItem[] = monthlyReports.map((r) => ({
      id: `monthly-${r.id}`,
      type: 'month_end',
      timestamp: r.updatedAt || (r.date ? `${r.date}T00:00:00.000Z` : ''),
      title: `Month End ${r.userName || r.id}`,
      branch: r.branch || 'N/A',
      amount: Number(r.totalSales || 0),
      status: r.status || 'approved_monthly',
    }));

    return [...saleItems, ...settlementItems, ...reportItems, ...weeklyItems, ...monthlyItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 500);
  }, [sales, settlements, dailyReports, weeklyReports, monthlyReports]);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.branch.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q)
      );
    });
  }, [history, search, typeFilter]);

  const showDailyArchive = typeFilter === 'daily_report';
  const showSalesArchive = typeFilter === 'sale';

  const drYearOptions = useMemo(() => {
    const ys = new Set<string>();
    dailyReports.forEach((d) => {
      if (d.date && d.date.length >= 4) ys.add(d.date.slice(0, 4));
    });
    return [...ys].sort((a, b) => b.localeCompare(a));
  }, [dailyReports]);

  const drStaffOptions = useMemo(() => {
    const m = new Map<string, string>();
    dailyReports.forEach((d) => {
      const n = (d.userName || '').trim();
      if (n) m.set(n, n);
    });
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'ms-MY'));
  }, [dailyReports]);

  const filteredDailyArchive = useMemo(() => {
    let rows = dailyReports;
    const y = drYear !== 'all' ? drYear : null;
    const mo = drMonth !== 'all' ? drMonth.padStart(2, '0') : null;
    if (y && mo) {
      const prefix = `${y}-${mo}`;
      rows = rows.filter((r) => r.date.startsWith(prefix));
    } else if (y) {
      rows = rows.filter((r) => r.date.startsWith(y));
    }
    if (drFrom) rows = rows.filter((r) => r.date >= drFrom);
    if (drTo) rows = rows.filter((r) => r.date <= drTo);
    if (drStaff !== 'all') {
      rows = rows.filter((r) => (r.userName || '').trim() === drStaff);
    }
    return [...rows].sort((a, b) => {
      const dc = b.date.localeCompare(a.date);
      if (dc !== 0) return dc;
      return (
        new Date(b.submittedAt || b.updatedAt || 0).getTime() -
        new Date(a.submittedAt || a.updatedAt || 0).getTime()
      );
    });
  }, [dailyReports, drYear, drMonth, drFrom, drTo, drStaff]);

  const saleYearOptions = useMemo(() => {
    const ys = new Set<string>();
    sales.forEach((s) => {
      const t = saleTimeMs(s);
      if (t) ys.add(String(new Date(t).getFullYear()));
    });
    return [...ys].sort((a, b) => b.localeCompare(a));
  }, [sales]);

  const saleAreaOptions = useMemo(() => {
    const m = new Map<string, string>();
    sales.forEach((s) => {
      const a = String(s.area || '').trim();
      if (a) m.set(a, a);
    });
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'ms-MY'));
  }, [sales]);

  const saleStaffOptions = useMemo(() => {
    const m = new Map<string, string>();
    sales.forEach((s) => {
      const key = getSaleStaffKey(s);
      const label = (s.salesmanName && s.salesmanName.trim()) ? s.salesmanName : 'Nama staff tidak direkodkan';
      m.set(key, label);
    });
    return [...m.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'ms-MY'))
      .map(([value, label]) => ({ value, label }));
  }, [sales]);

  const filteredSalesArchive = useMemo(() => {
    let rows = sales;
    const y = saleYear !== 'all' ? Number(saleYear) : null;
    const monthIdx = saleMonth !== 'all' ? Number(saleMonth) - 1 : null;
    if (y != null && monthIdx != null && monthIdx >= 0 && monthIdx <= 11) {
      rows = rows.filter((s) => {
        const t = saleTimeMs(s);
        if (!t) return false;
        const d = new Date(t);
        return d.getFullYear() === y && d.getMonth() === monthIdx;
      });
    } else if (y != null) {
      rows = rows.filter((s) => {
        const t = saleTimeMs(s);
        return t && new Date(t).getFullYear() === y;
      });
    }
    if (saleArea !== 'all') {
      rows = rows.filter((s) => String(s.area || '').trim() === saleArea);
    }
    if (saleStaffKey !== 'all') {
      rows = rows.filter((s) => getSaleStaffKey(s) === saleStaffKey);
    }
    return rows;
  }, [sales, saleYear, saleMonth, saleArea, saleStaffKey]);

  const totals = useMemo(() => ({
    sales: sales.length,
    settlements: settlements.length,
    dailyReports: dailyReports.length,
    weeklyReports: weeklyReports.length,
    monthlyReports: monthlyReports.length,
    amount: history.reduce((sum, row) => sum + row.amount, 0),
  }), [sales.length, settlements.length, dailyReports.length, weeklyReports.length, monthlyReports.length, history]);

  const handleDownloadBackup = (scope: 'all' | 'sales' | 'settlement' | 'daily' | 'weekly' | 'monthly') => {
    const backup = {
      generatedAt: new Date().toISOString(),
      summary: totals,
      scope,
      sales: scope === 'all' || scope === 'sales' ? sales : [],
      settlements: scope === 'all' || scope === 'settlement' ? settlements : [],
      dailyReports: scope === 'all' || scope === 'daily' ? dailyReports : [],
      weeklyReports: scope === 'all' || scope === 'weekly' ? weeklyReports : [],
      monthlyReports: scope === 'all' || scope === 'monthly' ? monthlyReports : [],
      history: scope === 'all' ? history : history.filter((item) => (
        (scope === 'sales' && item.type === 'sale')
        || (scope === 'settlement' && item.type === 'settlement')
        || (scope === 'daily' && item.type === 'daily_report')
        || (scope === 'weekly' && item.type === 'weekly_end')
        || (scope === 'monthly' && item.type === 'month_end')
      )),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `backup-${scope}-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Database className="text-blue-500" />
              Pusat Rekod & Backup Data
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Semua rekod penting (jualan, settlement, laporan harian) dikumpulkan untuk history dan softcopy backup.
            </p>
          </div>
          <button
            onClick={() => handleDownloadBackup('all')}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={16} />
            Muat Turun Softcopy Backup
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            icon={<ShoppingCart size={16} className="text-blue-400" />}
            label="Rekod Jualan"
            value={totals.sales}
            hint={cardNav ? 'Klik untuk arkib penuh' : 'Disimpan dalam pangkalan'}
            href={cardNav ? '/admin/data-archive?focus=sales' : undefined}
          />
          <SummaryCard
            icon={<Receipt size={16} className="text-violet-400" />}
            label="Rekod Settlement"
            value={totals.settlements}
            hint={cardNav ? 'Klik untuk arkib penuh' : 'Disimpan dalam pangkalan'}
            href={cardNav ? '/admin/data-archive?focus=settlement' : undefined}
          />
          <SummaryCard
            icon={<FileText size={16} className="text-amber-400" />}
            label="Laporan Harian"
            value={totals.dailyReports}
            hint={cardNav ? 'Klik untuk arkib penuh' : 'Disimpan dalam pangkalan'}
            href={cardNav ? '/admin/data-archive?focus=daily' : undefined}
          />
          <SummaryCard
            icon={<Database size={16} className="text-emerald-400" />}
            label="Jumlah Nilai Rekod"
            value={`RM ${totals.amount.toFixed(2)}`}
            hint={cardNav ? 'Klik untuk semua jenis' : 'Semua rekod terkumpul'}
            href={cardNav ? '/admin/data-archive' : undefined}
          />
        </div>

        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
          <p className="text-sm font-semibold text-white mb-3">Library Rekod (Semua Dalam Satu Tempat)</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari rekod ikut nama/staff/cawangan/status..."
                className="w-full rounded-lg border border-slate-600 bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | HistoryItem['type'])}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none focus:border-blue-500"
            >
              <option value="all">Semua Jenis</option>
              <option value="sale">Jualan</option>
              <option value="settlement">Settlement</option>
              <option value="daily_report">Laporan Harian</option>
              <option value="weekly_end">Weekly End</option>
              <option value="month_end">Month End</option>
            </select>
            <button onClick={() => handleDownloadBackup('daily')} className="rounded-lg border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-900/50">
              Softcopy Daily
            </button>
            <button onClick={() => handleDownloadBackup('weekly')} className="rounded-lg border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-900/50">
              Softcopy Weekly
            </button>
            <button onClick={() => handleDownloadBackup('monthly')} className="rounded-lg border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-900/50">
              Softcopy Monthly
            </button>
            <button onClick={() => handleDownloadBackup('sales')} className="rounded-lg border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-900/50">
              Softcopy Sales
            </button>
          </div>
        </div>

        {showDailyArchive && (
          <div className="mb-6 space-y-4 rounded-xl border border-amber-800/50 bg-slate-900/70 p-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold text-white">Laporan harian (arkib penuh)</h3>
              <p className="text-xs text-slate-400">
                Sama paparan seperti Pusat Laporan — penapis tarikh, bulan, tahun, dan ejen jualan. Data dari{' '}
                <code className="text-slate-300">/api/daily-reports</code>.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Tahun
                <select
                  value={drYear}
                  onChange={(e) => setDrYear(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500 min-w-[100px]"
                >
                  <option value="all">Semua</option>
                  {drYearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Bulan
                <select
                  value={drMonth}
                  onChange={(e) => setDrMonth(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500 min-w-[100px]"
                >
                  <option value="all">Semua</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    return (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Dari tarikh
                <input
                  type="date"
                  value={drFrom}
                  onChange={(e) => setDrFrom(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Hingga tarikh
                <input
                  type="date"
                  value={drTo}
                  onChange={(e) => setDrTo(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Ejen jualan
                <select
                  value={drStaff}
                  onChange={(e) => setDrStaff(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500 min-w-[160px]"
                >
                  <option value="all">Semua</option>
                  {drStaffOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setDrYear('all');
                  setDrMonth('all');
                  setDrFrom('');
                  setDrTo('');
                  setDrStaff('all');
                }}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
              >
                Reset penapis
              </button>
            </div>
            <DailyReportDataTable
              rows={filteredDailyArchive}
              loading={loading}
              emptyText="Tiada laporan harian sepadan dengan penapis (atau pangkalan kosong)."
            />
          </div>
        )}

        {showSalesArchive && (
          <div className="mb-6 space-y-4 rounded-xl border border-blue-800/50 bg-slate-900/70 p-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold text-white">Rekod jualan (arkib terperinci)</h3>
              <p className="text-xs text-slate-400">
                Jadual seperti Live Sales — invois, pelanggan, kawasan, staff, bayaran, bukti. Penapis ikut tarikh /
                ejen / kawasan.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Tahun
                <select
                  value={saleYear}
                  onChange={(e) => setSaleYear(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500 min-w-[100px]"
                >
                  <option value="all">Semua</option>
                  {saleYearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Bulan
                <select
                  value={saleMonth}
                  onChange={(e) => setSaleMonth(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500 min-w-[100px]"
                >
                  <option value="all">Semua</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    return (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Kawasan
                <select
                  value={saleArea}
                  onChange={(e) => setSaleArea(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500 min-w-[140px]"
                >
                  <option value="all">Semua</option>
                  {saleAreaOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                User sales
                <select
                  value={saleStaffKey}
                  onChange={(e) => setSaleStaffKey(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500 min-w-[180px]"
                >
                  <option value="all">Semua</option>
                  {saleStaffOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setSaleYear('all');
                  setSaleMonth('all');
                  setSaleArea('all');
                  setSaleStaffKey('all');
                }}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
              >
                Reset penapis
              </button>
            </div>
            <ArchiveSalesTable sales={filteredSalesArchive} loading={loading} />
          </div>
        )}

        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white">History Rekod Terkini</h3>
            <span className="text-xs text-slate-400">{history.length} rekod</span>
          </div>

          {loading ? (
            <p className="px-4 py-6 text-sm text-slate-400">Memuatkan rekod...</p>
          ) : error ? (
            <p className="px-4 py-6 text-sm text-red-400">{error}</p>
          ) : history.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">Tiada rekod dijumpai.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Masa</th>
                    <th className="px-4 py-3">Jenis Rekod</th>
                    <th className="px-4 py-3">Butiran</th>
                    <th className="px-4 py-3">Cawangan</th>
                    <th className="px-4 py-3">Jumlah</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/50">
                      <td className="px-4 py-3 text-xs font-mono">{row.timestamp ? new Date(row.timestamp).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 border border-slate-700">
                          {row.type === 'sale'
                            ? 'Jualan'
                            : row.type === 'settlement'
                              ? 'Settlement'
                              : row.type === 'weekly_end'
                                ? 'Weekly End'
                                : row.type === 'month_end'
                                  ? 'Month End'
                                  : 'Laporan Harian'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.title}</td>
                      <td className="px-4 py-3">{row.branch}</td>
                      <td className="px-4 py-3 text-emerald-400">RM {row.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 capitalize">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{label}</span>
        {icon}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-indigo-500/60 hover:bg-slate-800/90 transition-colors"
      >
        {inner}
      </Link>
    );
  }

  return <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">{inner}</div>;
}
