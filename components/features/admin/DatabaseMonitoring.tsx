'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Database, Download, FileText, Receipt, Search, ShoppingCart } from 'lucide-react';

interface SaleRecord {
  id: string;
  invoice?: string;
  total?: number;
  branch?: string;
  createdAt?: string;
  payment?: { method?: string };
}

interface SettlementRecord {
  id: string;
  userName?: string;
  date?: string;
  totalSales?: number;
  branch?: string;
  submittedAt?: string;
}

interface DailyReportRecord {
  id: string;
  userName?: string;
  date?: string;
  status?: string;
  totalSales?: number;
  branch?: string;
  updatedAt?: string;
  approvalStage?: 'daily' | 'weekly' | 'monthly';
  amountBankingManual?: number;
  balancePtCashManual?: number;
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

export default function DatabaseMonitoring() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportRecord[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<DailyReportRecord[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<DailyReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | HistoryItem['type']>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [salesRes, settlementRes, dailyRes, weeklyRes, monthlyRes] = await Promise.allSettled([
          fetch('/api/sales').then((r) => (r.ok ? r.json() : Promise.resolve([]))),
          fetch('/api/settlements').then((r) => (r.ok ? r.json() : Promise.resolve([]))),
          fetch('/api/daily-reports?approvalStage=daily&publishedOnly=true').then((r) => (r.ok ? r.json() : Promise.resolve({ reports: [] }))),
          fetch('/api/daily-reports?approvalStage=weekly&publishedOnly=true').then((r) => (r.ok ? r.json() : Promise.resolve({ reports: [] }))),
          fetch('/api/daily-reports?approvalStage=monthly&publishedOnly=true').then((r) => (r.ok ? r.json() : Promise.resolve({ reports: [] }))),
        ]);

        if (salesRes.status === 'fulfilled' && Array.isArray(salesRes.value)) {
          setSales(salesRes.value as SaleRecord[]);
        } else {
          setSales([]);
        }

        if (settlementRes.status === 'fulfilled' && Array.isArray(settlementRes.value)) {
          setSettlements(settlementRes.value as SettlementRecord[]);
        } else {
          setSettlements([]);
        }

        if (dailyRes.status === 'fulfilled' && dailyRes.value && Array.isArray(dailyRes.value.reports)) {
          setDailyReports(dailyRes.value.reports as DailyReportRecord[]);
        } else {
          setDailyReports([]);
        }
        if (weeklyRes.status === 'fulfilled' && weeklyRes.value && Array.isArray(weeklyRes.value.reports)) {
          setWeeklyReports(weeklyRes.value.reports as DailyReportRecord[]);
        } else {
          setWeeklyReports([]);
        }
        if (monthlyRes.status === 'fulfilled' && monthlyRes.value && Array.isArray(monthlyRes.value.reports)) {
          setMonthlyReports(monthlyRes.value.reports as DailyReportRecord[]);
        } else {
          setMonthlyReports([]);
        }
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
            hint="Disimpan dalam Library"
          />
          <SummaryCard
            icon={<Receipt size={16} className="text-violet-400" />}
            label="Rekod Settlement"
            value={totals.settlements}
            hint="Disimpan dalam Library"
          />
          <SummaryCard
            icon={<FileText size={16} className="text-amber-400" />}
            label="Laporan Harian"
            value={totals.dailyReports}
            hint="Disimpan dalam Library"
          />
          <SummaryCard
            icon={<Database size={16} className="text-emerald-400" />}
            label="Jumlah Nilai Rekod"
            value={`RM ${totals.amount.toFixed(2)}`}
            hint="Semua rekod terkumpul"
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
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{label}</span>
        {icon}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}
