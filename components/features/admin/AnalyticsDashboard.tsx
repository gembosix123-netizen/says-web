'use client';
import React, { useMemo, useState } from 'react';
import { Transaction, Product, User, StockAudit, Customer } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

interface AnalyticsDashboardProps {
  transactions: Transaction[];
  products: Product[];
  salesUsers: User[];
  stockAudits: StockAudit[];
  customers: Customer[];
}

export default function AnalyticsDashboard({ transactions, products, salesUsers, stockAudits, customers }: AnalyticsDashboardProps) {
  const { t } = useLanguage();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'thisMonth' | 'allTime' | 'custom'>('allTime');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Agent mapping for role-based access
  const agentMapping: { [key: string]: string } = {
    "u2": "Kota Kinabalu",
    "u3": "Kinabatangan"
  };

  // Get unique branches from transactions
  const branches = useMemo(() => {
    const uniqueBranches = new Set<string>();
    transactions?.forEach(t => {
      if (t.branch) uniqueBranches.add(t.branch);
    });
    return Array.from(uniqueBranches).sort();
  }, [transactions]);

  // Filter transactions based on selected branch + date range
  const filteredTransactions = useMemo(() => {
    const byBranch = selectedBranch === 'all'
      ? transactions || []
      : (transactions || []).filter(t => t.branch === selectedBranch);

    if (datePreset === 'allTime') return byBranch;

    const now = new Date();
    const nowTs = now.getTime();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOf7Days = startOfToday - (6 * 24 * 60 * 60 * 1000);
    const startOf30Days = startOfToday - (29 * 24 * 60 * 60 * 1000);

    return byBranch.filter((transaction) => {
      if (!transaction.createdAt) return false;
      const ts = new Date(transaction.createdAt).getTime();
      if (Number.isNaN(ts)) return false;

      if (datePreset === 'today') {
        return ts >= startOfToday && ts <= nowTs;
      }
      if (datePreset === '7days') {
        return ts >= startOf7Days && ts <= nowTs;
      }
      if (datePreset === '30days') {
        return ts >= startOf30Days && ts <= nowTs;
      }
      if (datePreset === 'thisMonth') {
        return ts >= startOfMonth && ts <= nowTs;
      }

      if (datePreset === 'custom') {
        if (!customStartDate || !customEndDate) return true;
        const start = new Date(`${customStartDate}T00:00:00`).getTime();
        const end = new Date(`${customEndDate}T23:59:59`).getTime();
        if (Number.isNaN(start) || Number.isNaN(end)) return true;
        return ts >= start && ts <= end;
      }

      return true;
    });
  }, [transactions, selectedBranch, datePreset, customStartDate, customEndDate]);

  // Top 5 Products
  const topProducts = useMemo(() => {
    const productSales: Record<string, number> = {};
    filteredTransactions?.forEach(t => {
      t.items?.forEach(item => {
        productSales[item.id] = (productSales[item.id] || 0) + Number(item.quantity || 0);
      });
    });
    return Object.entries(productSales)
      .map(([id, qty]) => ({
        product: products.find(p => p.id === id),
        qty: Number(qty) || 0
      }))
      .filter(item => item.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filteredTransactions, products]);

  // Top Sales Agent with location mapping
  const topAgents = useMemo(() => {
    const agentSales: Record<string, number> = {};
    filteredTransactions?.forEach(t => {
      if (t.salesmanId) {
          agentSales[t.salesmanId] = (agentSales[t.salesmanId] || 0) + Number(t.total || 0);
      }
    });
    return Object.entries(agentSales)
      .map(([id, total]) => ({
        user: salesUsers.find(u => u.id === id),
        total: Number(total) || 0,
        location: agentMapping[id] || 'Unknown'
      }))
      .filter(item => item.user)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredTransactions, salesUsers]);

  // Keep these references to preserve existing prop contract while this section is hidden.
  void stockAudits;
  void customers;

  // Sales Trend (Last 7 days)
  const salesTrend = useMemo(() => {
      const days = 7;
      const data = new Array(days).fill(0).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (days - 1 - i));
          return { date: d.toISOString().split('T')[0], total: 0 };
      });
      
      filteredTransactions?.forEach(t => {
          if (t.createdAt) {
              const date = t.createdAt.split('T')[0];
              const dayData = data.find(d => d.date === date);
              if (dayData) {
                  dayData.total += Number(t.total || 0);
              }
          }
      });
      return data;
  }, [filteredTransactions]);

  const maxSales = Math.max(...salesTrend.map(d => d.total), 1);

  // Exchange/Return Tracking
  const exchangeReport = useMemo(() => {
    const report: { productName: string; quantity: number; reason: string }[] = [];
    filteredTransactions?.forEach(t => {
      if (t.exchangeItems) {
        t.exchangeItems.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            report.push({
                productName: product?.name || 'Unknown',
                quantity: item.quantity,
                reason: item.reason
            });
        });
      }
    });
    return report;
  }, [filteredTransactions, products]);

  return (
    <div className="space-y-6">
        {/* Main filter row */}
        <div className="bg-slate-900/50 backdrop-blur-sm p-4 rounded-lg border border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-300">Tapis Mengikut Cawangan:</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Semua Cawangan</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <span className="text-sm text-slate-300">Date Range:</span>
            {[
              { key: 'today', label: 'Today' },
              { key: '7days', label: 'Last 7 Days' },
              { key: '30days', label: 'Last 30 Days' },
              { key: 'thisMonth', label: 'This Month' },
              { key: 'allTime', label: 'All Time' },
              { key: 'custom', label: 'Custom' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setDatePreset(item.key as 'today' | '7days' | '30days' | 'thisMonth' | 'allTime' | 'custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  datePreset === item.key
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-slate-800 text-white border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-slate-800 text-white border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Master Sales Report (Summary) */}
            <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800 md:col-span-2">
                <h3 className="text-lg font-bold mb-4 text-white">Master Sales Report</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-4 rounded-xl">
                        <p className="text-slate-400 text-sm">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-400">{formatCurrency(filteredTransactions.reduce((acc, t) => acc + Number(t.total || 0), 0))}</p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl">
                        <p className="text-slate-400 text-sm">Total Transactions</p>
                        <p className="text-2xl font-bold text-blue-400">{filteredTransactions.length}</p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl">
                        <p className="text-slate-400 text-sm">Avg. Order Value</p>
                        <p className="text-2xl font-bold text-purple-400">
                            {formatCurrency(filteredTransactions.length > 0 ? filteredTransactions.reduce((acc, t) => acc + Number(t.total || 0), 0) / filteredTransactions.length : 0)}
                        </p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl">
                        <p className="text-slate-400 text-sm">Active Agents</p>
                        <p className="text-2xl font-bold text-orange-400">{new Set(filteredTransactions.map(t => t.salesmanId)).size}</p>
                    </div>
                </div>
            </div>

            {/* Exchange/Return Tracking */}
            <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-orange-900/30 md:col-span-2">
                <h3 className="text-lg font-bold mb-4 text-orange-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"/>
                    Exchange & Return Tracking (Disposal)
                </h3>
                <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-slate-900">
                            <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="pb-3 pl-2">Product</th>
                                <th className="pb-3">Qty</th>
                                <th className="pb-3">Reason</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {exchangeReport.map((item, idx) => (
                                <tr key={idx} className="group hover:bg-slate-800/50 transition-colors">
                                    <td className="py-3 pl-2 font-medium text-slate-300">{item.productName}</td>
                                    <td className="py-3 font-bold text-orange-400">{item.quantity}</td>
                                    <td className="py-3 text-slate-400 text-sm">{item.reason}</td>
                                </tr>
                            ))}
                            {exchangeReport.length === 0 && (
                                <tr><td colSpan={3} className="py-8 text-center text-slate-600 italic">No returns recorded</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top Products */}
            <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
                <h3 className="text-lg font-bold mb-4 text-white">{t('top_products')}</h3>
                <div className="space-y-3">
                    {topProducts.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                </span>
                                <span className="text-slate-200 font-medium">{item.product?.name}</span>
                            </div>
                            <span className="bg-blue-900/30 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-lg text-sm font-bold">
                                {item.qty} sold
                            </span>
                        </div>
                    ))}
                    {topProducts.length === 0 && <p className="text-slate-500 italic">No sales data</p>}
                </div>
            </div>

            {/* Top Agents */}
            <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
                <h3 className="text-lg font-bold mb-4 text-white">{t('top_agents')}</h3>
                <div className="space-y-3">
                    {topAgents.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                </span>
                                <span className="text-slate-200 font-medium">{item.user?.name}</span>
                            </div>
                            <span className="text-emerald-400 font-bold font-mono bg-emerald-900/20 px-2 py-1 rounded">
                                {formatCurrency(item.total)}
                            </span>
                        </div>
                    ))}
                     {topAgents.length === 0 && <p className="text-slate-500 italic">No data</p>}
                </div>
            </div>
        </div>

        {/* Sales Trend Graph */}
        <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
            <h3 className="text-lg font-bold mb-4 text-white">{t('sales_trend')} (Last 7 Days)</h3>
            <div className="flex items-end space-x-2 h-48 pt-4">
                {salesTrend.map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                         <div 
                            className="w-full bg-gradient-to-t from-red-900/50 to-red-600 rounded-t-sm transition-all duration-500 hover:to-red-500 relative group-hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                            style={{ height: `${Math.max((day.total / maxSales) * 100, 2)}%` }}
                         ></div>
                         <p className="text-xs text-slate-500 mt-3 font-mono">{day.date.split('-')[2]}</p>
                         
                         {/* Tooltip */}
                         <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs p-2 rounded border border-slate-700 shadow-xl pointer-events-none z-10 whitespace-nowrap">
                             <div className="font-bold">{day.date}</div>
                             <div className="text-emerald-400">{formatCurrency(day.total)}</div>
                         </div>
                    </div>
                ))}
            </div>
        </div>

    </div>
  );
}
