'use client';
import React, { useState, useEffect } from 'react';
import { Store, Plus, Save, Trash2, Search, Edit, MapPin } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  location?: string;
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState('');
  const [isEditing, setIsEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to fetch customers', error);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = '/api/customers';
    const method = isEditing ? 'PUT' : 'POST';
    const body = isEditing 
        ? { ...form, id: isEditing.id }
        : { ...form, id: `c${Date.now()}` };

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            alert(isEditing ? 'Shop updated' : 'Shop created');
            setIsEditing(null);
            setForm({ name: '', phone: '', address: '' });
            fetchCustomers();
        } else {
            alert('Failed to save shop');
        }
    } catch (error) {
        console.error(error);
        alert('Error saving shop');
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Delete this shop?')) return;
      try {
          await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
          fetchCustomers();
      } catch (error) {
          console.error(error);
      }
  };

  const handleEdit = (customer: Customer) => {
      setIsEditing(customer);
      setForm({ name: customer.name, phone: customer.phone, address: customer.address || '' });
  };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Form Section */}
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <span className="bg-green-500/20 text-green-500 p-2 rounded-lg">
            {isEditing ? <Edit size={20} /> : <Plus size={20} />}
          </span>
          {isEditing ? 'Edit Shop' : 'Add New Shop'}
        </h2>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            placeholder="Shop Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg"
            required
          />
          <input
            placeholder="Phone Number"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg"
            required
          />
          <input
            placeholder="Address"
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                <Save size={18} /> {isEditing ? 'Update' : 'Save'}
            </button>
            {isEditing && (
                <button 
                    type="button" 
                    onClick={() => { setIsEditing(null); setForm({ name: '', phone: '', address: '' }); }}
                    className="px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
                >
                    Cancel
                </button>
            )}
          </div>
        </form>
      </div>

      {/* List Section */}
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Store className="text-green-500" /> Shop List
            </h2>
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Search shops..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-white text-sm"
                />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map(customer => (
                <div key={customer.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex justify-between items-center group hover:bg-slate-800/60 transition-all">
                    <div>
                        <h3 className="font-bold text-white">{customer.name}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                            <MapPin size={12} /> {customer.address || 'No Address'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Tel: {customer.phone}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(customer)} className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg">
                            <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(customer.id)} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
