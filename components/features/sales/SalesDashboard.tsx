'use client';

import React, { useState, useEffect } from 'react';
import { useSales } from '@/context/SalesContext';
import { Search, Plus, Store, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { User } from '@/types';
import CommissionWidget from './CommissionWidget';

export default function SalesDashboard() {
  const { customers, visitedCustomers, setSelectedCustomer, setStep, setLatestAudit, orders, setCart } = useSales();
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => setCurrentUser(data))
        .catch(console.error);
  }, []);

  const filteredCustomers = customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleShopSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setLatestAudit(null);
    const customerOrder = orders.find(o => o.customerId === customer.id);
    if (customerOrder) {
        // ... (restoring existing logic for re-selecting a customer)
    }
    setStep(2); // Move to CheckIn
  };

  return (
    <div className="space-y-6">
      {/* Commission Widget (Integrated like a dashboard card) */}
      {currentUser && <CommissionWidget user={currentUser} />}

      {/* Shop Selection (Matching says-vite Step 1 UI) */}
      <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Find shop..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-xl pl-10 h-12 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-transparent outline-none transition-all"
            />
          </div>
          
          <button 
            className="w-full py-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/40 flex items-center justify-center gap-2 transition-all"
            onClick={() => alert('New Shop Registration - Coming Soon')}
          >
            <Plus size={18} /> Register New Shop
          </button>

          <div className="space-y-3">
            {filteredCustomers.map(customer => {
                const isVisited = visitedCustomers.includes(customer.id);
                return (
                  <button
                    key={customer.id}
                    onClick={() => handleShopSelect(customer)}
                    className={`w-full text-left bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl hover:bg-white/10 hover:border-blue-500/30 transition-all active:scale-[0.98] group relative overflow-hidden ${isVisited ? 'opacity-75' : ''}`}
                  >
                    {isVisited && (
                        <div className="absolute top-0 right-0 bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-bl-lg border-l border-b border-green-500/20 flex items-center gap-1">
                            <CheckCircle size={12} /> Visited
                        </div>
                    )}
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 flex items-center justify-center group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white transition-all shadow-lg">
                            <Store size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">{customer.name}</h3>
                            <p className="text-sm text-slate-400 truncate">{customer.address || 'No address'}</p>
                        </div>
                    </div>
                  </button>
                );
            })}
            {filteredCustomers.length === 0 && (
                  <div className="text-center text-slate-500 py-8">
                      <p>No shops found.</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
}
