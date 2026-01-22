'use client';

import SalesLayout from '@/components/layouts/SalesLayout';
import { Users, Phone, MapPin, MoreHorizontal, UserPlus, Filter } from 'lucide-react';

const mockLeads = [
  { id: 1, name: 'Kedai Runcit Ali', contact: 'Encik Ali', phone: '+60 12-345 6789', location: 'Shah Alam, Selangor', status: 'New', potential: 'High' },
  { id: 2, name: 'Mini Market Bestari', contact: 'Puan Sarah', phone: '+60 13-456 7890', location: 'Klang, Selangor', status: 'Contacted', potential: 'Medium' },
  { id: 3, name: 'Pasar Segar Maju', contact: 'Mr. Tan', phone: '+60 19-876 5432', location: 'Subang Jaya, Selangor', status: 'Meeting', potential: 'High' },
  { id: 4, name: 'Grocery Corner', contact: 'Ms. Lee', phone: '+60 17-654 3210', location: 'Petaling Jaya, Selangor', status: 'New', potential: 'Low' },
  { id: 5, name: 'Runcit Kita', contact: 'Encik Ahmad', phone: '+60 14-321 0987', location: 'Puchong, Selangor', status: 'Qualified', potential: 'Medium' },
];

export default function ProspectingPage() {
  return (
    <SalesLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Prospecting</h1>
                <p className="text-slate-400">Manage and track potential new customers.</p>
            </div>
            <div className="flex gap-3">
                <button className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-xl transition-all flex items-center gap-2">
                    <Filter size={18} /> Filter
                </button>
                <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98] flex items-center gap-2">
                    <UserPlus size={18} /> Add Lead
                </button>
            </div>
        </div>

        {/* Pipeline Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['New Leads', 'Contacted', 'Meeting Scheduled', 'Qualified'].map((stage, i) => (
                <div key={stage} className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
                    <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">{stage}</p>
                    <p className="text-2xl font-bold text-white">{10 - i * 2}</p>
                    <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${80 - i * 15}%` }} />
                    </div>
                </div>
            ))}
        </div>

        {/* Leads List */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
                <h3 className="font-bold text-white">Active Leads</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-white/5 text-slate-300 font-medium">
                        <tr>
                            <th className="px-6 py-3">Shop Name</th>
                            <th className="px-6 py-3">Contact Person</th>
                            <th className="px-6 py-3">Location</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Potential</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {mockLeads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-white">{lead.name}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-white">{lead.contact}</span>
                                        <span className="text-xs flex items-center gap-1 mt-0.5"><Phone size={10} /> {lead.phone}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin size={14} className="text-purple-400" />
                                        <span className="truncate max-w-[150px]">{lead.location}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 text-white border border-white/10">
                                        {lead.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-xs font-bold ${
                                        lead.potential === 'High' ? 'text-emerald-400' : 
                                        lead.potential === 'Medium' ? 'text-yellow-400' : 'text-slate-500'
                                    }`}>
                                        {lead.potential}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                                        <MoreHorizontal size={18} />
                                    </button>
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
