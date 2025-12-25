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

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold mb-4">{t('top_products')}</h3>
                <div className="space-y-3">
                    {topProducts.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                            <span className="text-slate-700 font-medium">{idx + 1}. {item.product?.name}</span>
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-lg text-sm font-bold">{item.qty} sold</span>
                        </div>
                    ))}
                    {topProducts.length === 0 && <p className="text-slate-400 italic">No sales data</p>}
                </div>
            </div>

            {/* Top Agents */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold mb-4">{t('top_agents')}</h3>
                <div className="space-y-3">
                    {topAgents.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                            <span className="text-slate-700 font-medium">{idx + 1}. {item.user?.name}</span>
                            <span className="text-green-600 font-bold">{formatCurrency(item.total)}</span>
                        </div>
                    ))}
                     {topAgents.length === 0 && <p className="text-slate-400 italic">No data</p>}
                </div>
            </div>
        </div>

        {/* Sales Trend Graph */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-4">{t('sales_trend')} (Last 7 Days)</h3>
            <div className="flex items-end space-x-2 h-40">
                {salesTrend.map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                         <div 
                            className="w-full bg-blue-500 rounded-t-sm transition-all duration-500 hover:bg-blue-600"
                            style={{ height: `${(day.total / maxSales) * 100}%` }}
                         ></div>
                         <p className="text-xs text-slate-500 mt-1">{day.date.split('-')[2]}</p>
                         
                         {/* Tooltip */}
                         <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs p-1 rounded">
                             {formatCurrency(day.total)}
                         </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-200">
            <h3 className="text-lg font-bold mb-4 text-red-600">{t('low_stock_alerts')}</h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-sm">
                            <th className="pb-2">Product</th>
                            <th className="pb-2">Current Stock (Audit)</th>
                            <th className="pb-2">Customer/Loc</th>
                            <th className="pb-2">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lowStockAlerts.slice(0, 10).map((alert, idx) => ( // Limit to 10
                            <tr key={idx} className="border-b border-slate-100 last:border-0">
                                <td className="py-3 font-medium text-slate-700">{alert.productName}</td>
                                <td className="py-3 text-red-600 font-bold">{alert.physicalStock}</td>
                                <td className="py-3 text-slate-500 text-sm">{alert.customerName}</td> 
                                <td className="py-3 text-slate-400 text-xs">{new Date(alert.auditDate).toLocaleDateString()}</td>
                            </tr>
                        ))}
                         {lowStockAlerts.length === 0 && (
                            <tr><td colSpan={4} className="py-4 text-center text-slate-400 italic">No low stock alerts</td></tr>
                        )}
                    </tbody>
                </table>
             </div>
        </div>
    </div>
  );
}
