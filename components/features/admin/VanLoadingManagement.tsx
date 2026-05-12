'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Save, Plus, Trash2, PackagePlus, RotateCcw, History, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  name: string;
  username: string;
  branch: string;
}

interface Product {
  id: string;
  name: string;
  code?: string;
  current_stock?: number;
  display_stock?: number;
  display_stock_label?: string;
}

interface FreezerInItem {
  productId: string;
  qty: string;
  notes: string;
}

interface VanLoadItem {
  productId: string;
  quantity: string;
}

interface VanReturnItem {
  productId: string;
  qty: string;
  notes: string;
}

function ItemRow({
  item, idx, products,
  onChange, onRemove,
  showNotes = false,
}: {
  item: { productId: string; qty?: string; quantity?: string; notes?: string };
  idx: number;
  products: Product[];
  onChange: (idx: number, field: string, value: string) => void;
  onRemove: (idx: number) => void;
  showNotes?: boolean;
}) {
  return (
    <div className="flex gap-2 items-start">
      <select
        value={item.productId}
        onChange={(e) => onChange(idx, 'productId', e.target.value)}
        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm"
      >
        {products.map(p => (
          <option key={p.id} value={p.id}>{p.name}{(p.display_stock ?? p.current_stock) != null ? ` (${p.display_stock_label || 'freezer'}: ${p.display_stock ?? p.current_stock})` : ''}</option>
        ))}
      </select>
      <input
        type="number"
        min="1"
        step="1"
        placeholder="Qty"
        value={item.qty ?? item.quantity ?? ''}
        onChange={(e) => onChange(idx, 'qty', e.target.value)}
        className="w-20 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-center text-sm"
      />
      {showNotes && (
        <input
          placeholder="Nota"
          value={item.notes || ''}
          onChange={(e) => onChange(idx, 'notes', e.target.value)}
          className="w-36 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm"
        />
      )}
      <button type="button" onClick={() => onRemove(idx)} className="p-2 text-red-400 hover:bg-slate-800 rounded">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

interface Movement {
  id: string;
  movement_type: string;
  product_name: string;
  qty: number;
  from_bucket: string | null;
  to_bucket: string | null;
  source_ref: string | null;
  actor_name: string | null;
  branch: string;
  notes: string | null;
  movement_date: string;
}

const TYPE_LABEL: Record<string, string> = {
  freezer_in: 'Stok Masuk Freezer',
  freezer_to_van: 'Freezer → Van',
  van_to_freezer: 'Van → Freezer',
  sale_deduct: 'Jualan',
  return_approved: 'Return Diluluskan',
  carry_forward: 'Baki Bawa Maju',
  damage_write_off: 'Hapus Kira Rosak',
  adjustment: 'Pelarasan',
  void_sale_return: 'Void jualan (stok balik van)',
};

const TYPE_COLOR: Record<string, string> = {
  freezer_in: 'text-emerald-400',
  freezer_to_van: 'text-orange-400',
  van_to_freezer: 'text-blue-400',
  sale_deduct: 'text-red-400',
  return_approved: 'text-purple-400',
  carry_forward: 'text-slate-400',
  damage_write_off: 'text-red-500',
  adjustment: 'text-yellow-400',
  void_sale_return: 'text-cyan-400',
};

export default function VanLoadingManagement() {
  const [activeTab, setActiveTab] = useState<'freezer_in' | 'van_load' | 'van_return' | 'history'>('freezer_in');
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vanReturnProducts, setVanReturnProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingVanReturnProducts, setLoadingVanReturnProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Forms ──
  const [freezerInItems, setFreezerInItems] = useState<FreezerInItem[]>([]);
  const [vanLoadUser, setVanLoadUser] = useState('');
  const [vanLoadItems, setVanLoadItems] = useState<VanLoadItem[]>([]);
  const [vanReturnUser, setVanReturnUser] = useState('');
  const [vanReturnItems, setVanReturnItems] = useState<VanReturnItem[]>([]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/users?role=Sales');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : (data?.data || []));
    } catch { setUsers([]); }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : (data?.data || []));
    } catch { setProducts([]); }
  }, []);

  const fetchMovements = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch('/api/inventory/movements?limit=200');
      const data = await res.json();
      setMovements(Array.isArray(data) ? data : []);
    } catch { setMovements([]); }
    setLoadingData(false);
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchProducts();
    const channel = supabase.channel('users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: 'role=eq.Sales' }, fetchStaff)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStaff, fetchProducts]);

  useEffect(() => {
    if (activeTab === 'history') fetchMovements();
  }, [activeTab, fetchMovements]);

  useEffect(() => {
    if (!vanReturnUser) {
      setVanReturnProducts([]);
      setVanReturnItems([]);
      return;
    }

    let cancelled = false;

    const fetchVanReturnProducts = async () => {
      setLoadingVanReturnProducts(true);
      try {
        const res = await fetch(`/api/inventory/van?userId=${vanReturnUser}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat inventori van');

        const nextProducts = Array.isArray(data?.products)
          ? data.products
              .map((item: { id?: string; name?: string; stock?: number }) => ({
                id: String(item?.id || ''),
                name: String(item?.name || 'Produk'),
                display_stock: Number(item?.stock || 0),
                display_stock_label: 'van',
              }))
              .filter((item: Product) => item.id && (item.display_stock || 0) > 0)
          : [];

        if (!cancelled) {
          setVanReturnProducts(nextProducts);
          setVanReturnItems([]);
        }
      } catch {
        if (!cancelled) {
          setVanReturnProducts([]);
          setVanReturnItems([]);
        }
      }
      if (!cancelled) setLoadingVanReturnProducts(false);
    };

    fetchVanReturnProducts();

    return () => {
      cancelled = true;
    };
  }, [vanReturnUser]);

  // ── Helper: blank item ──
  const blankFI = () => ({ productId: products[0]?.id || '', qty: '', notes: '' });
  const blankVL = () => ({ productId: products[0]?.id || '', quantity: '' });
  const blankVR = () => ({ productId: vanReturnProducts[0]?.id || '', qty: '', notes: '' });
  const parsePositiveInt = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  };
  const sumQuantitiesByProduct = <T extends { productId: string }>(items: T[], getQty: (item: T) => number) => (
    items.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = (acc[item.productId] || 0) + getQty(item);
      return acc;
    }, {})
  );

  // ── Submit: Stok Masuk Freezer ──
  const handleFreezerIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = freezerInItems
      .map((item) => ({ ...item, qty: parsePositiveInt(item.qty) }))
      .filter(item => item.productId && item.qty > 0);
    if (valid.length === 0) return showToast('Tambah sekurang-kurangnya 1 item dengan kuantiti > 0', 'error');
    setSubmitting(true);
    try {
      const freezerStockByProductId = new Map(products.map((product) => [product.id, product.current_stock || 0]));
      for (const item of valid) {
        const prod = products.find(p => p.id === item.productId);
        const nextStock = (freezerStockByProductId.get(item.productId) || 0) + item.qty;
        // Update freezer stock in products table
        await fetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: item.productId,
            stock: nextStock,
            current_stock: nextStock,
            stock_adjust_context: 'freezer_in',
            reason: item.notes?.trim() || undefined,
          }),
        });
        freezerStockByProductId.set(item.productId, nextStock);
        // Log movement
        await fetch('/api/inventory/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            movement_type: 'freezer_in',
            product_id: item.productId,
            product_name: prod?.name,
            qty: item.qty,
            from_bucket: 'supplier',
            to_bucket: 'freezer',
            notes: item.notes || null,
          }),
        });
      }
      showToast(`${valid.length} produk berjaya direkod masuk freezer`);
      setFreezerInItems([]);
      fetchProducts();
    } catch { showToast('Gagal rekod stok masuk', 'error'); }
    setSubmitting(false);
  };

  // ── Submit: Muatan Van ──
  const handleVanLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vanLoadUser) return showToast('Sila pilih salesman', 'error');
    const valid = vanLoadItems
      .map((item) => ({ ...item, quantity: parsePositiveInt(item.quantity) }))
      .filter(item => item.productId && item.quantity > 0);
    if (valid.length === 0) return showToast('Tambah sekurang-kurangnya 1 item', 'error');

    const vanLoadTotals = sumQuantitiesByProduct(valid, (item) => item.quantity);
    const exceededStockId = Object.entries(vanLoadTotals).find(([productId, quantity]) => {
      const product = products.find((p) => p.id === productId);
      return quantity > (product?.current_stock || 0);
    })?.[0];

    if (exceededStockId) {
      const product = products.find((p) => p.id === exceededStockId);
      return showToast(`Kuantiti ${product?.name || 'produk'} melebihi stok freezer`, 'error');
    }

    setSubmitting(true);
    try {
      const selectedUser = users.find(u => u.id === vanLoadUser);
      const res = await fetch('/api/inventory/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: vanLoadUser,
          items: valid,
          actor_branch: selectedUser?.branch || 'HQ',
          actor_name: selectedUser?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast(`Muatan van berjaya direkod untuk ${selectedUser?.name}`);
      setVanLoadItems([]);
      setVanLoadUser('');
      fetchProducts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal rekod muatan van', 'error');
    }
    setSubmitting(false);
  };

  // ── Submit: Van Pulang ke Freezer ──
  const handleVanReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vanReturnUser) return showToast('Sila pilih salesman', 'error');
    const valid = vanReturnItems
      .map((item) => ({ ...item, qty: parsePositiveInt(item.qty) }))
      .filter(item => item.productId && item.qty > 0);
    if (valid.length === 0) return showToast('Tambah sekurang-kurangnya 1 item', 'error');

    const vanReturnTotals = sumQuantitiesByProduct(valid, (item) => item.qty);
    const exceededVanStockId = Object.entries(vanReturnTotals).find(([productId, quantity]) => {
      const product = vanReturnProducts.find((p) => p.id === productId);
      return quantity > (product?.display_stock || 0);
    })?.[0];

    if (exceededVanStockId) {
      const product = vanReturnProducts.find((p) => p.id === exceededVanStockId);
      return showToast(`Kuantiti ${product?.name || 'produk'} melebihi baki van`, 'error');
    }

    setSubmitting(true);
    try {
      const selectedUser = users.find(u => u.id === vanReturnUser);
      const freezerStockByProductId = new Map(products.map((product) => [product.id, product.current_stock || 0]));
      for (const item of valid) {
        const prod = products.find(p => p.id === item.productId);
        // Deduct from van inventory first so freezer stock is only added after validation passes
        const vanRes = await fetch('/api/inventory/van', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: vanReturnUser, items: { [item.productId]: item.qty } }),
        });
        const vanData = await vanRes.json();
        if (!vanRes.ok) throw new Error(vanData?.error || 'Gagal kemas kini inventori van');

        // Add back to freezer stock
        const nextStock = (freezerStockByProductId.get(item.productId) || 0) + item.qty;
        const productRes = await fetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: item.productId,
            stock: nextStock,
            current_stock: nextStock,
            stock_adjust_context: 'van_to_freezer',
            reason: item.notes?.trim() || undefined,
          }),
        });
        if (!productRes.ok) throw new Error('Gagal kemas kini stok freezer');
        freezerStockByProductId.set(item.productId, nextStock);

        // Log movement
        const movementRes = await fetch('/api/inventory/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            movement_type: 'van_to_freezer',
            product_id: item.productId,
            product_name: prod?.name,
            qty: item.qty,
            from_bucket: 'van',
            to_bucket: 'freezer',
            actor_id: vanReturnUser,
            actor_name: selectedUser?.name,
            branch: selectedUser?.branch || 'HQ',
            notes: item.notes || null,
          }),
        });
        if (!movementRes.ok) throw new Error('Gagal merekod log pergerakan');
      }
      showToast(`Stok pulang dari van ${selectedUser?.name} berjaya direkod`);
      setVanReturnItems([]);
      setVanReturnUser('');
      setVanReturnProducts([]);
      fetchProducts();
    } catch { showToast('Gagal rekod pulangan van', 'error'); }
    setSubmitting(false);
  };

  const tabs = [
    { id: 'freezer_in', label: 'Stok Masuk Freezer', icon: PackagePlus, color: 'text-emerald-400' },
    { id: 'van_load', label: 'Muatan Van', icon: Truck, color: 'text-orange-400' },
    { id: 'van_return', label: 'Van → Freezer', icon: RotateCcw, color: 'text-blue-400' },
    { id: 'history', label: 'Log Pergerakan', icon: History, color: 'text-slate-300' },
  ] as const;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <t.icon size={15} className={activeTab === t.id ? t.color : ''} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Stok Masuk Freezer ── */}
      {activeTab === 'freezer_in' && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-white font-semibold text-lg flex items-center gap-2"><PackagePlus className="text-emerald-400" size={18} /> Rekod Stok Masuk Freezer</h2>
            <p className="text-slate-500 text-xs mt-1">Stok baharu dari supplier / penghantaran masuk ke dalam freezer.</p>
          </div>
          <form onSubmit={handleFreezerIn} className="space-y-3">
            {freezerInItems.map((item, idx) => (
              <ItemRow key={idx} item={item} idx={idx} products={products} showNotes
                onChange={(i, f, v) => {
                  const next = [...freezerInItems];
                  if (f === 'qty') next[i].qty = v;
                  else if (f === 'notes') next[i].notes = v;
                  else next[i].productId = v;
                  setFreezerInItems(next);
                }}
                onRemove={(i) => setFreezerInItems(freezerInItems.filter((_, x) => x !== i))}
              />
            ))}
            <button type="button" onClick={() => setFreezerInItems([...freezerInItems, blankFI()])}
              className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              <Plus size={14} /> Tambah Produk
            </button>
            {freezerInItems.length > 0 && (
              <button type="submit" disabled={submitting}
                className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 mt-2">
                <Save size={16} /> {submitting ? 'Menyimpan...' : 'Simpan Stok Masuk'}
              </button>
            )}
          </form>
        </div>
      )}

      {/* ── TAB: Muatan Van ── */}
      {activeTab === 'van_load' && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-white font-semibold text-lg flex items-center gap-2"><Truck className="text-orange-400" size={18} /> Muatan Van (Freezer → Van)</h2>
            <p className="text-slate-500 text-xs mt-1">Rekod stok keluar dari freezer dan dimuatkan ke van salesman.</p>
          </div>
          {users.length === 0 || products.length === 0 ? (
            <p className="text-slate-500 text-sm">Memuatkan data...</p>
          ) : (
            <form onSubmit={handleVanLoad} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Salesman</label>
                <select value={vanLoadUser} onChange={(e) => setVanLoadUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" required>
                  <option value="">-- Pilih Salesman --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
                </select>
              </div>
              {vanLoadItems.map((item, idx) => (
                <ItemRow key={idx} item={item} idx={idx} products={products}
                  onChange={(i, f, v) => {
                    const next = [...vanLoadItems];
                    if (f === 'qty') next[i].quantity = v;
                    else next[i].productId = v;
                    setVanLoadItems(next);
                  }}
                  onRemove={(i) => setVanLoadItems(vanLoadItems.filter((_, x) => x !== i))}
                />
              ))}
              <button type="button" onClick={() => setVanLoadItems([...vanLoadItems, blankVL()])}
                className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1">
                <Plus size={14} /> Tambah Item
              </button>
              {vanLoadItems.length > 0 && (
                <button type="submit" disabled={submitting}
                  className="w-full bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 mt-2">
                  <Truck size={16} /> {submitting ? 'Menyimpan...' : 'Rekod Muatan Van'}
                </button>
              )}
            </form>
          )}
        </div>
      )}

      {/* ── TAB: Van Pulang ke Freezer ── */}
      {activeTab === 'van_return' && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-white font-semibold text-lg flex items-center gap-2"><RotateCcw className="text-blue-400" size={18} /> Stok Pulang Van → Freezer</h2>
            <p className="text-slate-500 text-xs mt-1">Stok baki van yang tidak habis dijual dikembalikan ke freezer.</p>
          </div>
          <form onSubmit={handleVanReturn} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Salesman</label>
              <select value={vanReturnUser} onChange={(e) => setVanReturnUser(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" required>
                <option value="">-- Pilih Salesman --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
              </select>
            </div>
            {vanReturnUser && loadingVanReturnProducts && (
              <p className="text-slate-500 text-sm">Memuatkan baki van...</p>
            )}
            {vanReturnUser && !loadingVanReturnProducts && vanReturnProducts.length === 0 && (
              <p className="text-slate-500 text-sm">Tiada baki stok dalam van untuk salesman ini.</p>
            )}
            {vanReturnItems.map((item, idx) => (
              <ItemRow key={idx} item={item} idx={idx} products={vanReturnProducts} showNotes
                onChange={(i, f, v) => {
                  const next = [...vanReturnItems];
                  if (f === 'qty') next[i].qty = v;
                  else if (f === 'notes') next[i].notes = v;
                  else next[i].productId = v;
                  setVanReturnItems(next);
                }}
                onRemove={(i) => setVanReturnItems(vanReturnItems.filter((_, x) => x !== i))}
              />
            ))}
            <button type="button" onClick={() => setVanReturnItems([...vanReturnItems, blankVR()])}
              disabled={!vanReturnUser || loadingVanReturnProducts || vanReturnProducts.length === 0}
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <Plus size={14} /> Tambah Item
            </button>
            {vanReturnItems.length > 0 && (
              <button type="submit" disabled={submitting}
                className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 mt-2">
                <Save size={16} /> {submitting ? 'Menyimpan...' : 'Rekod Pulangan ke Freezer'}
              </button>
            )}
          </form>
        </div>
      )}

      {/* ── TAB: Log Pergerakan ── */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg flex items-center gap-2"><History className="text-slate-300" size={18} /> Log Pergerakan Stok</h2>
            <button onClick={fetchMovements} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded bg-slate-800">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {loadingData ? (
            <p className="text-slate-500 text-sm">Memuatkan log...</p>
          ) : movements.length === 0 ? (
            <p className="text-slate-500 text-sm">Tiada log lagi.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-left">
                    <th className="pb-2 px-2 text-slate-400">Tarikh</th>
                    <th className="pb-2 px-2 text-slate-400">Jenis</th>
                    <th className="pb-2 px-2 text-slate-400">Produk</th>
                    <th className="pb-2 px-2 text-slate-400 text-right">Qty</th>
                    <th className="pb-2 px-2 text-slate-400">Dari → Ke</th>
                    <th className="pb-2 px-2 text-slate-400">Petugas</th>
                    <th className="pb-2 px-2 text-slate-400">Rujukan</th>
                    <th className="pb-2 px-2 text-slate-400">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-2 py-2 text-slate-400 whitespace-nowrap">
                        {new Date(m.movement_date).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                        {new Date(m.movement_date).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className={`px-2 py-2 font-medium whitespace-nowrap ${TYPE_COLOR[m.movement_type] || 'text-slate-300'}`}>
                        {TYPE_LABEL[m.movement_type] || m.movement_type}
                      </td>
                      <td className="px-2 py-2 text-white">{m.product_name || '—'}</td>
                      <td className="px-2 py-2 text-right font-bold text-white">{m.qty}</td>
                      <td className="px-2 py-2 text-slate-400">{[m.from_bucket, m.to_bucket].filter(Boolean).join(' → ') || '—'}</td>
                      <td className="px-2 py-2 text-slate-400">{m.actor_name || '—'}</td>
                      <td className="px-2 py-2 text-slate-500 font-mono text-[11px] max-w-[140px] truncate" title={m.source_ref || ''}>
                        {m.source_ref || '—'}
                      </td>
                      <td className="px-2 py-2 text-slate-500 max-w-[200px]">{m.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
