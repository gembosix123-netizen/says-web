'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useLanguage } from '@/context/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Download, Calendar, DollarSign, TrendingUp, Package, Users, AlertCircle, FileText } from 'lucide-react';

interface DailySale {
  date: string;
  amount: number;
  transactions: number;
  branch: string;
}

interface BranchSummary {
  branch: string;
  totalRevenue: number;
  transactionCount: number;
  avgTransaction: number;
  topProduct: string;
}

interface MonthlyReportData {
  month: string;
  totalRevenue: number;
  totalTransactions: number;
  dailyData: DailySale[];
  branchSummaries: BranchSummary[];
  topProducts: { name: string; quantity: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899'];

export default function MonthlyReportSupabase() {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear] = useState(new Date().getFullYear().toString());
  const [selectedBranch, setSelectedBranch] = useState<'all' | 'Kota Kinabalu' | 'Kinabatangan'>('all');
  const [reportData, setReportData] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUserBranch, setCurrentUserBranch] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const { addToast } = useToast();

  // Get current user info
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setCurrentUserBranch(userData.branch || '');
        setCurrentUserRole(userData.role || '');
        // If Admin, set default to their branch
        if (userData.role === 'Admin') {
          setSelectedBranch(userData.branch);
        }
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    }
  }, []);

  // Fetch monthly report from Supabase
  const fetchMonthlyReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/monthly?month=${selectedMonth}&branch=${selectedBranch}`);
      if (!res.ok) {
        const error = await res.json();
        addToast(error.error || 'Failed to fetch report', 'error');
        return;
      }
      const data: MonthlyReportData = await res.json();
      setReportData(data);
    } catch (error) {
      console.error('Error fetching report:', error);
      addToast(t('error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedMonth, selectedBranch]);

  // Export to PDF
  const handleExportPDF = async () => {
    if (!reportData) return;
    setIsExportingPDF(true);
    try {
      const response = await fetch('/api/reports/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          branch: selectedBranch,
          reportData,
        }),
      });

      if (!response.ok) {
        addToast(t('error'), 'error');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${selectedMonth}_${selectedBranch}.html`;
      a.click();
      window.URL.revokeObjectURL(url);
      addToast('Report exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      addToast(t('error'), 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (!reportData) return;
    setIsExportingExcel(true);
    try {
      const response = await fetch('/api/reports/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          branch: selectedBranch,
          reportData,
        }),
      });

      if (!response.ok) {
        addToast(t('error'), 'error');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SalesReport_${selectedMonth}_${selectedBranch}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      addToast('Excel exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      addToast(t('error'), 'error');
    } finally {
      setIsExportingExcel(false);
    }
  };

  if (!reportData && !loading) {
    return (
      <div className="soft-panel p-6 rounded-lg text-center">
        <p className="text-slate-600 dark:text-slate-400">{t('loading_report')}</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="soft-panel p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
            <Calendar className="text-blue-400" />
            {t('monthly_reports')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('sales_analysis')}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            title={t('select_month')}
          />

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value as any)}
            disabled={currentUserRole === 'Admin'}
            className="bg-white text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-50"
          >
            <option value="all">{t('all_branches')}</option>
            <option value="Kota Kinabalu">{t('kota_kinabalu')}</option>
            <option value="Kinabatangan">{t('kinabatangan')}</option>
          </select>

          <button
            onClick={handleExportPDF}
            disabled={loading || isExportingPDF}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
            title="Export as Print-friendly HTML"
          >
            <FileText size={16} />
            <span>{isExportingPDF ? 'Exporting...' : 'Print'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={loading || isExportingExcel}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
            title="Export as Excel"
          >
            <Download size={16} />
            <span>{isExportingExcel ? 'Exporting...' : 'Excel'}</span>
          </button>
        </div>
      </div>

      {currentUserRole === 'Admin' && (
        <div className="soft-panel p-3 rounded-lg flex items-start gap-2">
          <AlertCircle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {t('branch_access_warning')} <span className="font-semibold text-slate-900 dark:text-white">{currentUserBranch}</span>
          </p>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-600 dark:text-slate-400">{t('loading_report')}</div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="soft-card soft-card-green p-6 rounded-lg">
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">{t('total_revenue')}</p>
              <h3 className="text-3xl font-bold text-green-400">
                {formatCurrency(reportData.totalRevenue)}
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                {reportData.totalTransactions} {t('transactions')}
              </p>
            </div>

            <div className="soft-card soft-card-blue p-6 rounded-lg">
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">{t('avg_transaction')}</p>
              <h3 className="text-3xl font-bold text-blue-400">
                {formatCurrency(reportData.totalRevenue / reportData.totalTransactions || 0)}
              </h3>
              <p className="text-xs text-slate-500 mt-2">{t('revenue')}</p>
            </div>

            <div className="soft-card soft-card-rose p-6 rounded-lg">
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">{t('active_branches')}</p>
              <h3 className="text-3xl font-bold text-purple-400">
                {reportData.branchSummaries.length}
              </h3>
              <p className="text-xs text-slate-500 mt-2">{t('branch')}</p>
            </div>
          </div>

          {/* Branch Breakdown */}
          {reportData.branchSummaries.length > 0 && (
            <div className="soft-panel p-6 rounded-lg">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Users size={20} className="text-orange-400" />
                {t('branch_summary')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left px-4 py-2 text-slate-600 dark:text-slate-300">{t('branch')}</th>
                      <th className="text-right px-4 py-2 text-slate-600 dark:text-slate-300">{t('revenue')}</th>
                      <th className="text-right px-4 py-2 text-slate-600 dark:text-slate-300">{t('transactions')}</th>
                      <th className="text-right px-4 py-2 text-slate-600 dark:text-slate-300">{t('avg_transaction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.branchSummaries.map((branch) => (
                      <tr key={branch.branch} className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{branch.branch}</td>
                        <td className="text-right px-4 py-3 text-green-400 font-semibold">
                          {formatCurrency(branch.totalRevenue)}
                        </td>
                        <td className="text-right px-4 py-3 text-slate-700 dark:text-slate-300">{branch.transactionCount}</td>
                        <td className="text-right px-4 py-3 text-slate-500 dark:text-slate-400">
                          {formatCurrency(branch.avgTransaction)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Sales Trend */}
            {reportData.dailyData.length > 0 && (
              <div className="soft-panel p-6 rounded-lg">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-400" />
                  {t('daily_sales_trend')}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                      formatter={(value) => formatCurrency(value as number)}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top Products */}
            {reportData.topProducts.length > 0 && (
              <div className="soft-panel p-6 rounded-lg">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Package size={20} className="text-orange-400" />
                  {t('top_products_chart')}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#94a3b8" />
                    <YAxis dataKey="name" type="category" width={100} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Bar dataKey="quantity" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-600 dark:text-slate-400">{t('no_data_available')}</div>
      )}
    </div>
  );
}
