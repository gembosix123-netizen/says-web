'use client';
import React, { useState, useEffect } from 'react';
import { Settlement } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Clock, ChevronDown, ChevronUp } from '@/components/Icons';

export default function SettlementDashboard() {
  const { t } = useLanguage();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [userFilter, setUserFilter] = useState('all');

  const fetchSettlements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settlements');
      if (res.ok) {
        setSettlements(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettlements();
  }, []);

  const uniqueUsers = Array.from(new Set(settlements.map((s) => `${s.userId}::${s.userName}`)))
    .map((entry) => {
      const [id, name] = entry.split('::');
      return { id, name };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredSettlements = settlements.filter((s) => {
    const dateMatch = dateFilter ? s.date === dateFilter : true;
    const userMatch = userFilter === 'all' ? true : s.userId === userFilter;
    return dateMatch && userMatch;
  });

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="text-blue-400" />
                Expenses History
            </h2>
            <Button onClick={fetchSettlements} variant="outline" className="text-slate-400 border-slate-700">
                Refresh
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Filter User</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
            >
              <option value="all">All Users</option>
              {uniqueUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Filter Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
            />
          </div>
        </div>

        <div className="space-y-4">
            {filteredSettlements.map((s) => (
                <div key={s.id} className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden">
                    <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                        onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-900/20 text-blue-400">
                                <Clock size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">{s.userName}</h3>
                                <p className="text-xs text-slate-500">{s.date}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                            <div>
                                <p className="text-xs text-slate-500">Total Cash</p>
                                <p className="font-bold text-green-400">{formatCurrency(s.totalCash)}</p>
                            </div>
                             <div>
                                <p className="text-xs text-slate-500">Status</p>
                                <span className="text-xs font-bold px-2 py-1 rounded bg-blue-900/20 text-blue-300">
                                    {s.status}
                                </span>
                            </div>
                            {expandedId === s.id ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                        </div>
                    </div>

                    {expandedId === s.id && (
                        <div className="p-4 bg-slate-950/30 border-t border-slate-800 space-y-4 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                                    <p className="text-xs text-slate-500">Total Sales</p>
                                    <p className="font-bold text-white">{formatCurrency(s.totalSales)}</p>
                                </div>
                                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                                    <p className="text-xs text-slate-500">Total Credit</p>
                                    <p className="font-bold text-blue-400">{formatCurrency(s.totalCredit)}</p>
                                </div>
                                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                                    <p className="text-xs text-slate-500">Van Stock Left</p>
                                    <p className="font-bold text-orange-400">{s.vanStock.reduce((a, b) => a + b.quantity, 0)} units</p>
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 text-right italic">
                              Submitted at {new Date(s.submittedAt || s.date).toLocaleString()}
                            </p>
                        </div>
                    )}
                </div>
            ))}
            
            {filteredSettlements.length === 0 && (
                <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
                    <p>No settlement reports found.</p>
                </div>
            )}
        </div>
    </div>
  );
}
