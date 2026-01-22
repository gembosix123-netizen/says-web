'use client';

import React, { useMemo, useState } from 'react';
import { Transaction, User, CommissionPayout } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, User as UserIcon, CheckCircle, Clock, Search, Save, Edit2 } from 'lucide-react';

interface CommissionDashboardProps {
  transactions: Transaction[];
  users: User[];
  payouts: CommissionPayout[];
}

export default function CommissionDashboard({ transactions, users: initialUsers, payouts }: CommissionDashboardProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempRate, setTempRate] = useState<string>('');

  // 1. Filter only completed sales
  const completedSales = useMemo(() => {
    return transactions.filter(t => t.status === 'Completed' && t.salesmanId);
  }, [transactions]);

  // 2. Aggregate by Salesman
  const staffCommissions = useMemo(() => {
    const stats: Record<string, {
      user: User | undefined;
      totalSales: number;
      commissionEarned: number;
      paidAmount: number;
    }> = {};

    // Initialize for all sales users
    users.filter(u => u.role === 'Sales').forEach(u => {
      stats[u.id] = {
        user: u,
        totalSales: 0,
        commissionEarned: 0,
        paidAmount: 0
      };
    });

    // Sum Sales & Commissions
    completedSales.forEach(t => {
      if (stats[t.salesmanId!]) {
        stats[t.salesmanId!].totalSales += t.total;
        
        // Use user specific rate or default 5%
        const rate = stats[t.salesmanId!].user?.commissionRate || 0.05;
        stats[t.salesmanId!].commissionEarned += t.total * rate;
      }
    });

    // Sum Payouts
    payouts.forEach(p => {
      if (stats[p.userId]) {
        stats[p.userId].paidAmount += p.amount;
      }
    });

    return Object.values(stats).map(s => ({
        ...s,
        pendingAmount: s.commissionEarned - s.paidAmount
    })).sort((a, b) => b.pendingAmount - a.pendingAmount);

  }, [completedSales, users, payouts]);

  const filteredStaff = staffCommissions.filter(s => 
    s.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.user?.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPending = staffCommissions.reduce((sum, s) => sum + s.pendingAmount, 0);
  const totalPaid = staffCommissions.reduce((sum, s) => sum + s.paidAmount, 0);

  const startEditing = (user: User) => {
    setEditingId(user.id);
    setTempRate(((user.commissionRate || 0.05) * 100).toString());
  };

  const saveRate = async (userId: string) => {
    try {
        const rate = parseFloat(tempRate) / 100;
        if (isNaN(rate) || rate < 0) return;

        const res = await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: userId, commissionRate: rate })
        });

        if (res.ok) {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, commissionRate: rate } : u));
            setEditingId(null);
        } else {
            alert('Failed to update rate');
        }
    } catch (error) {
        console.error('Failed to save rate', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <p className="text-slate-400 text-sm font-medium mb-1">Total Commission Liability</p>
            <h3 className="text-3xl font-bold text-white">{formatCurrency(totalPending + totalPaid)}</h3>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
            <p className="text-slate-400 text-sm font-medium mb-1">Total Paid Out</p>
            <h3 className="text-3xl font-bold text-green-400">{formatCurrency(totalPaid)}</h3>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/10 rounded-full -mr-10 -mt-10 animate-pulse" />
            <p className="text-slate-400 text-sm font-medium mb-1">Pending Payouts</p>
            <h3 className="text-3xl font-bold text-red-400">{formatCurrency(totalPending)}</h3>
        </div>
      </div>

      {/* Staff Breakdown */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserIcon className="text-blue-500" />
                Staff Commission Breakdown
            </h3>
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                    type="text" 
                    placeholder="Search staff..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-900 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                        <th className="px-6 py-4">Staff Member</th>
                        <th className="px-6 py-4">Rate (%)</th>
                        <th className="px-6 py-4">Total Sales</th>
                        <th className="px-6 py-4">Total Earned</th>
                        <th className="px-6 py-4">Paid</th>
                        <th className="px-6 py-4 text-right">Pending Balance</th>
                        <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {filteredStaff.map((staff) => (
                        <tr key={staff.user?.id} className="hover:bg-slate-800/50 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                                        {staff.user?.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-medium text-white">{staff.user?.name}</p>
                                        <p className="text-xs text-slate-500">@{staff.user?.username}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-400">
                                {editingId === staff.user?.id ? (
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={tempRate}
                                            onChange={(e) => setTempRate(e.target.value)}
                                            className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            autoFocus
                                        />
                                        <button onClick={() => saveRate(staff.user!.id)} className="text-green-400 hover:text-green-300">
                                            <Save size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group/edit">
                                        <span>{((staff.user?.commissionRate || 0.05) * 100).toFixed(1)}%</span>
                                        <button 
                                            onClick={() => startEditing(staff.user!)}
                                            className="opacity-0 group-hover/edit:opacity-100 text-slate-500 hover:text-blue-400 transition-opacity"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 text-slate-300">
                                {formatCurrency(staff.totalSales)}
                            </td>
                            <td className="px-6 py-4 font-bold text-blue-400">
                                {formatCurrency(staff.commissionEarned)}
                            </td>
                            <td className="px-6 py-4 text-green-400">
                                {formatCurrency(staff.paidAmount)}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${staff.pendingAmount > 0 ? 'bg-red-900/30 text-red-400 border border-red-900/50' : 'bg-slate-800 text-slate-500'}`}>
                                    {formatCurrency(staff.pendingAmount)}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button 
                                    className="text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    disabled={staff.pendingAmount <= 0}
                                    title="Mark as Paid (Feature coming soon)"
                                >
                                    <CheckCircle size={20} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {filteredStaff.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">
                                No sales staff found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
