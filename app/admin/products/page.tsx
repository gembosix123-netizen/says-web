'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Product } from '@/types';
import { Tag, ChevronDown, ChevronUp, Plus, X, PackagePlus } from 'lucide-react';

const ALL_BRANCHES = ['Kota Kinabalu', 'Kinabatangan', 'HQ'];

interface PriceOverride {
  id: string;
  product_id: string;
  branch: string | null;
  salesman_id: string | null;
  salesman_name?: string;
  price: number;
  notes?: string;
}

interface SalesmanUser {
  id: string;
  name: string;
  branch: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: '', price: 0, stock: 0, sku: '' });
  const [expandedPricing, setExpandedPricing] = useState<string | null>(null);
  const [pricingTab, setPricingTab] = useState<Record<string, 'branch' | 'salesman'>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, PriceOverride[]>>({});
  const [salesmen, setSalesmen] = useState<SalesmanUser[]>([]);
  const [newPriceForm, setNewPriceForm] = useState<Record<string, { branch: string; price: string; notes: string }>>({}); 
  const [newSalesmanPriceForm, setNewSalesmanPriceForm] = useState<Record<string, { salesman_id: string; price: string; notes: string }>>({});
  const [stockInModal, setStockInModal] = useState<{ id: string; name: string; current: number } | null>(null);
  const [stockInQty, setStockInQty] = useState('');
  const [stockInNotes, setStockInNotes] = useState('');
  const [stockInSaving, setStockInSaving] = useState(false);
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
    if (!form.name.trim()) return addToast('Nama produk wajib diisi', 'error');
    if (form.price <= 0) return addToast('Harga mesti lebih dari 0', 'error');
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) {
      const details = Array.isArray(data?.details) ? `: ${data.details.join(', ')}` : (data?.details ? `: ${String(data.details)}` : '');
      return addToast(`${data?.error || 'Failed'}${details}`, 'error');
    }
    addToast('Produk berjaya dicipta', 'success');
    setForm({ name: '', price: 0, stock: 0, sku: '' });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Padam produk ini?')) return;
    const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return addToast(data?.error || 'Failed', 'error');
    addToast('Produk dipadam', 'success');
    load();
  };

  const loadPriceOverrides = async (productId: string) => {
    try {
      const res = await fetch(`/api/products/prices?product_id=${productId}`);
      const data = await res.json();
      setPriceOverrides((prev) => ({ ...prev, [productId]: Array.isArray(data) ? data : [] }));
    } catch {}
  };

  const loadSalesmen = async () => {
    if (salesmen.length > 0) return;
    try {
      const res = await fetch('/api/users?role=Sales');
      const data = await res.json();
      setSalesmen(Array.isArray(data) ? data : []);
    } catch {}
  };

  const togglePricing = async (productId: string) => {
    if (expandedPricing === productId) {
      setExpandedPricing(null);
    } else {
      setExpandedPricing(productId);
      await Promise.all([loadPriceOverrides(productId), loadSalesmen()]);
      setNewPriceForm((prev) => ({ ...prev, [productId]: { branch: ALL_BRANCHES[0], price: '', notes: '' } }));
      setNewSalesmanPriceForm((prev) => ({ ...prev, [productId]: { salesman_id: '', price: '', notes: '' } }));
      setPricingTab((prev) => ({ ...prev, [productId]: prev[productId] || 'branch' }));
    }
  };

  const saveSalesmanPriceOverride = async (productId: string) => {
    const f = newSalesmanPriceForm[productId];
    if (!f?.salesman_id) return addToast('Sila pilih salesman', 'error');
    if (!f?.price || Number(f.price) <= 0) return addToast('Harga khas mesti lebih dari 0', 'error');
    const res = await fetch('/api/products/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, salesman_id: f.salesman_id, branch: null, price: Number(f.price), notes: f.notes || null }),
    });
    const data = await res.json();
    if (!res.ok) return addToast(data?.error || 'Gagal simpan harga', 'error');
    addToast('Harga khas salesman disimpan', 'success');
    await loadPriceOverrides(productId);
  };

  const savePriceOverride = async (productId: string) => {
    const f = newPriceForm[productId];
    if (!f?.price || Number(f.price) <= 0) return addToast('Harga khas mesti lebih dari 0', 'error');
    const res = await fetch('/api/products/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, branch: f.branch || null, price: Number(f.price), notes: f.notes || null }),
    });
    const data = await res.json();
    if (!res.ok) return addToast(data?.error || 'Gagal simpan harga', 'error');
    addToast('Harga khas disimpan', 'success');
    await loadPriceOverrides(productId);
  };

  const deletePriceOverride = async (productId: string, overrideId: string) => {
    const res = await fetch(`/api/products/prices?id=${overrideId}`, { method: 'DELETE' });
    if (!res.ok) return addToast('Gagal padam harga', 'error');
    addToast('Harga khas dipadam', 'success');
    await loadPriceOverrides(productId);
  };

  const handleStockIn = async () => {
    if (!stockInModal) return;
    const qty = parseInt(stockInQty);
    if (!qty || qty <= 0) return addToast('Kuantiti mesti lebih dari 0', 'error');
    setStockInSaving(true);
    try {
      // Update freezer stock
      const newStock = stockInModal.current + qty;
      const putRes = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stockInModal.id, stock: newStock, current_stock: newStock }),
      });
      if (!putRes.ok) throw new Error('Gagal kemaskini stok');
      // Log movement
      await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movement_type: 'freezer_in',
          product_id: stockInModal.id,
          product_name: stockInModal.name,
          qty,
          from_bucket: 'supplier',
          to_bucket: 'freezer',
          notes: stockInNotes || null,
        }),
      });
      addToast(`+${qty} unit ${stockInModal.name} direkod masuk freezer`, 'success');
      setStockInModal(null);
      setStockInQty('');
      setStockInNotes('');
      load();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal simpan', 'error');
    }
    setStockInSaving(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Admin — Produk</h1>

      {/* Stock-In Modal */}
      {stockInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2"><PackagePlus size={16} className="text-emerald-400" /> Stok Masuk Freezer</h3>
              <button onClick={() => { setStockInModal(null); setStockInQty(''); setStockInNotes(''); }} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-slate-300 font-medium">{stockInModal.name}</p>
            <p className="text-xs text-slate-500">Stok semasa: <span className="text-blue-400 font-semibold">{stockInModal.current} unit</span></p>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Kuantiti masuk (unit)</label>
                <input
                  type="number" min="1" placeholder="cth: 50" autoFocus
                  value={stockInQty}
                  onChange={(e) => setStockInQty(e.target.value)}
                  className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-emerald-500 outline-none text-lg font-bold"
                />
              </div>
            </div>
            {stockInQty && parseInt(stockInQty) > 0 && (
              <p className="text-xs text-slate-400 bg-slate-800 rounded px-3 py-2">
                Stok selepas: <span className="text-emerald-400 font-bold">{stockInModal.current + parseInt(stockInQty)} unit</span>
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setStockInModal(null); setStockInQty(''); setStockInNotes(''); }}
                className="flex-1 py-2 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600">Batal</button>
              <button onClick={handleStockIn} disabled={stockInSaving || !stockInQty || parseInt(stockInQty) <= 0}
                className="flex-1 py-2 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-1">
                <PackagePlus size={14} /> {stockInSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-700 space-y-4">
        <h3 className="text-white font-semibold">Tambah Produk Baru</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">Nama Produk <span className="text-red-400">*</span></label>
            <input
              placeholder="cth: Meatball 1kg"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">Kod SKU</label>
            <input
              placeholder="cth: MB-1KG"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">Harga Jualan (RM) <span className="text-red-400">*</span></label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value || '0') })}
              className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">Kuantiti Stok Freezer (unit)</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value || '0') })}
              className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <button onClick={create} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors">
          + Cipta Produk
        </button>
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

      {/* Products Table */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
        <h3 className="text-white font-semibold">Senarai Produk</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="pb-3 px-2 text-slate-400 font-medium">Nama Produk</th>
                <th className="pb-3 px-2 text-slate-400 font-medium">Kod SKU</th>
                <th className="pb-3 px-2 text-slate-400 font-medium">Harga Jualan (RM)</th>
                <th className="pb-3 px-2 text-slate-400 font-medium">Stok Freezer (unit)</th>
                <th className="pb-3 px-2 text-slate-400 font-medium">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
              <React.Fragment key={p.id}>
                <tr className="border-b border-slate-700/30 hover:bg-slate-800/40">
                  <td className="px-2 py-2.5 text-white font-medium">{p.name}</td>
                  <td className="px-2 py-2.5 text-slate-400 text-xs">{p.sku || '—'}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-semibold">RM {Number(p.price || 0).toFixed(2)}</span>
                      <button onClick={() => togglePricing(p.id)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded text-xs transition-colors">
                        <Tag size={10} />
                        Khas
                        {expandedPricing === p.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${Number(p.stock ?? 0) === 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {Number(p.stock ?? 0)} unit
                      </span>
                      <button
                        onClick={() => { setStockInModal({ id: p.id, name: p.name, current: Number(p.stock ?? 0) }); setStockInQty(''); setStockInNotes(''); }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded text-xs transition-colors">
                        <PackagePlus size={10} /> Stok In
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <button onClick={() => del(p.id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white font-medium transition-colors">
                      Padam
                    </button>
                  </td>
                </tr>

                {/* Pricing Panel */}
                {expandedPricing === p.id && (
                  <tr>
                    <td colSpan={5} className="bg-slate-800/60 px-4 py-4">
                      {/* Tabs */}
                      <div className="flex gap-1 mb-4">
                        <button
                          onClick={() => setPricingTab((prev) => ({ ...prev, [p.id]: 'branch' }))}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            (pricingTab[p.id] || 'branch') === 'branch'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-700 text-slate-400 hover:text-white'
                          }`}>
                          Harga Mengikut Cawangan
                        </button>
                        <button
                          onClick={() => setPricingTab((prev) => ({ ...prev, [p.id]: 'salesman' }))}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            pricingTab[p.id] === 'salesman'
                              ? 'bg-orange-600 text-white'
                              : 'bg-slate-700 text-slate-400 hover:text-white'
                          }`}>
                          Harga Mengikut Salesman
                        </button>
                      </div>

                      {/* Branch Pricing Tab */}
                      {(pricingTab[p.id] || 'branch') === 'branch' && (
                        <div>
                          <p className="text-xs text-slate-400 mb-3">
                            Diterapkan automatik bila salesman dari cawangan ini buat jualan.
                          </p>
                          {(priceOverrides[p.id] || []).filter(ov => ov.branch && !ov.salesman_id).length > 0 ? (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {priceOverrides[p.id].filter(ov => ov.branch && !ov.salesman_id).map((ov) => (
                                <div key={ov.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg text-sm">
                                  <span className="text-slate-300 font-medium">{ov.branch}</span>
                                  <span className="text-green-400 font-bold">RM {Number(ov.price).toFixed(2)}</span>
                                  {ov.notes && <span className="text-slate-500 text-xs">({ov.notes})</span>}
                                  <button onClick={() => deletePriceOverride(p.id, ov.id)}
                                    className="text-red-400 hover:text-red-300 ml-1"><X size={12} /></button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-500 text-xs mb-3">Tiada harga khas. Semua cawangan guna harga default RM {Number(p.price).toFixed(2)}.</p>
                          )}
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-slate-400">Cawangan</label>
                              <select
                                value={newPriceForm[p.id]?.branch || ''}
                                onChange={(e) => setNewPriceForm((prev) => ({ ...prev, [p.id]: { ...prev[p.id], branch: e.target.value } }))}
                                className="p-1.5 rounded bg-slate-700 text-white border border-slate-600 text-sm outline-none">
                                {ALL_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-slate-400">Harga Khas (RM)</label>
                              <input type="number" min="0" step="0.01" placeholder="0.00"
                                value={newPriceForm[p.id]?.price || ''}
                                onChange={(e) => setNewPriceForm((prev) => ({ ...prev, [p.id]: { ...prev[p.id], price: e.target.value } }))}
                                className="w-28 p-1.5 rounded bg-slate-700 text-white border border-slate-600 text-sm outline-none" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-slate-400">Nota (pilihan)</label>
                              <input placeholder="cth: harga promosi"
                                value={newPriceForm[p.id]?.notes || ''}
                                onChange={(e) => setNewPriceForm((prev) => ({ ...prev, [p.id]: { ...prev[p.id], notes: e.target.value } }))}
                                className="w-36 p-1.5 rounded bg-slate-700 text-white border border-slate-600 text-sm outline-none" />
                            </div>
                            <button onClick={() => savePriceOverride(p.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors">
                              <Plus size={14} /> Simpan Harga
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Salesman Pricing Tab */}
                      {pricingTab[p.id] === 'salesman' && (
                        <div>
                          <p className="text-xs text-slate-400 mb-3">
                            Harga khas untuk salesman tertentu — mengatasi harga cawangan dan harga default.
                          </p>
                          {(priceOverrides[p.id] || []).filter(ov => ov.salesman_id).length > 0 ? (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {priceOverrides[p.id].filter(ov => ov.salesman_id).map((ov) => {
                                const salesman = salesmen.find(s => s.id === ov.salesman_id);
                                return (
                                  <div key={ov.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg text-sm">
                                    <span className="text-orange-300 font-medium">{salesman?.name || ov.salesman_id}</span>
                                    {salesman?.branch && <span className="text-slate-500 text-xs">({salesman.branch})</span>}
                                    <span className="text-green-400 font-bold">RM {Number(ov.price).toFixed(2)}</span>
                                    {ov.notes && <span className="text-slate-500 text-xs">({ov.notes})</span>}
                                    <button onClick={() => deletePriceOverride(p.id, ov.id)}
                                      className="text-red-400 hover:text-red-300 ml-1"><X size={12} /></button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-slate-500 text-xs mb-3">Tiada harga khas salesman. Harga cawangan atau default akan digunakan.</p>
                          )}
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-slate-400">Salesman</label>
                              <select
                                value={newSalesmanPriceForm[p.id]?.salesman_id || ''}
                                onChange={(e) => setNewSalesmanPriceForm((prev) => ({ ...prev, [p.id]: { ...prev[p.id], salesman_id: e.target.value } }))}
                                className="p-1.5 rounded bg-slate-700 text-white border border-slate-600 text-sm outline-none min-w-[160px]">
                                <option value="">-- Pilih Salesman --</option>
                                {salesmen.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name} ({s.branch})</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-slate-400">Harga Khas (RM)</label>
                              <input type="number" min="0" step="0.01" placeholder="0.00"
                                value={newSalesmanPriceForm[p.id]?.price || ''}
                                onChange={(e) => setNewSalesmanPriceForm((prev) => ({ ...prev, [p.id]: { ...prev[p.id], price: e.target.value } }))}
                                className="w-28 p-1.5 rounded bg-slate-700 text-white border border-slate-600 text-sm outline-none" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-slate-400">Nota (pilihan)</label>
                              <input placeholder="cth: harga vip"
                                value={newSalesmanPriceForm[p.id]?.notes || ''}
                                onChange={(e) => setNewSalesmanPriceForm((prev) => ({ ...prev, [p.id]: { ...prev[p.id], notes: e.target.value } }))}
                                className="w-36 p-1.5 rounded bg-slate-700 text-white border border-slate-600 text-sm outline-none" />
                            </div>
                            <button onClick={() => saveSalesmanPriceOverride(p.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm font-medium transition-colors">
                              <Plus size={14} /> Simpan Harga
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {products.length === 0 && (
                <tr><td colSpan={5} className="px-2 py-8 text-center text-slate-500">Tiada produk lagi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
