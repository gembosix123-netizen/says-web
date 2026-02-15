'use client';

import React, { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, Clock, CheckCircle, Search, Filter } from 'lucide-react';

interface PendingSale {
  id: string;
  invoice: string;
  customerName: string;
  customerId: string;
  amount: number;
  branch: string;
  createdAt: string;
  paymentStatus: string;
  salesmanName?: string;
}

export default function OutstandingPaymentsPage() {
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPendingSales = async () => {
    try {
      const res = await fetch('/api/sales/collect-payment?status=pending');
      if (res.ok) {
        const data = await res.json();
        setPendingSales(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch pending sales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingSales();
  }, []);

  const handleCollectPayment = async (sale: PendingSale, paymentMethod: string) => {
    if (processingId) return;
    
    const confirm = window.confirm(
      `Confirm payment collection for ${sale.customerName}?\nAmount: ${formatCurrency(sale.amount)}\nInvoice: ${sale.invoice}`
    );
    
    if (!confirm) return;

    setProcessingId(sale.id);
    try {
      const res = await fetch('/api/sales/collect-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: sale.id,
          branch: sale.branch,
          amountPaid: sale.amount,
          paymentMethod
        })
      });

      if (res.ok) {
        alert('Payment collected successfully!');
        fetchPendingSales(); // Refresh list
      } else {
        const err = await res.json();
        alert('Failed: ' + (err.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Payment collection failed:', error);
      alert('Failed to collect payment');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredSales = pendingSales.filter(s =>
    s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    s.invoice?.toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = filteredSales.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Outstanding Payments</h1>
            <p className="text-slate-400">Manage and collect pending credit payments</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-500/30 p-6 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <DollarSign className="text-red-400" size={24} />
              </div>
              <div>
                <p className="text-red-300 text-sm font-medium">Total Outstanding</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(totalOutstanding)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 border border-amber-500/30 p-6 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Clock className="text-amber-400" size={24} />
              </div>
              <div>
                <p className="text-amber-300 text-sm font-medium">Pending Invoices</p>
                <p className="text-2xl font-bold text-white">{filteredSales.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 border border-emerald-500/30 p-6 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="text-emerald-400" size={24} />
              </div>
              <div>
                <p className="text-emerald-300 text-sm font-medium">Average Amount</p>
                <p className="text-2xl font-bold text-white">
                  {filteredSales.length > 0 
                    ? formatCurrency(totalOutstanding / filteredSales.length) 
                    : 'RM 0'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by customer or invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Table */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-bold text-white">Pending Credit Sales</h3>
            <span className="text-sm text-slate-400">{filteredSales.length} records</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="mx-auto text-emerald-400 mb-3" size={48} />
              <p className="text-emerald-400 font-bold">No Outstanding Payments</p>
              <p className="text-slate-500 text-sm mt-1">All credit sales have been collected</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-slate-300 font-medium">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Salesman</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4">
                        <span className="font-mono text-blue-400 text-xs">{sale.invoice}</span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-white">{sale.customerName || 'N/A'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-bold text-red-400">{formatCurrency(sale.amount)}</span>
                      </td>
                      <td className="px-4 py-4 text-slate-400">
                        {new Date(sale.createdAt).toLocaleDateString('ms-MY', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-4 text-slate-400">
                        {sale.salesmanName || '-'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleCollectPayment(sale, 'cash')}
                            disabled={processingId === sale.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {processingId === sale.id ? '...' : 'Cash'}
                          </button>
                          <button
                            onClick={() => handleCollectPayment(sale, 'transfer')}
                            disabled={processingId === sale.id}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {processingId === sale.id ? '...' : 'Transfer'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
