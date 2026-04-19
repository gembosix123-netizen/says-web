'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Transaction } from '@/types';

type BranchFilter = 'all' | 'Kota Kinabalu' | 'Kinabatangan';

export default function AdminSalesPage() {
  const [sales, setSales] = useState<Transaction[]>([]);
  const [branch, setBranch] = useState<BranchFilter>('all');
  const [date, setDate] = useState<string>('');
  const [salesmanId, setSalesmanId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branch !== 'all') params.set('branch', branch);
      if (date) params.set('date', date);
      if (salesmanId !== 'all') params.set('salesman_id', salesmanId);
      const query = params.toString();
      const res = await fetch(`/api/sales${query ? `?${query}` : ''}`);
      const data = await res.json();
      setSales(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      addToast('Failed to load sales', 'error');
    } finally {
      setLoading(false);
    }
  }, [branch, date, salesmanId, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const deleteSale = async (id: string, saleBranch: string) => {
    if (!confirm('Delete this sale?')) return;
    const res = await fetch(`/api/sales?id=${encodeURIComponent(id)}&branch=${encodeURIComponent(saleBranch)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return addToast(data?.error || 'Failed', 'error');
    addToast('Deleted', 'success');
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Admin — Daily Sales User Report</h1>

      <div className="p-4 rounded bg-slate-900 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Filter by Branch</label>
          <select value={branch} onChange={(e) => setBranch(e.target.value as BranchFilter)} className="w-full p-2 bg-slate-800 text-white rounded">
            <option value="all">All Branches</option>
            <option value="Kota Kinabalu">Kota Kinabalu</option>
            <option value="Kinabatangan">Kinabatangan</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Filter by User</label>
          <select value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)} className="w-full p-2 bg-slate-800 text-white rounded">
            <option value="all">All Users</option>
            {Array.from(new Set(sales.filter((item) => item.salesmanId).map((item) => `${item.salesmanId}::${item.salesmanName || item.salesmanId}`))).map((entry) => {
              const [id, name] = entry.split('::');
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Filter by Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-2 bg-slate-800 text-white rounded"
          />
        </div>
        <button onClick={load} className="px-3 py-2 bg-slate-700 rounded h-10">Refresh</button>
      </div>

      <div className="p-4 rounded bg-slate-900 flex gap-4 items-center">
        <label className="text-white">Filter by Branch:</label>
        <span className="text-slate-300">{branch === 'all' ? 'All Branches' : branch}</span>
        <span className="text-slate-500">|</span>
        <label className="text-white">Date:</label>
        <span className="text-slate-300">{date || 'All Dates'}</span>
        <span className="text-slate-500">|</span>
        <label className="text-white">User:</label>
        <span className="text-slate-300">
          {salesmanId === 'all'
            ? 'All Users'
            : (sales.find((item) => item.salesmanId === salesmanId)?.salesmanName || salesmanId)}
        </span>
      </div>

      <div className="p-4 rounded bg-slate-900">
        <h3 className="text-lg text-white mb-4">Sales Records</h3>
        {loading ? (
          <div className="text-slate-400">Loading...</div>
        ) : sales.length === 0 ? (
          <div className="text-slate-400">No sales found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="text-left px-2 py-2">Invoice</th>
                  <th className="text-left px-2 py-2">Amount</th>
                  <th className="text-left px-2 py-2">Customer</th>
                  <th className="text-left px-2 py-2">Branch</th>
                  <th className="text-left px-2 py-2">Sales User</th>
                  <th className="text-left px-2 py-2">Date</th>
                  <th className="text-left px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-slate-700/30 hover:bg-slate-800/20">
                    <td className="px-2 py-2 text-white font-mono">{s.id}</td>
                    <td className="px-2 py-2 text-white">RM {Number(s.total || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-slate-300">{s.customer?.name || '-'}</td>
                    <td className="px-2 py-2 text-slate-300">{s.branch}</td>
                    <td className="px-2 py-2 text-slate-300">{s.salesmanName || s.salesmanId || '-'}</td>
                    <td className="px-2 py-2 text-slate-300">{new Date(s.createdAt || '').toLocaleDateString()}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => deleteSale(s.id, s.branch || 'unknown')}
                        className="px-2 py-1 bg-red-600 rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-4 rounded bg-slate-900">
        <h3 className="text-lg text-white mb-2">Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-slate-400">Total Records</p>
            <p className="text-2xl font-bold text-white">{sales.length}</p>
          </div>
          <div>
            <p className="text-slate-400">Total Amount</p>
            <p className="text-2xl font-bold text-green-400">RM {sales.reduce((s, sl) => s + (Number(sl.total || 0)), 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-400">Branches</p>
            <p className="text-2xl font-bold text-white">{new Set(sales.map((s) => s.branch)).size}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
