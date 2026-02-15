'use client';

import SalesLayout from '@/components/layouts/SalesLayout';
import { Users, Phone, MapPin, UserPlus, Filter, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Customer } from '@/types';

export default function ProspectingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', address: '', phone: '' });

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const response = await fetch('/api/customers');
        const data = await response.json();
        setCustomers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch customers:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address?.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate pipeline stats
  const customersWithBalance = customers.filter(c => (c.outstandingBalance || 0) > 0).length;
  const activeCustomers = customers.length;

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) return;
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      if (response.ok) {
        const created = await response.json();
        setCustomers([...customers, created]);
        setNewCustomer({ name: '', address: '', phone: '' });
        setShowAddModal(false);
      }
    } catch (error) {
      console.error('Failed to add customer:', error);
    }
  };

  return (
    <SalesLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Customers</h1>
                <p className="text-slate-400">Manage and track your customer base.</p>
            </div>
            <div className="flex gap-3">
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98] flex items-center gap-2"
                >
                    <UserPlus size={18} /> Add Customer
                </button>
            </div>
        </div>

        {/* Pipeline Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Total Customers</p>
                <p className="text-2xl font-bold text-white">{activeCustomers}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">With Balance</p>
                <p className="text-2xl font-bold text-yellow-400">{customersWithBalance}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Zero Balance</p>
                <p className="text-2xl font-bold text-emerald-400">{activeCustomers - customersWithBalance}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">This Month</p>
                <p className="text-2xl font-bold text-blue-400">{customers.length}</p>
            </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Customers List */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
                <h3 className="font-bold text-white">Customer List</h3>
            </div>
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading customers...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No customers found</div>
            ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-white/5 text-slate-300 font-medium">
                        <tr>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Address</th>
                            <th className="px-6 py-3">Outstanding</th>
                            <th className="px-6 py-3">Branch</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredCustomers.map((customer) => (
                            <tr key={customer.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                        <Users size={14} className="text-purple-400" />
                                      </div>
                                      <p className="font-bold text-white">{customer.name}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin size={14} className="text-purple-400" />
                                        <span className="truncate max-w-[200px]">{customer.address || 'N/A'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`font-bold ${(customer.outstandingBalance || 0) > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                    RM {(customer.outstandingBalance || 0).toFixed(2)}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs">
                                    {customer.branch || 'N/A'}
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

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Add New Customer</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Customer Name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500"
              />
              <input
                type="text"
                placeholder="Address"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500"
              />
              <input
                type="text"
                placeholder="Phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomer}
                className="flex-1 px-4 py-2 bg-purple-600 text-white font-bold rounded-xl"
              >
                Add Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </SalesLayout>
  );
}
