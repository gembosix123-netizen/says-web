'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Store } from '@/types';

export default function AdminStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [form, setForm] = useState({ name: '', address: '', branch: 'Kota Kinabalu' });
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stores');
      const data = await res.json();
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      addToast('Failed to load stores', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const createStore = async () => {
    if (!form.name.trim()) return addToast('Store name required', 'error');
    const res = await fetch('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return addToast(data?.error || 'Failed', 'error');
    addToast('Store created', 'success');
    setForm({ name: '', address: '', branch: 'Kota Kinabalu' });
    load();
  };

  const deleteStore = async (id: string) => {
    if (!confirm('Delete store?')) return;
    const res = await fetch(`/api/stores?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return addToast(data?.error || 'Failed', 'error');
    addToast('Deleted', 'success');
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Admin — Stores</h1>

      <div className="p-4 rounded bg-slate-900">
        <h3 className="text-lg text-white mb-3">Create Store</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            placeholder="Store name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="p-2 bg-slate-800 text-white rounded"
          />
          <input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="p-2 bg-slate-800 text-white rounded"
          />
          <select
            value={form.branch}
            onChange={(e) => setForm({ ...form, branch: e.target.value })}
            className="p-2 bg-slate-800 text-white rounded"
          >
            <option>Kota Kinabalu</option>
            <option>Kinabatangan</option>
            <option>HQ</option>
          </select>
          <button onClick={createStore} className="px-3 py-2 bg-green-600 rounded font-semibold hover:bg-green-700">
            Create
          </button>
        </div>
      </div>

      <div className="p-4 rounded bg-slate-900">
        <h3 className="text-lg text-white mb-3">Stores</h3>
        {loading ? (
          <div className="text-slate-400">Loading...</div>
        ) : stores.length === 0 ? (
          <div className="text-slate-400">No stores yet. Create one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="text-left px-2 py-2">Name</th>
                  <th className="text-left px-2 py-2">Branch</th>
                  <th className="text-left px-2 py-2">Address</th>
                  <th className="text-left px-2 py-2">Created</th>
                  <th className="text-left px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((st) => (
                  <tr key={st.id} className="border-b border-slate-700/30 hover:bg-slate-800/20">
                    <td className="px-2 py-2 text-white font-semibold">{st.name}</td>
                    <td className="px-2 py-2 text-slate-300">{st.branch}</td>
                    <td className="px-2 py-2 text-slate-300">{st.address || '-'}</td>
                    <td className="px-2 py-2 text-slate-400 text-xs">{st.createdAt ? new Date(st.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => deleteStore(st.id)}
                        className="px-2 py-1 bg-red-600 rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
