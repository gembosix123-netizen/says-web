import React, { useMemo } from 'react';
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

  // Top 5 Products
  const topProducts = useMemo(() => {
    const productSales: Record<string, number> = {};
    transactions.forEach(t => {
      t.items.forEach(item => {
        productSales[item.id] = (productSales[item.id] || 0) + item.quantity;
      });
    });
    return Object.entries(productSales)
      .map(([id, qty]) => ({
        product: products.find(p => p.id === id),
        qty
      }))
      .filter(item => item.product)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [transactions, products]);

  // Top Sales Agent
  const topAgents = useMemo(() => {
    const agentSales: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.salesmanId) {
          agentSales[t.salesmanId] = (agentSales[t.salesmanId] || 0) + t.total;
      }
    });
    return Object.entries(agentSales)
      .map(([id, total]) => ({
        user: salesUsers.find(u => u.id === id),
        total
      }))
      .filter(item => item.user)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [transactions, salesUsers]);

  // Stock Alerts (Latest audit for each product < 10)
  const lowStockAlerts = useMemo(() => {
     const alerts: any[] = [];
     stockAudits.forEach(audit => {
         audit.items.forEach(item => {
             if (item.physicalStock < 10) {
                 const customer = customers.find(c => c.id === audit.customerId);
                 alerts.push({
                     ...item,
                     customerName: customer?.name || 'Unknown',
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
      
      transactions.forEach(t => {
          if (t.createdAt) {
              const date = t.createdAt.split('T')[0];
              const dayData = data.find(d => d.date === date);
              if (dayData) {
                  dayData.total += t.total;
              }
          }
      });
      return data;
  }, [transactions]);

  const maxSales = Math.max(...salesTrend.map(d => d.total), 1);

  // Exchange/Return Tracking
  const exchangeReport = useMemo(() => {
    const report: { productName: string; quantity: number; reason: string }[] = [];
    transactions.forEach(t => {
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
  }, [transactions, products]);

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Master Sales Report (Summary) */}
            <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800 md:col-span-2">
                <h3 className="text-lg font-bold mb-4 text-white">Master Sales Report</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-4 rounded-xl">
                        <p className="text-slate-400 text-sm">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-400">{formatCurrency(transactions.reduce((acc, t) => acc + t.total, 0))}</p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl">
                        <p className="text-slate-400 text-sm">Total Transactions</p>
                        <p className="text-2xl font-bold text-blue-400">{transactions.length}</p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl">
                        <p className="text-slate-400 text-sm">Avg. Order Value</p>
                        <p className="text-2xl font-bold text-purple-400">
                            {formatCurrency(transactions.length > 0 ? transactions.reduce((acc, t) => acc + t.total, 0) / transactions.length : 0)}
                        </p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl">
                        <p className="text-slate-400 text-sm">Active Agents</p>
                        <p className="text-2xl font-bold text-orange-400">{new Set(transactions.map(t => t.salesmanId)).size}</p>
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

        {/* Low Stock Alerts */}
        <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-red-900/30">
            <h3 className="text-lg font-bold mb-4 text-red-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
                {t('low_stock_alerts')}
            </h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                            <th className="pb-3 pl-2">Product</th>
                            <th className="pb-3">Current Stock</th>
                            <th className="pb-3">Customer/Loc</th>
                            <th className="pb-3 text-right pr-2">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {lowStockAlerts.slice(0, 10).map((alert, idx) => ( // Limit to 10
                            <tr key={idx} className="group hover:bg-slate-800/50 transition-colors">
                                <td className="py-3 pl-2 font-medium text-slate-300 group-hover:text-white">{alert.productName}</td>
                                <td className="py-3">
                                    <span className="inline-flex items-center px-2 py-1 rounded bg-red-950/50 border border-red-900/50 text-red-500 text-xs font-bold">
                                        {alert.physicalStock} units
                                    </span>
                                </td>
                                <td className="py-3 text-slate-400 text-sm">{alert.customerName}</td> 
                                <td className="py-3 text-slate-500 text-xs text-right pr-2 font-mono">{new Date(alert.auditDate).toLocaleDateString()}</td>
                            </tr>
                        ))}
                         {lowStockAlerts.length === 0 && (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-600 italic">No low stock alerts</td></tr>
                        )}
                    </tbody>
                </table>
             </div>
        </div>
    </div>
  );
}
