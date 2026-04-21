 'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Product } from '@/types';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: '', price: 0, sku: '', unit: 'pkt' });
  const [userRole, setUserRole] = useState<string>('');
  const [isEditing, setIsEditing] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', price: 0, sku: '', unit: 'pkt', current_stock: 0, password: '' });
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

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        setUserRole(data.role || '');
      } catch (e) {
        console.error('Failed to fetch user role:', e);
      }
    }
    fetchUserRole();
  }, []);

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

  const startEdit = (product: Product) => {
    setIsEditing(product);
    setEditForm({
      name: product.name,
      price: product.price,
      sku: product.sku || '',
      unit: product.unit || 'pkt',
      current_stock: (product as any).current_stock ?? 0,
      password: '',
    });
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setEditForm({ name: '', price: 0, sku: '', unit: 'pkt', current_stock: 0, password: '' });
  };

  const saveEdit = async () => {
    if (!isEditing) return;

    const res = await fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: isEditing.id,
        name: editForm.name,
        sku: editForm.sku,
        price: editForm.price,
        unit: editForm.unit,
        current_stock: editForm.current_stock,
        password: editForm.password,
      }),
    });

    const data = await res.json();
    if (!res.ok) return addToast(data?.error || 'Failed to update product', 'error');

    addToast('Product updated', 'success');
    cancelEdit();
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
      {isEditing && (
        <div className="p-4 rounded bg-slate-900">
          <h3 className="text-white mb-2">Edit Product</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <input placeholder="Nama Produk" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="p-2 bg-slate-800 text-white rounded" />
            <input placeholder="SKU / Kod" value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} className="p-2 bg-slate-800 text-white rounded" />
            <input placeholder="Harga (RM)" type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value || '0') })} className="p-2 bg-slate-800 text-white rounded" />
            <input placeholder="Unit (cth: pkt, kg)" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className="p-2 bg-slate-800 text-white rounded" />
            <input placeholder="Current Stock" type="number" value={editForm.current_stock} onChange={(e) => setEditForm({ ...editForm, current_stock: parseInt(e.target.value || '0', 10) })} className="p-2 bg-slate-800 text-white rounded" />
            <input placeholder="Main Admin Password" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className="p-2 bg-slate-800 text-white rounded" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={saveEdit} className="px-3 py-2 bg-blue-600 rounded text-white">Save</button>
            <button onClick={cancelEdit} className="px-3 py-2 bg-slate-700 rounded text-white">Cancel</button>
          </div>
        </div>
      )}

      <div className="p-4 rounded bg-slate-900">
        <h3 className="text-white mb-2">Products</h3>
        <table className="w-full text-sm">
          <thead className="text-slate-400"><tr><th className="text-left px-2 py-2">Nama</th><th className="text-left px-2 py-2">SKU</th><th className="text-left px-2 py-2">Current Stock</th><th className="text-left px-2 py-2">Harga</th><th></th></tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-b border-slate-700/30">
                <td className="px-2 py-2 text-white font-semibold">{p.name}</td>
                <td className="px-2 py-2 text-slate-300">{(p as any).code || p.sku || '-'}</td>
                <td className="px-2 py-2 text-slate-300">{(p as any).current_stock != null ? (p as any).current_stock : '-'}</td>
                <td className="px-2 py-2 text-slate-300">RM {Number(p.price).toFixed(2)}</td>
                <td className="px-2 py-2 flex gap-2">
                  {userRole === 'Main Admin' && (
                    <button onClick={() => startEdit(p)} className="px-2 py-1 bg-blue-600 rounded text-sm">Edit</button>
                  )}
                  <button onClick={() => del(p.id)} className="px-2 py-1 bg-red-600 rounded text-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
