//untuk sekarang saya ada jumpa dua jenis report  yang dari row 2 hingga 255 adalah components/features/admin/MonthlyReport.tsx
'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Transaction, Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, Calendar, TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';

interface MonthlyReportProps {
  transactions: Transaction[];
  products: Product[];
}

export default function MonthlyReport({ transactions, products }: MonthlyReportProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filter transactions for the selected month
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => t.createdAt?.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Calculate Summary Metrics
  const summary = useMemo(() => {
    const totalRevenue = monthlyTransactions.reduce((sum, t) => sum + t.total, 0);
    // Assuming 30% profit margin as cost is not in Product type
    const netProfit = totalRevenue * 0.3; 
    
    // Previous Month Comparison
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2); // month is 1-indexed in split, 0-indexed in Date
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const prevTransactions = transactions.filter(t => t.createdAt?.startsWith(prevMonthStr));
    const prevRevenue = prevTransactions.reduce((sum, t) => sum + t.total, 0);
    
    const growth = prevRevenue === 0 ? 100 : ((totalRevenue - prevRevenue) / prevRevenue) * 100;

    return {
      totalRevenue,
      netProfit,
      growth,
      transactionCount: monthlyTransactions.length
    };
  }, [monthlyTransactions, transactions, selectedMonth]);

  // Top Selling Products Data
  const topProductsData = useMemo(() => {
    const productSales: Record<string, number> = {};
    monthlyTransactions.forEach(t => {
      t.items.forEach(item => {
        productSales[item.id] = (productSales[item.id] || 0) + item.quantity;
      });
    });

    return Object.entries(productSales)
      .map(([id, qty]) => ({
        name: products.find(p => p.id === id)?.name || 'Unknown',
        sales: qty
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
  }, [monthlyTransactions, products]);

  // Daily Sales Trends Data
  const salesTrendData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const data = new Array(daysInMonth).fill(0).map((_, i) => {
      const day = i + 1;
      return {
        date: `${day}`, // Just day number for cleaner x-axis
        fullDate: `${selectedMonth}-${String(day).padStart(2, '0')}`,
        amount: 0
      };
    });

    monthlyTransactions.forEach(t => {
      if (t.createdAt) {
        const day = parseInt(t.createdAt.split('-')[2]);
        if (day > 0 && day <= daysInMonth) {
          data[day - 1].amount += t.total;
        }
      }
    });

    return data;
  }, [monthlyTransactions, selectedMonth]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#000000', // Dark theme background
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Monthly_Report_${selectedMonth}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-red-500" />
            Monthly Report
        </h2>
        
        <div className="flex items-center gap-4">
            <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none"
            />
            
            <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
                <Download size={18} />
                <span>{isExporting ? 'Generating...' : 'Export PDF'}</span>
            </button>
        </div>
      </div>

      {/* Report Content - Wrapped for PDF Generation */}
      <div ref={reportRef} className="space-y-6 bg-black p-4 rounded-xl">
        
        {/* 1) Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Revenue */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                <div className="relative">
                    <p className="text-slate-400 text-sm font-medium mb-1">Total Revenue</p>
                    <h3 className="text-3xl font-bold text-green-400">{formatCurrency(summary.totalRevenue)}</h3>
                    <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
                        <DollarSign size={16} />
                        <span>Based on {summary.transactionCount} transactions</span>
                    </div>
                </div>
            </div>

            {/* Net Profit (Estimated) */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden group">
                 <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                 <div className="relative">
                    <p className="text-slate-400 text-sm font-medium mb-1">Net Profit (Est. 30%)</p>
                    <h3 className="text-3xl font-bold text-blue-400">{formatCurrency(summary.netProfit)}</h3>
                    <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
                        <TrendingUp size={16} />
                        <span>Profit Margin Calculation</span>
                    </div>
                 </div>
            </div>

            {/* Growth % */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden group">
                <div className={`absolute right-0 top-0 w-32 h-32 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 ${summary.growth >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`} />
                <div className="relative">
                    <p className="text-slate-400 text-sm font-medium mb-1">Monthly Growth</p>
                    <div className="flex items-end gap-2">
                        <h3 className={`text-3xl font-bold ${summary.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {summary.growth >= 0 ? '+' : ''}{summary.growth.toFixed(1)}%
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
                        {summary.growth >= 0 ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingDown size={16} className="text-red-500" />}
                        <span>vs Last Month</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2) Top Selling Products (Bar Chart) */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Package className="text-orange-500" />
                    Top Selling Products
                </h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" />
                            <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                itemStyle={{ color: '#f8fafc' }}
                                cursor={{ fill: '#334155', opacity: 0.4 }}
                            />
                            <Bar dataKey="sales" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3) Daily Sales Trends (Line Graph) */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="text-blue-500" />
                    Daily Sales Trend
                </h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salesTrendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="amount" 
                                stroke="#3b82f6" 
                                strokeWidth={3}
                                dot={{ fill: '#3b82f6', r: 4 }}
                                activeDot={{ r: 6, fill: '#60a5fa' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

//dan file yang ke 2 adalah components/features/admin/MonthlyReportSupabase.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useLanguage } from '@/context/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download, Calendar, TrendingUp, Package, Users, AlertCircle, FileText, Lock, RotateCcw } from 'lucide-react';

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
  branch?: string;
  totalRevenue: number;
  totalTransactions: number;
  dailyData: DailySale[];
  branchSummaries: BranchSummary[];
  topProducts: { name: string; quantity: number }[];
  totalReturns?: number;
  totalReturnQuantity?: number;
  returnsByReason?: { reason: string; count: number }[];
  returnItemsList?: { product_name: string; quantity: number; reason: string; created_at: string; salesman?: string }[];
  isClosed?: boolean;
  submittedAt?: string;
  submittedBy?: string;
  notes?: string;
}

interface MonthlyReportHistoryItem {
  id: string;
  month: string;
  branch: string;
  status: 'draft' | 'closed';
  submittedAt: string;
  submittedBy: string;
  notes?: string;
}

export default function MonthlyReportSupabase() {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedBranch, setSelectedBranch] = useState<'all' | 'Kota Kinabalu' | 'Kinabatangan'>('all');
  const [reportData, setReportData] = useState<MonthlyReportData | null>(null);
  const [reportHistory, setReportHistory] = useState<MonthlyReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentUserBranch, setCurrentUserBranch] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isClosingMonth, setIsClosingMonth] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [viewMode, setViewMode] = useState<'live' | 'closed'>('live');
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
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        month: selectedMonth,
        branch: selectedBranch,
        useClosed: viewMode === 'closed' ? 'true' : 'false',
      });
      const res = await fetch(`/api/reports/monthly?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || `Ralat server (${res.status})`;
        setFetchError(msg);
        setReportData(null);
        return;
      }
      const data: MonthlyReportData = await res.json();
      setReportData(data);
    } catch (error) {
      console.error('Error fetching report:', error);
      setFetchError('Gagal sambung ke server. Semak sambungan internet.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams({ branch: selectedBranch });
      const res = await fetch(`/api/reports/monthly-close?${params.toString()}`);
      if (!res.ok) {
        return;
      }
      const data: MonthlyReportHistoryItem[] = await res.json();
      setReportHistory(data);
    } catch (error) {
      console.error('Error fetching monthly close history:', error);
    }
  };

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedMonth, selectedBranch, viewMode]);

  useEffect(() => {
    fetchHistory();
  }, [selectedBranch]);

  const handleCloseMonth = async () => {
    if (!reportData) return;

    setIsClosingMonth(true);
    try {
      const response = await fetch('/api/reports/monthly-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          branch: selectedBranch,
          notes: closeNotes,
          snapshot: {
            month: reportData.month,
            totalRevenue: reportData.totalRevenue,
            totalTransactions: reportData.totalTransactions,
            dailyData: reportData.dailyData,
            branchSummaries: reportData.branchSummaries,
            topProducts: reportData.topProducts,
            totalReturns: reportData.totalReturns ?? 0,
            totalReturnQuantity: reportData.totalReturnQuantity ?? 0,
            returnsByReason: reportData.returnsByReason ?? [],
            returnItemsList: reportData.returnItemsList ?? [],
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        addToast(error.error || 'Failed to close monthly report', 'error');
        return;
      }

      addToast('Monthly report closed successfully', 'success');
      setViewMode('closed');
      setCloseNotes('');
      await fetchHistory();
      await fetchMonthlyReport();
    } catch (error) {
      console.error('Error closing monthly report:', error);
      addToast('Failed to close monthly report', 'error');
    } finally {
      setIsClosingMonth(false);
    }
  };

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

  if (loading) {
    return (
      <div className="soft-panel p-8 rounded-lg text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-3" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('loading_report')}</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="soft-panel p-8 rounded-lg text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
        <p className="text-red-500 font-semibold">Gagal Muatkan Laporan</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{fetchError}</p>
        <button
          onClick={fetchMonthlyReport}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          Cuba Semula
        </button>
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
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'live' | 'closed')}
            className="bg-white text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            <option value="live">Live Month</option>
            <option value="closed">Closed History</option>
          </select>

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

      <div className="soft-panel p-4 rounded-lg flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {reportData?.isClosed ? 'Closed monthly snapshot' : 'Live monthly sales view'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {reportData?.isClosed
                ? `Confirmed by ${reportData.submittedBy || 'Admin'} on ${new Date(reportData.submittedAt || '').toLocaleString()}`
                : 'This view updates automatically from current month sales until admin closes the month.'}
            </p>
          </div>
          {!reportData?.isClosed && (currentUserRole === 'Admin' || currentUserRole === 'Main Admin') && (
            <button
              onClick={handleCloseMonth}
              disabled={loading || isClosingMonth || !reportData}
              className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
            >
              <Lock size={16} />
              <span>{isClosingMonth ? 'Closing...' : 'Confirm Month End'}</span>
            </button>
          )}
        </div>

        {!reportData?.isClosed && (currentUserRole === 'Admin' || currentUserRole === 'Main Admin') && (
          <textarea
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
            placeholder="Notes for monthly close and report confirmation"
            className="min-h-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        )}

        {reportData?.isClosed && reportData.notes && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            {reportData.notes}
          </div>
        )}
      </div>

      {currentUserRole === 'Admin' && (
        <div className="soft-panel p-3 rounded-lg flex items-start gap-2">
          <AlertCircle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {t('branch_access_warning')} <span className="font-semibold text-slate-900 dark:text-white">{currentUserBranch}</span>
          </p>
        </div>
      )}

      {reportData ? (
        <div className="space-y-6">
          {/* No sales data notice */}
          {reportData.totalTransactions === 0 && (
            <div className="soft-panel p-8 rounded-lg text-center text-slate-400 dark:text-slate-500">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">Tiada rekod jualan untuk bulan ini</p>
              <p className="text-sm mt-1">Pilih bulan lain atau tambah data jualan terlebih dahulu</p>
            </div>
          )}
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

          {/* Returns Summary Card */}
          {((reportData.totalReturns ?? 0) > 0) && (
            <div className="soft-panel p-6 rounded-lg border-l-4 border-amber-500">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <RotateCcw size={20} className="text-amber-400" />
                Rekod Return / Refund Bulan Ini
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <div className="bg-amber-500/10 rounded-lg p-4">
                  <p className="text-xs text-amber-300 mb-1">Jumlah Return</p>
                  <p className="text-2xl font-bold text-amber-400">{reportData.totalReturns}</p>
                  <p className="text-xs text-white/40 mt-1">permohonan</p>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-4">
                  <p className="text-xs text-amber-300 mb-1">Jumlah Unit</p>
                  <p className="text-2xl font-bold text-amber-400">{reportData.totalReturnQuantity}</p>
                  <p className="text-xs text-white/40 mt-1">unit produk</p>
                </div>
                {reportData.returnsByReason && reportData.returnsByReason.length > 0 && (
                  <div className="col-span-2 bg-slate-800/40 rounded-lg p-4">
                    <p className="text-xs text-white/50 mb-2 uppercase tracking-wide">Sebab Return</p>
                    <div className="flex flex-wrap gap-2">
                      {reportData.returnsByReason.map((r) => (
                        <span key={r.reason} className="text-xs bg-amber-600/20 text-amber-300 border border-amber-600/30 rounded-full px-3 py-1">
                          {r.reason} ({r.count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {reportData.returnItemsList && reportData.returnItemsList.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-amber-700/30">
                      <tr>
                        <th className="text-left px-3 py-2 text-amber-300 font-semibold">Tarikh</th>
                        <th className="text-left px-3 py-2 text-amber-300 font-semibold">Produk</th>
                        <th className="text-center px-3 py-2 text-amber-300 font-semibold">Qty</th>
                        <th className="text-left px-3 py-2 text-amber-300 font-semibold">Sebab</th>
                        <th className="text-left px-3 py-2 text-amber-300 font-semibold">Salesman</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.returnItemsList.map((item, i) => (
                        <tr key={i} className="border-b border-slate-700/40 hover:bg-amber-500/5">
                          <td className="px-3 py-2 text-slate-400 text-xs">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString('ms-MY') : '-'}
                          </td>
                          <td className="px-3 py-2 text-white font-medium">{item.product_name}</td>
                          <td className="px-3 py-2 text-center text-amber-400 font-bold">{item.quantity}</td>
                          <td className="px-3 py-2 text-slate-300">{item.reason}</td>
                          <td className="px-3 py-2 text-slate-400 text-xs">{item.salesman || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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

          <div className="soft-panel p-6 rounded-lg">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Monthly History</h3>
            {reportHistory.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No confirmed monthly history yet.</p>
            ) : (
              <div className="space-y-3">
                {reportHistory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedMonth(item.month);
                      setSelectedBranch(item.branch as 'all' | 'Kota Kinabalu' | 'Kinabatangan');
                      setViewMode('closed');
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{item.month} • {item.branch}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Confirmed by {item.submittedBy} on {new Date(item.submittedAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">{item.status}</span>
                    </div>
                  </button>
                ))}
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