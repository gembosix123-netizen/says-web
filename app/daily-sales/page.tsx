'use client';

import SalesLayout from '@/components/layouts/SalesLayout';
import { ShoppingCart, TrendingUp, CreditCard, Calendar, Download, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const mockTransactions = [
  { id: 'INV-2023-001', shop: 'Kedai Runcit Ali', time: '10:23 AM', total: 450.00, items: 12, method: 'Cash', status: 'Completed' },
  { id: 'INV-2023-002', shop: 'Mini Market Bestari', time: '11:45 AM', total: 1250.50, items: 45, method: 'Credit', status: 'Completed' },
  { id: 'INV-2023-003', shop: 'Pasar Segar Maju', time: '02:15 PM', total: 320.00, items: 8, method: 'Cash', status: 'Completed' },
  { id: 'INV-2023-004', shop: 'Grocery Corner', time: '04:30 PM', total: 890.00, items: 25, method: 'Transfer', status: 'Pending' },
  { id: 'INV-2023-005', shop: 'Runcit Kita', time: '05:10 PM', total: 150.00, items: 5, method: 'Cash', status: 'Completed' },
];

export default function DailySalesPage() {
  return (
    <SalesLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Daily Sales</h1>
                <p className="text-slate-400">Overview of today's sales performance.</p>
            </div>
            <div className="flex gap-3">
                <button className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-xl transition-all flex items-center gap-2">
                    <Calendar size={18} /> Today
                </button>
                <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center gap-2">
                    <Download size={18} /> Export Report
                </button>
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-xl border border-emerald-500/20 p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <TrendingUp size={64} />
                </div>
                <p className="text-emerald-300 text-sm font-bold uppercase tracking-wider mb-1">Total Revenue</p>
                <p className="text-4xl font-bold text-white">{formatCurrency(3060.50)}</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-300 bg-emerald-500/10 w-fit px-2 py-1 rounded-lg">
                    <TrendingUp size={12} /> +12.5% vs yesterday
                </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        <ShoppingCart size={24} />
                    </div>
                    <span className="text-slate-400 text-xs">Today</span>
                </div>
                <p className="text-slate-400 text-sm font-medium mb-1">Orders Completed</p>
                <p className="text-3xl font-bold text-white">14</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                        <CreditCard size={24} />
                    </div>
                    <span className="text-slate-400 text-xs">Today</span>
                </div>
                <p className="text-slate-400 text-sm font-medium mb-1">Avg. Order Value</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(218.60)}</p>
            </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-white">Recent Transactions</h3>
                <button className="text-sm text-blue-400 hover:text-white transition-colors flex items-center gap-1">
                    View All <ChevronRight size={14} />
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-white/5 text-slate-300 font-medium">
                        <tr>
                            <th className="px-6 py-3">Invoice ID</th>
                            <th className="px-6 py-3">Shop Name</th>
                            <th className="px-6 py-3">Time</th>
                            <th className="px-6 py-3">Payment</th>
                            <th className="px-6 py-3">Items</th>
                            <th className="px-6 py-3">Amount</th>
                            <th className="px-6 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {mockTransactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-mono text-white">{tx.id}</td>
                                <td className="px-6 py-4 font-medium text-white">{tx.shop}</td>
                                <td className="px-6 py-4">{tx.time}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${
                                            tx.method === 'Cash' ? 'bg-emerald-500' :
                                            tx.method === 'Credit' ? 'bg-blue-500' : 'bg-purple-500'
                                        }`} />
                                        {tx.method}
                                    </div>
                                </td>
                                <td className="px-6 py-4">{tx.items}</td>
                                <td className="px-6 py-4 font-bold text-white">{formatCurrency(tx.total)}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                                        tx.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                    }`}>
                                        {tx.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </SalesLayout>
  );
}
