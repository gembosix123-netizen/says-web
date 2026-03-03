'use client';
import React, { useState, useEffect } from 'react';
import { Store, Plus, Save, Trash2, Search, Edit, MapPin } from 'lucide-react';
import { useToast } from '../../ui/Toast';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  branch?: string;
  location?: string;
}

const BRANCH_OPTIONS = ['Kota Kinabalu', 'Kinabatangan', 'HQ'];

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState('');
  const [isEditing, setIsEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', branch: 'Kota Kinabalu' });
  const { addToast } = useToast();

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to fetch customers', error);
      addToast('Failed to load shop list', 'error');
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

        const data = await res.json().catch(() => null);

        if (res.ok) {
            addToast(isEditing ? 'Shop updated successfully' : 'Shop created successfully', 'success');
            setIsEditing(null);
          setForm({ name: '', phone: '', address: '', branch: 'Kota Kinabalu' });
            fetchCustomers();
        } else {
          const details = Array.isArray(data?.details) ? data.details.join(', ') : data?.details;
          addToast(details || data?.error || 'Failed to save shop', 'error');
        }
    } catch (error) {
        console.error(error);
        addToast('Error saving shop', 'error');
    }
  };

  const handleDelete = async () => {
      if (!deleteTarget) return;
      try {
          const res = await fetch(`/api/customers?id=${deleteTarget.id}`, { method: 'DELETE' });
          const data = await res.json().catch(() => null);

          if (!res.ok) {
            addToast(data?.details || data?.error || 'Failed to delete shop', 'error');
            return;
          }

          addToast('Shop deleted successfully', 'success');
          setDeleteTarget(null);
          fetchCustomers();
      } catch (error) {
          console.error(error);
          addToast('Error deleting shop', 'error');
      }
  };

  const handleEdit = (customer: Customer) => {
      setIsEditing(customer);
      setForm({
        name: customer.name,
        phone: customer.phone,
        address: customer.address || '',
        branch: customer.branch || 'Kota Kinabalu'
      });
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
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <select
            value={form.branch}
            onChange={e => setForm({ ...form, branch: e.target.value })}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg"
            required
          >
            {BRANCH_OPTIONS.map((branch) => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                <Save size={18} /> {isEditing ? 'Update' : 'Save'}
            </button>
            {isEditing && (
                <button 
                    type="button" 
                    onClick={() => { setIsEditing(null); setForm({ name: '', phone: '', address: '', branch: 'Kota Kinabalu' }); }}
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
                        <p className="text-xs text-slate-500 mt-1">Branch: {customer.branch || 'N/A'}</p>
                        <p className="text-xs text-slate-500 mt-1">Tel: {customer.phone}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(customer)} className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg">
                            <Edit size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(customer)} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Delete Shop</h3>
            <p className="text-sm text-slate-300 mt-2">
              Are you sure you want to delete <span className="font-semibold text-white">{deleteTarget.name}</span>?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
