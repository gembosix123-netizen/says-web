 'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Product } from '@/types';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: '', price: 0, sku: '', unit: 'pkt' });
  const { addToast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return addToast(data?.error || 'Failed', 'error');
    addToast('Created', 'success');
    setForm({ name: '', price: 0, sku: '', unit: 'pkt' });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete product?')) return;
    const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return addToast(data?.error || 'Failed', 'error');
    addToast('Deleted', 'success');
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Admin — Products</h1>

      <div className="p-4 rounded bg-slate-900">
        <h3 className="text-white mb-2">Create Product</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input placeholder="Nama Produk" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="p-2 bg-slate-800 text-white rounded" />
          <input placeholder="SKU / Kod" value={form.sku} onChange={(e) => setForm({...form, sku: e.target.value})} className="p-2 bg-slate-800 text-white rounded" />
          <input placeholder="Harga (RM)" type="number" value={form.price} onChange={(e) => setForm({...form, price: parseFloat(e.target.value || '0')})} className="p-2 bg-slate-800 text-white rounded" />
          <input placeholder="Unit (cth: pkt, kg)" value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})} className="p-2 bg-slate-800 text-white rounded" />
          <div><button onClick={create} className="px-3 py-2 bg-green-600 rounded w-full">Create</button></div>
        </div>
      </div>

      <div className="p-4 rounded bg-slate-900">
        <h3 className="text-white mb-2">Products</h3>
        <table className="w-full text-sm">
          <thead className="text-slate-400"><tr><th className="text-left px-2 py-2">Nama</th><th className="text-left px-2 py-2">SKU</th><th className="text-left px-2 py-2">Unit</th><th className="text-left px-2 py-2">Harga</th><th></th></tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-b border-slate-700/30">
                <td className="px-2 py-2 text-white font-semibold">{p.name}</td>
                <td className="px-2 py-2 text-slate-300">{(p as any).code || p.sku || '-'}</td>
                <td className="px-2 py-2 text-slate-300">{p.unit || '-'}</td>
                <td className="px-2 py-2 text-slate-300">RM {Number(p.price).toFixed(2)}</td>
                <td className="px-2 py-2"><button onClick={() => del(p.id)} className="px-2 py-1 bg-red-600 rounded text-sm">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
