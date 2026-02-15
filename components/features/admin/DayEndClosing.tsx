'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Lock, Download, XCircle, CheckCircle, Users, DollarSign, ShoppingCart, AlertCircle } from 'lucide-react';

interface DayEndSummary {
  date: string;
  branch: string;
  totalTransactions: number;
  totalRevenue: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    transfer: number;
    other: number;
  };
  salesmanPerformance: Record<string, any>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  hourlyBreakdown: Array<any>;
}

export default function DayEndClosing() {
  const { addToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [userBranch, setUserBranch] = useState('');
  const [userRole, setUserRole] = useState('');
  const [summary, setSummary] = useState<DayEndSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // Reconciliation form state
  const [cashCount, setCashCount] = useState(0);
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [showReconciliation, setShowReconciliation] = useState(false);

  // Get user info
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setUserBranch(userData.branch || '');
        setUserRole(userData.role || '');
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    }
  }, []);

  // Fetch day end summary
  const fetchDayEndSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/day-end/calculate?date=${selectedDate}&branch=${userBranch}`);
      if (!res.ok) {
        const error = await res.json();
        addToast(error.error || 'Failed to fetch data', 'error');
        return;
      }
      const data: DayEndSummary = await res.json();
      setSummary(data);
      setCashCount(data.paymentBreakdown.cash); // Pre-fill with system amount
    } catch (error) {
      console.error('Error fetching day end:', error);
      addToast('Failed to fetch day end summary', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userBranch) {
      fetchDayEndSummary();
    }
  }, [selectedDate, userBranch]);

  // Handle day end closing
  const handleCloseDayEnd = async () => {
    if (userRole !== 'Admin') {
      addToast('Only Admin can perform day end closing', 'error');
      return;
    }

    if (!summary) {
      addToast('No data to close', 'error');
      return;
    }

    setIsClosing(true);
    try {
      // Close day end
      const closeResponse = await fetch('/api/day-end/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          branch: userBranch,
          cashCount,
          reconciliationNotes,
          discrepancies: [],
        }),
      });

      if (!closeResponse.ok) {
        const error = await closeResponse.json();
        addToast(error.error || 'Failed to close day end', 'error');
        return;
      }

      // Export report
      const exportResponse = await fetch('/api/day-end/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          branch: userBranch,
          summary,
          cashCount,
          reconciliationNotes,
        }),
      });

      if (exportResponse.ok) {
        const blob = await exportResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DayEndReport_${selectedDate}_${userBranch}.html`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      setIsClosed(true);
      addToast('Day end closed successfully! Report exported.', 'success');
    } catch (error) {
      console.error('Error closing day end:', error);
      addToast('Failed to close day end', 'error');
    } finally {
      setIsClosing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(value);
  };

  if (userRole !== 'Admin') {
    return (
      <div className="p-6 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
        <p>Only Admin users can access Day End Closing</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-lg border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-4">Day End Closing</h2>
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={isClosed}
              className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Branch</label>
            <input
              type="text"
              value={userBranch}
              disabled
              className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {isClosed && (
        <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg flex items-start gap-3">
          <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="text-green-300 font-semibold">Day End Closed</p>
            <p className="text-green-400 text-sm">All transactions for this day are now locked.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-400">Loading...</div>
      ) : summary ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-sm">Total Transactions</p>
                <ShoppingCart className="text-blue-400" size={20} />
              </div>
              <h3 className="text-3xl font-bold text-white">{summary.totalTransactions}</h3>
            </div>

            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-sm">Total Revenue</p>
                <DollarSign className="text-green-400" size={20} />
              </div>
              <h3 className="text-3xl font-bold text-green-400">{formatCurrency(summary.totalRevenue)}</h3>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">Payment Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-300">Cash</span>
                <span className="text-white font-semibold">{formatCurrency(summary.paymentBreakdown.cash)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-300">Card</span>
                <span className="text-white font-semibold">{formatCurrency(summary.paymentBreakdown.card)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-300">Transfer</span>
                <span className="text-white font-semibold">{formatCurrency(summary.paymentBreakdown.transfer)}</span>
              </div>
            </div>
          </div>

          {/* Salesman Performance */}
          {Object.keys(summary.salesmanPerformance).length > 0 && (
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users size={20} className="text-orange-400" />
                Salesman Performance
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 text-slate-300">
                    <tr>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-right px-4 py-2">Transactions</th>
                      <th className="text-right px-4 py-2">Revenue</th>
                      <th className="text-right px-4 py-2">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(summary.salesmanPerformance).map((sm: any) => (
                      <tr key={sm.name} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-white">{sm.name}</td>
                        <td className="text-right px-4 py-3 text-slate-300">{sm.transactions}</td>
                        <td className="text-right px-4 py-3 text-green-400 font-semibold">
                          {formatCurrency(sm.revenue)}
                        </td>
                        <td className="text-right px-4 py-3 text-blue-400 font-semibold">
                          {formatCurrency(sm.commission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Products */}
          {summary.topProducts.length > 0 && (
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">Top 5 Products</h3>
              <div className="space-y-2">
                {summary.topProducts.slice(0, 5).map((product) => (
                  <div key={product.name} className="flex justify-between items-center py-2 border-b border-slate-700/30">
                    <span className="text-slate-300">{product.name}</span>
                    <div className="text-right">
                      <p className="text-white font-semibold">Qty: {product.quantity}</p>
                      <p className="text-slate-400 text-xs">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cash Reconciliation */}
          {!isClosed && (
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">Cash Reconciliation</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">System Cash Total</label>
                  <input
                    type="text"
                    value={formatCurrency(summary.paymentBreakdown.cash)}
                    disabled
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Actual Cash Count *</label>
                  <input
                    type="number"
                    value={cashCount}
                    onChange={(e) => setCashCount(parseFloat(e.target.value))}
                    step="0.01"
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {cashCount !== summary.paymentBreakdown.cash && (
                  <div className="p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg flex items-start gap-2">
                    <AlertCircle className="text-yellow-400 mt-0.5 flex-shrink-0" size={18} />
                    <div>
                      <p className="text-yellow-300 text-sm font-semibold">Discrepancy Detected</p>
                      <p className="text-yellow-400 text-xs mt-1">
                        Difference: {formatCurrency(cashCount - summary.paymentBreakdown.cash)}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Reconciliation Notes</label>
                  <textarea
                    value={reconciliationNotes}
                    onChange={(e) => setReconciliationNotes(e.target.value)}
                    placeholder="Add any notes about discrepancies or issues..."
                    rows={4}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <button
                  onClick={handleCloseDayEnd}
                  disabled={isClosing}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Lock size={18} />
                  {isClosing ? 'Processing...' : 'Close Day End & Export Report'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-slate-400">No data available</div>
      )}
    </div>
  );
}
