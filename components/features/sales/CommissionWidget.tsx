'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, User, CommissionPayout } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, Wallet, History, ChevronDown, ChevronUp } from 'lucide-react';

interface CommissionWidgetProps {
  user: User; // The currently logged-in sales user
}

export default function CommissionWidget({ user }: CommissionWidgetProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Fetch data on mount (Client-side for Sales Console)
  useEffect(() => {
    async function fetchData() {
      try {
        const [txRes, payoutRes] = await Promise.all([
          fetch('/api/sales').then(res => res.json()), // Assuming this returns all transactions, we might need filtering
          fetch('/api/payouts').then(res => res.json().catch(() => ({ data: [] }))) // New endpoint or mock
        ]);

        // If no payout API exists yet, we'll just use empty array
        const txData = txRes.data || [];
        const payoutData = payoutRes.data || [];
        
        setTransactions(txData);
        setPayouts(payoutData);
      } catch (error) {
        console.error('Failed to fetch commission data', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [user.id]);

  const stats = useMemo(() => {
    // 1. Calculate Total Earned
    const mySales = transactions.filter(t => t.salesmanId === user.id && t.status === 'Completed');
    const totalSales = mySales.reduce((sum, t) => sum + t.total, 0);
    const rate = user.commissionRate || 0.05;
    const totalEarned = totalSales * rate;

    // 2. Calculate Paid
    const myPayouts = payouts.filter(p => p.userId === user.id);
    const totalPaid = myPayouts.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalSales,
      totalEarned,
      totalPaid,
      pending: totalEarned - totalPaid,
      recentSales: mySales.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 3)
    };
  }, [transactions, payouts, user]);

  if (loading) return <div className="animate-pulse bg-slate-800 h-24 rounded-xl"></div>;

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden relative group">
        {/* Glow Effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all duration-500" />
        
        {/* Header / Main View */}
        <div className="p-5 cursor-pointer relative z-10" onClick={() => setExpanded(!expanded)}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-300 text-sm font-medium flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                        <Wallet size={16} />
                    </div>
                    My Commission
                </h3>
                {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </div>
            
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-3xl font-bold text-white tracking-tight">{formatCurrency(stats.pending)}</p>
                    <p className="text-xs text-slate-400 mt-1">Available Balance</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                        +{formatCurrency(stats.totalEarned)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Lifetime Earned</p>
                </div>
            </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
            <div className="bg-black/20 p-5 border-t border-white/5 space-y-4 backdrop-blur-sm relative z-10">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-400 mb-1">Current Active Rate</p>
                        <p className="text-xl font-bold text-white">{(user.commissionRate || 0.05) * 100}%</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-400 mb-1">Total Sales</p>
                        <p className="text-xl font-bold text-blue-400">{formatCurrency(stats.totalSales)}</p>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <History size={12} />
                        Recent Earnings
                    </h4>
                    <div className="space-y-2">
                        {stats.recentSales.map(sale => (
                            <div key={sale.id} className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                <div>
                                    <p className="text-slate-200 font-medium">Order #{sale.id.slice(0, 6)}</p>
                                    <p className="text-xs text-slate-500">{new Date(sale.createdAt || '').toLocaleDateString()}</p>
                                </div>
                                <span className="font-mono font-bold text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded">
                                    +{formatCurrency(sale.total * (user.commissionRate || 0.05))}
                                </span>
                            </div>
                        ))}
                        {stats.recentSales.length === 0 && (
                            <p className="text-xs text-slate-500 italic text-center py-2">No completed sales yet.</p>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
