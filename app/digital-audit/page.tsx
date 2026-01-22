'use client';

import SalesLayout from '@/components/layouts/SalesLayout';
import { Package, CheckCircle, XCircle, Clock, Search } from 'lucide-react';

const mockAudits = [
  { id: 'AUD-001', van: 'Van A (WXY 1234)', date: '2023-10-26', status: 'Verified', items: 145, discrepancies: 0 },
  { id: 'AUD-002', van: 'Van B (VBC 5678)', date: '2023-10-26', status: 'Pending', items: 132, discrepancies: 2 },
  { id: 'AUD-003', van: 'Van A (WXY 1234)', date: '2023-10-25', status: 'Verified', items: 148, discrepancies: 0 },
  { id: 'AUD-004', van: 'Van C (JQK 9012)', date: '2023-10-25', status: 'Flagged', items: 120, discrepancies: 5 },
  { id: 'AUD-005', van: 'Van B (VBC 5678)', date: '2023-10-24', status: 'Verified', items: 130, discrepancies: 0 },
];

export default function DigitalAuditPage() {
  return (
    <SalesLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Digital Audit</h1>
                <p className="text-slate-400">Track and verify van inventory status.</p>
            </div>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]">
                + New Audit
            </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Total Verified</p>
                <p className="text-3xl font-bold text-white">1,245</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Pending Review</p>
                <p className="text-3xl font-bold text-yellow-400">8</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Discrepancies</p>
                <p className="text-3xl font-bold text-red-400">12</p>
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
                        className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-white/5 text-slate-300 font-medium">
                        <tr>
                            <th className="px-6 py-3">Audit ID</th>
                            <th className="px-6 py-3">Van / Unit</th>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Items Scanned</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {mockAudits.map((audit) => (
                            <tr key={audit.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-mono text-white">{audit.id}</td>
                                <td className="px-6 py-4 text-white">{audit.van}</td>
                                <td className="px-6 py-4">{audit.date}</td>
                                <td className="px-6 py-4">{audit.items}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                        audit.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        audit.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                        'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                        {audit.status === 'Verified' && <CheckCircle size={12} />}
                                        {audit.status === 'Pending' && <Clock size={12} />}
                                        {audit.status === 'Flagged' && <XCircle size={12} />}
                                        {audit.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-blue-400 hover:text-white transition-colors">View Details</button>
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
