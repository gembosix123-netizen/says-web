'use client';
import React, { useState, useEffect } from 'react';
import { Settlement } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from '@/components/Icons';

export default function SettlementDashboard() {
  const { t } = useLanguage();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const handleVerify = async (id: string) => {
      if (!confirm('Confirm verify cash collected?')) return;
      
      try {
          const res = await fetch('/api/settlements', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, status: 'Verified', verifiedBy: 'Admin' })
          });
          
          if (res.ok) {
              fetchSettlements();
          }
      } catch (e) {
          console.error(e);
          alert('Failed to verify');
      }
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle className="text-green-500" />
                Settlement Verification
            </h2>
            <Button onClick={fetchSettlements} variant="outline" className="text-slate-400 border-slate-700">
                Refresh
            </Button>
        </div>

        <div className="space-y-4">
            {settlements.map((s) => (
                <div key={s.id} className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden">
                    <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                        onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.status === 'Verified' ? 'bg-green-900/20 text-green-500' : 'bg-yellow-900/20 text-yellow-500'}`}>
                                {s.status === 'Verified' ? <CheckCircle size={20} /> : <Clock size={20} />}
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
                                <span className={`text-xs font-bold px-2 py-1 rounded ${s.status === 'Verified' ? 'bg-green-900/20 text-green-500' : 'bg-yellow-900/20 text-yellow-500'}`}>
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

                            {s.status === 'Pending' && (
                                <div className="flex justify-end pt-2">
                                    <Button 
                                        onClick={() => handleVerify(s.id)}
                                        className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
                                    >
                                        <CheckCircle size={18} className="mr-2" /> Verify Cash Collection
                                    </Button>
                                </div>
                            )}
                            
                            {s.status === 'Verified' && (
                                <p className="text-xs text-slate-500 text-right italic">
                                    Verified by {s.verifiedBy} at {new Date(s.verifiedAt!).toLocaleString()}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            ))}
            
            {settlements.length === 0 && (
                <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
                    <p>No settlement reports found.</p>
                </div>
            )}
        </div>
    </div>
  );
}
