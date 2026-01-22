'use client';

import React, { useEffect, useState } from 'react';
import CommissionDashboard from '@/components/features/admin/CommissionDashboard';
import { Transaction, User, CommissionPayout } from '@/types';

export default function CommissionPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
        try {
            const [txRes, usersRes, payoutsRes] = await Promise.all([
                fetch('/api/sales').then(r => r.json()),
                fetch('/api/users').then(r => r.json()),
                fetch('/api/payouts').then(r => r.json())
            ]);

            setTransactions(Array.isArray(txRes) ? txRes : []);
            setUsers(Array.isArray(usersRes) ? usersRes : []);
            setPayouts(payoutsRes.data || []);
        } catch (error) {
            console.error('Failed to fetch commission data', error);
        } finally {
            setLoading(false);
        }
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="text-white p-8">Loading commission data...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Commission Tracking</h1>
        <p className="text-slate-400">Monitor staff earnings, calculate liabilities, and track payouts.</p>
      </div>
      
      <CommissionDashboard 
        transactions={transactions} 
        users={users}
        payouts={payouts}
      />
    </div>
  );
}
