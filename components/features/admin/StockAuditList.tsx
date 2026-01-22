'use client';
import { useState, useEffect } from 'react';
import { ClipboardList, Search, Calendar } from 'lucide-react';

interface StockAudit {
  id: string;
  customerId: string;
  date?: string;
  createdAt?: string;
  counts?: Record<string, number>;
  items?: { productId: string; physicalStock: number }[]; // Legacy support
  notes?: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Product {
    id: string;
    name: string;
}

export default function StockAuditList() {
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [auditRes, custRes, prodRes] = await Promise.all([
                fetch('/api/stock-audits'),
                fetch('/api/customers'),
                fetch('/api/products')
            ]);
            setAudits(await auditRes.json());
            setCustomers(await custRes.json());
            setProducts(await prodRes.json());
        } catch (e) {
            console.error("Failed to fetch data", e);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Unknown Shop';
  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;

  const filteredAudits = audits.filter(audit => {
      const shopName = getCustomerName(audit.customerId).toLowerCase();
      return shopName.includes(filter.toLowerCase());
  });

  // Helper to normalize counts from legacy items or new counts object
  const getCounts = (audit: StockAudit) => {
      if (audit.counts) return audit.counts;
      if (audit.items) {
          const counts: Record<string, number> = {};
          audit.items.forEach(item => {
              counts[item.productId] = item.physicalStock;
          });
          return counts;
      }
      return {};
  };

  const getDate = (audit: StockAudit) => {
      return audit.date || audit.createdAt || new Date().toISOString();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ClipboardList className="text-purple-500" />
                Freezer Audits (Baki Stok)
            </h2>
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                    type="text" 
                    placeholder="Search by Shop Name..." 
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-white focus:ring-2 focus:ring-purple-500 text-sm"
                />
            </div>
        </div>

        {loading ? (
            <div className="text-center text-slate-500 py-10">Loading audits...</div>
        ) : (
            <div className="space-y-4">
                {filteredAudits.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">No audits found</div>
                ) : (
                    filteredAudits.map((audit) => {
                        const counts = getCounts(audit);
                        const date = getDate(audit);
                        
                        return (
                        <div key={audit.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/60 transition-all">
                            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white">{getCustomerName(audit.customerId)}</h3>
                                    <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                                        <Calendar size={14} />
                                        {new Date(date).toLocaleString()}
                                    </div>
                                    {audit.notes && <p className="text-slate-500 text-xs mt-1 italic">"{audit.notes}"</p>}
                                </div>
                                <div className="bg-purple-900/20 text-purple-300 px-3 py-1 rounded-lg text-xs font-mono border border-purple-500/20">
                                    ID: {audit.id.slice(0, 8)}...
                                </div>
                            </div>

                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                                <p className="text-xs text-slate-500 uppercase font-bold mb-2">Stock Counts</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {Object.entries(counts).map(([prodId, count]) => (
                                        <div key={prodId} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                                            <span className="text-slate-300 text-xs truncate mr-2">{getProductName(prodId)}</span>
                                            <span className="text-white font-bold text-sm">{count}</span>
                                        </div>
                                    ))}
                                    {Object.keys(counts).length === 0 && (
                                        <span className="text-slate-600 text-xs italic">No items recorded</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )})
                )}
            </div>
        )}
      </div>
    </div>
  );
}
