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
    const [selectedBranch, setSelectedBranch] = useState<'all' | 'Kota Kinabalu' | 'Kinabatangan'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempRate, setTempRate] = useState<string>('');

  // 1. Filter completed sales and calculate commission eligibility
  const eligibleSalesWithCommission = useMemo(() => {
    return transactions
      .filter(t => t.status === 'Completed' && t.salesmanId)
      .map(t => {
        const saleDate = t.createdAt ? new Date(t.createdAt) : new Date();
        const paymentMethod = (t as any).payment_method || t.payment?.method || 'cash';
        const payStatus = (t as any).paymentStatus || 'paid';
        let commissionAmount = 0;
        let commissionType = 'none';

        // Cash sales: 4% commission immediately
        if (paymentMethod === 'cash') {
          commissionAmount = t.total * 0.04;
          commissionType = 'cash';
        }
        // Credit sales: depends on payment status and timing
        else if (paymentMethod === 'credit') {
          // Check if paid
          if (payStatus === 'paid') {
            // TODO: Need to implement paid_at field in database to track payment date
            // For now, check if transaction is old (> 30 days from creation)
            const daysSinceCreation = Math.floor((Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
            
            // If paid_at field exists, use it:
            const paidAt = (t as any).paid_at;
            let daysDiff = daysSinceCreation;
            if (paidAt) {
              const paidDate = new Date(paidAt);
              daysDiff = Math.floor((paidDate.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
            }
            
            if (daysDiff <= 30) {
              // Paid within 30 days: 4% commission
              commissionAmount = t.total * 0.04;
              commissionType = 'credit-30days';
            } else {
              // Paid after 30 days: RM 0.10 per product unit
              const totalQuantity = (t.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
              commissionAmount = totalQuantity * 0.10;
              commissionType = 'credit-late';
            }
          }
          // If not paid yet (paymentStatus === 'pending'), no commission earned yet
        }

        return {
          ...t,
          commissionAmount,
          commissionType
        };
      })
      .filter(t => t.commissionAmount > 0);
  }, [transactions]);

  // 2. Aggregate by Salesman
  const staffCommissions = useMemo(() => {
    const stats: Record<string, {
      user: User | undefined;
      totalSales: number;
      totalEligibleSales: number;
      commissionEarned: number;
      paidAmount: number;
      cashCommission: number;
      creditCommission: number;
      lateCommission: number;
    }> = {};

    // Initialize for all sales users
    users.filter(u => u.role === 'Sales').forEach(u => {
      stats[u.id] = {
        user: u,
        totalSales: 0,
        totalEligibleSales: 0,
        commissionEarned: 0,
        paidAmount: 0,
        cashCommission: 0,
        creditCommission: 0,
        lateCommission: 0
      };
    });

    // Sum Sales & Commissions
    eligibleSalesWithCommission.forEach(t => {
      if (stats[t.salesmanId!]) {
        stats[t.salesmanId!].totalEligibleSales += t.total;
        stats[t.salesmanId!].commissionEarned += t.commissionAmount;
        
        // Track commission by type
        if (t.commissionType === 'cash') {
          stats[t.salesmanId!].cashCommission += t.commissionAmount;
        } else if (t.commissionType === 'credit-30days') {
          stats[t.salesmanId!].creditCommission += t.commissionAmount;
        } else if (t.commissionType === 'credit-late') {
          stats[t.salesmanId!].lateCommission += t.commissionAmount;
        }
      }
    });
    
    // Also count all completed sales (including unpaid credit)
    transactions.filter(t => t.status === 'Completed' && t.salesmanId).forEach(t => {
      if (stats[t.salesmanId!]) {
        stats[t.salesmanId!].totalSales += t.total;
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

  }, [eligibleSalesWithCommission, transactions, users, payouts]);

  const filteredStaff = staffCommissions.filter(s => 
        (selectedBranch === 'all' || s.user?.branch === selectedBranch) &&
        (
            s.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.user?.username.toLowerCase().includes(searchTerm.toLowerCase())
        )
  );

    const totalPending = filteredStaff.reduce((sum, s) => sum + s.pendingAmount, 0);
    const totalPaid = filteredStaff.reduce((sum, s) => sum + s.paidAmount, 0);

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
                <div className="soft-card soft-card-blue p-6 rounded-2xl">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total Commission Liability</p>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalPending + totalPaid)}</h3>
        </div>
                <div className="soft-card soft-card-green p-6 rounded-2xl">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total Paid Out</p>
            <h3 className="text-3xl font-bold text-green-400">{formatCurrency(totalPaid)}</h3>
        </div>
                <div className="soft-card soft-card-rose p-6 rounded-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/10 rounded-full -mr-10 -mt-10 animate-pulse" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Pending Payouts</p>
            <h3 className="text-3xl font-bold text-red-400">{formatCurrency(totalPending)}</h3>
        </div>
      </div>

      {/* Staff Breakdown */}
    <div className="soft-panel overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserIcon className="text-blue-500" />
                Staff Commission Breakdown
            </h3>
            <div className="flex w-full md:w-auto gap-3">
                <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value as 'all' | 'Kota Kinabalu' | 'Kinabatangan')}
                    className="bg-white text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="all">All Branches</option>
                    <option value="Kota Kinabalu">Kota Kinabalu</option>
                    <option value="Kinabatangan">Kinabatangan</option>
                </select>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search staff..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="soft-table-head text-xs uppercase tracking-wider">
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
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredStaff.map((staff) => (
                        <tr key={staff.user?.id} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-white">
                                        {staff.user?.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">{staff.user?.name}</p>
                                        <p className="text-xs text-slate-500">@{staff.user?.username}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                {editingId === staff.user?.id ? (
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={tempRate}
                                            onChange={(e) => setTempRate(e.target.value)}
                                            className="w-16 bg-white border border-slate-300 dark:bg-slate-800 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
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
                                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
