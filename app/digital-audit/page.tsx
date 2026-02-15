'use client';

import SalesLayout from '@/components/layouts/SalesLayout';
import { CheckCircle, XCircle, Clock, Search, ClipboardList } from 'lucide-react';
import { useState, useEffect } from 'react';
import { StockAudit } from '@/types';

export default function DigitalAuditPage() {
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchAudits() {
      try {
        const response = await fetch('/api/stock-audits');
        const data = await response.json();
        setAudits(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch audits:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAudits();
  }, []);

  // Calculate stats
  const totalAudits = audits.length;
  const totalItemsScanned = audits.reduce((sum, a) => sum + (a.items?.length || 0), 0);

  // Filter audits by search
  const filteredAudits = audits.filter(a => 
    a.id.toLowerCase().includes(search.toLowerCase()) ||
    a.customerId?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-MY', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  return (
    <SalesLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Digital Audit</h1>
                <p className="text-slate-400">Track and verify stock audit records.</p>
            </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <ClipboardList size={20} className="text-blue-400" />
                  </div>
                </div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Total Audits</p>
                <p className="text-3xl font-bold text-white">{totalAudits}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <CheckCircle size={20} className="text-emerald-400" />
                  </div>
                </div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Items Scanned</p>
                <p className="text-3xl font-bold text-emerald-400">{totalItemsScanned}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Clock size={20} className="text-purple-400" />
                  </div>
                </div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">This Month</p>
                <p className="text-3xl font-bold text-purple-400">{audits.filter(a => {
                  const date = new Date(a.createdAt || '');
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length}</p>
            </div>
        </div>

        {/* List */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-white">Recent Audits</h3>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search audits..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                    />
                </div>
            </div>
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading audits...</div>
            ) : filteredAudits.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No audits found</div>
            ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-white/5 text-slate-300 font-medium">
                        <tr>
                            <th className="px-6 py-3">Audit ID</th>
                            <th className="px-6 py-3">Customer</th>
                            <th className="px-6 py-3">Salesman</th>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Items</th>
                            <th className="px-6 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredAudits.map((audit) => (
                            <tr key={audit.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-mono text-white">{audit.id.slice(0, 12)}...</td>
                                <td className="px-6 py-4 text-white">{audit.customerId || 'N/A'}</td>
                                <td className="px-6 py-4">{audit.salesmanId || 'N/A'}</td>
                                <td className="px-6 py-4">{formatDate(audit.createdAt)}</td>
                                <td className="px-6 py-4">{audit.items?.length || 0}</td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                        <CheckCircle size={12} />
                                        Completed
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}
        </div>
      </div>
    </SalesLayout>
  );
}
