'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, Product, User, StockAudit, Customer } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import DateRangePicker, { DateRange } from '@/components/ui/DateRangePicker';

interface AnalyticsDashboardProps {
  transactions: Transaction[];
  products: Product[];
  salesUsers: User[];
  stockAudits: StockAudit[];
  customers: Customer[];
}

interface LowStockAlert {
    productId: string;
    productName: string;
    physicalStock: number;
    customerName: string;
    auditDate: string;
}

interface ExchangeReturn {
  id: string;
  product_name: string;
  quantity: number;
  type: 'exchange' | 'return' | 'disposal';
  reason: string;
  reason_details?: string;
  status: string;
  created_at: string;
}

const AGENT_BRANCH_MAP: Record<string, string> = {
    u2: 'Kota Kinabalu',
    u3: 'Kinabatangan'
};

export default function AnalyticsDashboard({ transactions, products, salesUsers, stockAudits, customers }: AnalyticsDashboardProps) {
  const { t } = useLanguage();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [exchangeReturns, setExchangeReturns] = useState<ExchangeReturn[]>([]);

  // Fetch exchange/return data
  useEffect(() => {
    const fetchExchangeReturns = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedBranch !== 'all') {
          params.set('branch', selectedBranch);
        }
        const response = await fetch(`/api/exchange-returns?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setExchangeReturns(data || []);
        }
      } catch (error) {
        console.error('Failed to fetch exchange/returns:', error);
      }
    };
    fetchExchangeReturns();
  }, [selectedBranch]);

  // Get unique branches from transactions
  const branches = useMemo(() => {
    const uniqueBranches = new Set<string>();
    transactions?.forEach(t => {
      if (t.branch) uniqueBranches.add(t.branch);
    });
    return Array.from(uniqueBranches).sort();
  }, [transactions]);

  // Filter transactions based on selected branch
  const filteredTransactions = useMemo(() => {
    if (selectedBranch === 'all') {
      return transactions || [];
    }
    return (transactions || []).filter(t => t.branch === selectedBranch);
  }, [transactions, selectedBranch]);

    const monthlyTransactions = useMemo(() => {
        if (!dateRange.start && !dateRange.end) return filteredTransactions;
        return filteredTransactions.filter((transaction) => {
            const d = transaction.createdAt?.split('T')[0] ?? '';
            if (dateRange.start && d < dateRange.start) return false;
            if (dateRange.end   && d > dateRange.end)   return false;
            return true;
        });
    }, [filteredTransactions, dateRange]);

    const filteredSalesUsers = useMemo(() => {
        if (selectedBranch === 'all') {
            return salesUsers;
        }
        return salesUsers.filter((user) => user.branch === selectedBranch);
    }, [salesUsers, selectedBranch]);

  // Top 5 Products
  const topProducts = useMemo(() => {
    const productSales: Record<string, number> = {};
        monthlyTransactions.forEach(t => {
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
    }, [monthlyTransactions, products]);

  // Top Sales Agent with location mapping
    const topAgents = useMemo(() => {
    const agentSales: Record<string, number> = {};
        monthlyTransactions.forEach(t => {
      if (t.salesmanId) {
                agentSales[t.salesmanId] = (agentSales[t.salesmanId] || 0) + Number(t.total || 0);
      }
    });

    return Object.entries(agentSales)
      .map(([id, total]) => ({
                user: filteredSalesUsers.find(u => u.id === id),
        total: Number(total) || 0,
                location: AGENT_BRANCH_MAP[id] || 'Unknown'
      }))
      .filter(item => item.user)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    }, [monthlyTransactions, filteredSalesUsers]);

    const monthlySummary = useMemo(() => {
        const totalRevenue = monthlyTransactions.reduce((acc, transaction) => acc + Number(transaction.total || 0), 0);
        const totalTransactions = monthlyTransactions.length;
        const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
        const activeAgents = new Set(monthlyTransactions.map((transaction) => transaction.salesmanId).filter(Boolean)).size;

        return {
            totalRevenue,
            totalTransactions,
            averageOrderValue,
            activeAgents,
        };
    }, [monthlyTransactions]);

  // Stock Alerts (Latest audit for each product < 10)
  const lowStockAlerts = useMemo(() => {
     const alerts: LowStockAlert[] = [];
     stockAudits?.forEach(audit => {
         audit.items?.forEach(item => {
             if (item.physicalStock < 10) {
                 // Try to find customer by ID
                 const customer = customers.find(c => c.id === audit.customerId);
                 
                 // Determine customer/location name with better fallbacks
                 let customerName = 'Unknown';
                 if (customer?.name) {
                   customerName = customer.name;
                 } else if (audit.customerId) {
                   // Use customer ID as fallback if no match found
                   customerName = `Customer ${audit.customerId.slice(0, 8)}`;
                 }
                 
                 alerts.push({
                     productId: item.productId,
                     productName: item.productName,
                     physicalStock: item.physicalStock,
                     customerName: customerName,
                     auditDate: audit.createdAt,
                 });
             }
         });
     });
     return alerts.sort((a, b) => new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime());
  }, [stockAudits, customers]);

  // Sales Trend (Last 7 days)
  const salesTrend = useMemo(() => {
      const days = 7;
      const data = new Array(days).fill(0).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (days - 1 - i));
          return { date: d.toISOString().split('T')[0], total: 0 };
      });
      
      monthlyTransactions.forEach(t => {
          if (t.createdAt) {
              const date = t.createdAt.split('T')[0];
              const dayData = data.find(d => d.date === date);
              if (dayData) {
                  dayData.total += Number(t.total || 0);
              }
          }
      });
      return data;
  }, [monthlyTransactions]);

  const maxSales = Math.max(...salesTrend.map(d => d.total), 1);

  // Exchange/Return Tracking - Use real data from API
  const exchangeReport = useMemo(() => {
    return exchangeReturns.map(item => ({
      productName: item.product_name,
      quantity: item.quantity,
      reason: item.reason,
      type: item.type,
      status: item.status,
      createdAt: item.created_at
    }));
  }, [exchangeReturns]);

  return (
    <div className="space-y-6">
        {/* Branch Filter */}
                <div className="soft-panel p-4 rounded-lg flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-3">{t('filter_by_branch')}:</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="bg-white text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                        >
                            <option value="all">{t('all_branches')}</option>
                            {branches.map(branch => (
                                <option key={branch} value={branch}>{branch}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <DateRangePicker value={dateRange} onChange={setDateRange} lightMode />
                    </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Master Sales Report (Summary) */}
            <div className="soft-panel p-6 md:col-span-2">
                <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('master_sales_report')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('showing_data_for')} {dateRange.start && dateRange.end ? `${dateRange.start} → ${dateRange.end}` : t('all_time')}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="soft-card soft-card-green p-4 rounded-xl">
                        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('total_revenue')}</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-green-400">{formatCurrency(monthlySummary.totalRevenue)}</p>
                    </div>
                    <div className="soft-card soft-card-blue p-4 rounded-xl">
                        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('total_transactions_label')}</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{monthlySummary.totalTransactions}</p>
                    </div>
                    <div className="soft-card soft-card-rose p-4 rounded-xl">
                        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('avg_order_value')}</p>
                        <p className="text-2xl font-bold text-violet-600 dark:text-purple-400">
                            {formatCurrency(monthlySummary.averageOrderValue)}
                        </p>
                    </div>
                    <div className="soft-card p-4 rounded-xl">
                        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('active_agents')}</p>
                        <p className="text-2xl font-bold text-amber-600 dark:text-orange-400">{monthlySummary.activeAgents}</p>
                    </div>
                </div>
            </div>

            {/* Exchange/Return Tracking */}
            <div className="soft-panel p-6 border-orange-200 dark:border-orange-900/30 md:col-span-2">
                <h3 className="text-lg font-bold mb-4 text-amber-600 dark:text-orange-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-orange-500"/>
                    {t('exchange_return_tracking')}
                </h3>
                <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 soft-table-head">
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="pb-3 pl-2">{t('product')}</th>
                                <th className="pb-3">{t('type_label')}</th>
                                <th className="pb-3">{t('qty')}</th>
                                <th className="pb-3">{t('reason')}</th>
                                <th className="pb-3">{t('status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {exchangeReport.map((item: any, idx) => (
                                <tr key={idx} className="group hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="py-3 pl-2 font-medium text-slate-700 dark:text-slate-300">{item.productName}</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            item.type === 'exchange' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            item.type === 'return' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="py-3 font-bold text-amber-600 dark:text-orange-400">{item.quantity}</td>
                                    <td className="py-3 text-slate-500 dark:text-slate-400 text-sm">{item.reason}</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            item.status === 'approved' || item.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            item.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {exchangeReport.length === 0 && (
                                <tr><td colSpan={5} className="py-8 text-center text-slate-500 italic">{t('no_returns')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top Products */}
            <div className="soft-panel p-6">
                <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">{t('top_products')}</h3>
                <div className="space-y-3">
                    {topProducts.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                </span>
                                <span className="text-slate-800 dark:text-slate-200 font-medium">{item.product?.name}</span>
                            </div>
                            <span className="bg-blue-900/30 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-lg text-sm font-bold">
                                {item.qty} {t('sold')}
                            </span>
                        </div>
                    ))}
                    {topProducts.length === 0 && <p className="text-slate-500 italic">{t('no_sales_data')}</p>}
                </div>
            </div>

            {/* Top Agents */}
            <div className="soft-panel p-6">
                <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('top_agents')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('ranking_for')} {dateRange.start && dateRange.end ? `${dateRange.start} → ${dateRange.end}` : t('all_time')}</p>
                </div>
                <div className="space-y-3">
                    {topAgents.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                </span>
                                <span className="text-slate-800 dark:text-slate-200 font-medium">{item.user?.name}</span>
                            </div>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono bg-emerald-100 dark:bg-emerald-900/20 px-2 py-1 rounded">
                                {formatCurrency(item.total)}
                            </span>
                        </div>
                    ))}
                     {topAgents.length === 0 && <p className="text-slate-500 italic">{t('no_data')}</p>}
                </div>
            </div>
        </div>

        {/* Sales Trend Graph */}
        <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-sm dark:shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">{t('sales_trend')} ({t('last_7_days')})</h3>
            <div className="flex items-end space-x-2 h-48 pt-4">
                {salesTrend.map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                         <div 
                            className="w-full bg-gradient-to-t from-red-900/50 to-red-600 rounded-t-sm transition-all duration-500 hover:to-red-500 relative group-hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                            style={{ height: `${Math.max((day.total / maxSales) * 100, 2)}%` }}
                         ></div>
                         <p className="text-xs text-slate-500 mt-3 font-mono">{day.date.split('-')[2]}</p>
                         
                         {/* Tooltip */}
                         <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs p-2 rounded border border-slate-700 shadow-xl pointer-events-none z-10 whitespace-nowrap">
                             <div className="font-bold">{day.date}</div>
                             <div className="text-emerald-400">{formatCurrency(day.total)}</div>
                         </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white/90 dark:bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-sm dark:shadow-xl border border-red-200 dark:border-red-900/30">
            <h3 className="text-lg font-bold mb-4 text-red-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
                {t('low_stock_alerts')}
            </h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                            <th className="pb-3 pl-2">{t('product')}</th>
                            <th className="pb-3">{t('current_stock')}</th>
                            <th className="pb-3">{t('customer_loc')}</th>
                            <th className="pb-3 text-right pr-2">{t('date')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {lowStockAlerts.slice(0, 10).map((alert, idx) => ( // Limit to 10
                            <tr key={idx} className="group hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="py-3 pl-2 font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">{alert.productName}</td>
                                <td className="py-3">
                                    <span className="inline-flex items-center px-2 py-1 rounded bg-red-950/50 border border-red-900/50 text-red-500 text-xs font-bold">
                                        {alert.physicalStock} units
                                    </span>
                                </td>
                                <td className="py-3 text-slate-500 dark:text-slate-400 text-sm">{alert.customerName}</td> 
                                <td className="py-3 text-slate-500 text-xs text-right pr-2 font-mono">{new Date(alert.auditDate).toLocaleDateString()}</td>
                            </tr>
                        ))}
                         {lowStockAlerts.length === 0 && (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-600 italic">{t('no_low_stock')}</td></tr>
                        )}
                    </tbody>
                </table>
             </div>
        </div>
    </div>
  );
}
