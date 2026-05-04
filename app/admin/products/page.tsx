'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import { normalizeRole } from '@/lib/roles';
import { Product } from '@/types';
import { Tag, ChevronDown, ChevronUp, Plus, X, PackagePlus, Pencil, Clock, ShieldAlert, CheckCircle } from 'lucide-react';

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

interface ProductRecord extends Product {
  factory_price?: number;
  cost?: number;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [form, setForm] = useState({ name: '', price: 0, factoryPrice: 0, stock: 0, sku: '' });
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
  const [userRole, setUserRole] = useState('');
  const [activeGrant, setActiveGrant] = useState<{
    id: string;
    expires_at: string;
    change_count: number;
    duration_minutes: number;
  } | null>(null);
  const [grantNow, setGrantNow] = useState(() => Date.now());
  const [requestGrantOpen, setRequestGrantOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestDuration, setRequestDuration] = useState(15);
  const [requestSaving, setRequestSaving] = useState(false);
  const [stockEditModal, setStockEditModal] = useState<{ id: string; name: string; current: number } | null>(null);
  const [stockEditNew, setStockEditNew] = useState('');
  const [stockEditReason, setStockEditReason] = useState('');
  const [stockEditSaving, setStockEditSaving] = useState(false);
  const [productEditModal, setProductEditModal] = useState<{
    id: string;
    name: string;
    sku: string;
    price: number;
    factoryPrice: number;
    unit: string;
  } | null>(null);
  const [productEditPassword, setProductEditPassword] = useState('');
  const [productEditSaving, setProductEditSaving] = useState(false);
  const [finishSessionSaving, setFinishSessionSaving] = useState(false);
  /** Banner selepas sesi tamat: manual = pengguna tekan Selesai; expired = masa habis */
  const [sessionEndedKind, setSessionEndedKind] = useState<'manual' | 'expired' | null>(null);
  const prevGrantActiveRef = useRef(false);
  const suppressExpiryBannerRef = useRef(false);
  const { addToast } = useToast();

  const roleNorm = normalizeRole(userRole);
  const isMainAdmin = roleNorm === 'Main Admin';
  const isBranchAdmin = roleNorm === 'Admin';
  const grantExpiresMs = activeGrant?.expires_at ? new Date(activeGrant.expires_at).getTime() : 0;
  const grantActive = Boolean(activeGrant && grantExpiresMs > grantNow);
  const canDirectEditStock = isMainAdmin || (isBranchAdmin && grantActive);

  const refreshActiveGrant = useCallback(async () => {
    try {
      const res = await fetch('/api/stock-grants?view=active');
      if (!res.ok) return;
      const data = await res.json();
      setActiveGrant(data.grant || null);
    } catch {
      /* noop */
    }
  }, []);

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
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (raw) {
        const u = JSON.parse(raw) as { role?: string };
        if (u.role) setUserRole(u.role);
      }
    } catch {
      /* noop */
    }
    async function fetchUserRole() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setUserRole(data.role || '');
      } catch (e) {
        console.error('Failed to fetch user role:', e);
      }
    }
    fetchUserRole();
  }, []);

  useEffect(() => {
    refreshActiveGrant();
  }, [refreshActiveGrant, userRole]);

  useEffect(() => {
    if (!isBranchAdmin || isMainAdmin) return undefined;
    const id = window.setInterval(() => {
      setGrantNow(Date.now());
      refreshActiveGrant();
    }, 15000);
    return () => window.clearInterval(id);
  }, [isBranchAdmin, isMainAdmin, refreshActiveGrant]);

  useEffect(() => {
    if (!grantActive) return undefined;
    const id = window.setInterval(() => setGrantNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [grantActive]);

  useEffect(() => {
    if (grantActive) {
      setSessionEndedKind(null);
      suppressExpiryBannerRef.current = false;
    } else if (isBranchAdmin && prevGrantActiveRef.current && !suppressExpiryBannerRef.current) {
      setSessionEndedKind('expired');
    }
    prevGrantActiveRef.current = grantActive;
  }, [grantActive, isBranchAdmin]);

  const handleFinishEditSession = async () => {
    if (!activeGrant?.id) return;
    if (!confirm('Tamatkan sesi edit stok? Selepas ini anda perlu minta akses semula untuk edit lagi.')) return;
    setFinishSessionSaving(true);
    try {
      suppressExpiryBannerRef.current = true;
      const res = await fetch(`/api/stock-grants/${activeGrant.id}/finish`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal');
      setSessionEndedKind('manual');
      addToast('Sesi edit ditamatkan.', 'success');
      await refreshActiveGrant();
      setGrantNow(Date.now());
    } catch (e) {
      suppressExpiryBannerRef.current = false;
      addToast(e instanceof Error ? e.message : 'Gagal', 'error');
    }
    setFinishSessionSaving(false);
  };

  const openProductEdit = (p: ProductRecord) => {
    const fp = p.factory_price ?? p.cost;
    setProductEditModal({
      id: p.id,
      name: p.name || '',
      sku: String(p.sku ?? p.code ?? ''),
      price: Number(p.price ?? 0),
      factoryPrice:
        fp !== undefined && fp !== null && Number(fp) > 0 ? Number(fp) : Number(p.price ?? 0),
      unit: String(p.unit || 'pkt'),
    });
    setProductEditPassword('');
  };

  const saveProductEdit = async () => {
    if (!productEditModal) return;
    if (!productEditModal.name.trim()) return addToast('Nama produk wajib diisi', 'error');
    if (productEditModal.price <= 0) return addToast('Harga jualan mesti lebih dari 0', 'error');
    if (!productEditPassword.trim()) return addToast('Password Main Admin wajib untuk kemaskini produk', 'error');
    setProductEditSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: productEditModal.id,
          name: productEditModal.name.trim(),
          sku: productEditModal.sku.trim(),
          price: productEditModal.price,
          factoryPrice: productEditModal.factoryPrice,
          unit: productEditModal.unit.trim() || 'pkt',
          password: productEditPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal kemaskini');
      }
      addToast('Produk dikemaskini', 'success');
      setProductEditModal(null);
      setProductEditPassword('');
      load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Gagal kemaskini', 'error');
    }
    setProductEditSaving(false);
  };

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
    setForm({ name: '', price: 0, factoryPrice: 0, stock: 0, sku: '' });
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
        body: JSON.stringify({
          id: stockInModal.id,
          stock: newStock,
          current_stock: newStock,
          stock_adjust_context: 'freezer_in',
          reason: stockInNotes?.trim() || undefined,
        }),
      });
      if (!putRes.ok) {
        const errBody = await putRes.json().catch(() => ({}));
        throw new Error(typeof errBody?.error === 'string' ? errBody.error : 'Gagal kemaskini stok');
      }
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

  const submitStockGrantRequest = async () => {
    const r = requestReason.trim();
    if (r.length < 5) return addToast('Sebab permintaan min 5 aksara', 'error');
    setRequestSaving(true);
    try {
      const res = await fetch('/api/stock-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason_request: r, requested_duration_minutes: requestDuration }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal');
      addToast('Permintaan dihantar ke Main Admin', 'success');
      setRequestGrantOpen(false);
      setRequestReason('');
      setRequestDuration(15);
      refreshActiveGrant();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Gagal', 'error');
    }
    setRequestSaving(false);
  };

  const handleStockEditSave = async () => {
    if (!stockEditModal) return;
    const next = parseInt(stockEditNew, 10);
    if (Number.isNaN(next) || next < 0) return addToast('Kuantiti stok tidak sah', 'error');
    if (next === stockEditModal.current) return addToast('Tiada perubahan', 'error');
    const reasonNeed = isBranchAdmin ? stockEditReason.trim().length >= 5 : stockEditReason.trim().length >= 0;
    if (isBranchAdmin && !reasonNeed) return addToast('Sebab penyesuaian wajib (min 5 aksara)', 'error');
    setStockEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        id: stockEditModal.id,
        stock: next,
        current_stock: next,
        reason: stockEditReason.trim() || (isMainAdmin ? 'Penyesuaian Main Admin' : undefined),
      };
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal kemaskini');
      addToast('Stok dikemaskini', 'success');
      setStockEditModal(null);
      setStockEditNew('');
      setStockEditReason('');
      load();
      refreshActiveGrant();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Gagal', 'error');
    }
    setStockEditSaving(false);
  };

  const grantSecondsLeft = grantActive ? Math.max(0, Math.floor((grantExpiresMs - grantNow) / 1000)) : 0;
  const grantTimeLabel = `${Math.floor(grantSecondsLeft / 60)}:${String(grantSecondsLeft % 60).padStart(2, '0')}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-white">Admin — Produk</h1>
        {isBranchAdmin && (
          <div className="flex flex-wrap gap-2">
            {!grantActive && (
              <button
                type="button"
                onClick={() => setRequestGrantOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white text-sm font-medium"
              >
                <ShieldAlert size={16} /> Minta akses edit stok
              </button>
            )}
          </div>
        )}
      </div>

      {isBranchAdmin && (
        <div
          className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm ${
            grantActive
              ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
              : sessionEndedKind
                ? sessionEndedKind === 'manual'
                  ? 'bg-sky-950/35 border-sky-700/50 text-sky-100'
                  : 'bg-amber-950/35 border-amber-700/50 text-amber-100'
                : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {grantActive ? (
              <Clock size={18} className="text-emerald-400 shrink-0" />
            ) : sessionEndedKind === 'manual' ? (
              <CheckCircle size={18} className="text-sky-400 shrink-0" />
            ) : sessionEndedKind === 'expired' ? (
              <Clock size={18} className="text-amber-400 shrink-0" />
            ) : (
              <Clock size={18} className="text-slate-500 shrink-0" />
            )}
            {grantActive ? (
              <span>
                Sesi edit stok aktif — baki masa <strong className="text-white">{grantTimeLabel}</strong>
                {typeof activeGrant?.change_count === 'number' && (
                  <span className="text-slate-400">
                    {' '}
                    · Ubahan: {activeGrant.change_count}/50
                  </span>
                )}
              </span>
            ) : sessionEndedKind === 'manual' ? (
              <span>
                <strong className="text-white">Sesi edit telah ditamatkan.</strong>{' '}
                Semua perubahan telah direkod. Tekan &quot;Minta akses edit stok&quot; jika perlu edit lagi.
              </span>
            ) : sessionEndedKind === 'expired' ? (
              <span>
                <strong className="text-white">Sesi edit tamat</strong> — masa lulusan telah habis. Tekan &quot;Minta akses
                edit stok&quot; untuk mohon sesi baharu.
              </span>
            ) : (
              <span>Tiada sesi lulusan. Tekan &quot;Minta akses edit stok&quot; untuk mohon kepada Main Admin.</span>
            )}
          </div>
          {grantActive && activeGrant?.id && (
            <button
              type="button"
              disabled={finishSessionSaving}
              onClick={handleFinishEditSession}
              className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-emerald-700/40 text-emerald-100 text-xs font-medium disabled:opacity-50"
            >
              <CheckCircle size={14} />
              {finishSessionSaving ? 'Menyimpan...' : 'Selesai edit'}
            </button>
          )}
        </div>
      )}

      {isMainAdmin && (
        <p className="text-xs text-slate-500">
          Main Admin: ubah stok terus (edit nilai) atau Stok In tanpa sesi; audit direkod automatik.
        </p>
      )}

      {/* Request grant modal */}
      {requestGrantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-400" /> Minta akses edit stok
              </h3>
              <button type="button" onClick={() => { setRequestGrantOpen(false); setRequestReason(''); }} className="text-slate-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400">Main Admin akan meluluskan tempoh akses (cadangan di bawah).</p>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Cadangan tempoh (minit)</label>
              <select
                value={requestDuration}
                onChange={(e) => setRequestDuration(Number(e.target.value))}
                className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700"
              >
                {[10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>{m} minit</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Sebab permintaan (wajib)</label>
              <textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={3}
                placeholder="cth: Stock take / pembetulan rekod..."
                className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setRequestGrantOpen(false); setRequestReason(''); }}
                className="flex-1 py-2 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={requestSaving || requestReason.trim().length < 5}
                onClick={submitStockGrantRequest}
                className="flex-1 py-2 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {requestSaving ? 'Menghantar...' : 'Hantar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit stock modal */}
      {stockEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Pencil size={16} className="text-blue-400" /> Edit stok freezer
              </h3>
              <button
                type="button"
                onClick={() => { setStockEditModal(null); setStockEditNew(''); setStockEditReason(''); }}
                className="text-slate-500 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-slate-300 font-medium">{stockEditModal.name}</p>
            <p className="text-xs text-slate-500">
              Stok semasa: <span className="text-blue-400 font-semibold">{stockEditModal.current}</span> unit
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Stok baharu (unit)</label>
              <input
                type="number"
                min={0}
                value={stockEditNew}
                onChange={(e) => setStockEditNew(e.target.value)}
                className="p-2 bg-slate-800 text-white rounded border border-slate-700"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">
                Sebab penyesuaian {isBranchAdmin ? '(wajib, min 5 aksara)' : '(pilihan)'}
              </label>
              <textarea
                value={stockEditReason}
                onChange={(e) => setStockEditReason(e.target.value)}
                rows={3}
                className="p-2 bg-slate-800 text-white rounded border border-slate-700 text-sm"
                placeholder="cth: Koreksi key-in / stock take..."
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setStockEditModal(null); setStockEditNew(''); setStockEditReason(''); }}
                className="flex-1 py-2 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={stockEditSaving}
                onClick={handleStockEditSave}
                className="flex-1 py-2 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {stockEditSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Nota (pilihan)</label>
                <textarea
                  value={stockInNotes}
                  onChange={(e) => setStockInNotes(e.target.value)}
                  rows={2}
                  placeholder="Resit / pembekal..."
                  className="p-2 bg-slate-800 text-white rounded border border-slate-700 text-sm"
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

      {/* Edit product (Main Admin + password) */}
      {productEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Pencil size={18} className="text-amber-400" /> Kemaskini produk
              </h3>
              <button
                type="button"
                onClick={() => {
                  setProductEditModal(null);
                  setProductEditPassword('');
                }}
                className="text-slate-500 hover:text-white"
                aria-label="Tutup">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Set harga kilang lebih rendah daripada harga jualan untuk margin yang betul. Perubahan memerlukan password Main Admin.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-slate-400">Nama produk</label>
                <input
                  value={productEditModal.name}
                  onChange={(e) =>
                    setProductEditModal((m) => (m ? { ...m, name: e.target.value } : m))
                  }
                  className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Kod SKU</label>
                <input
                  value={productEditModal.sku}
                  onChange={(e) =>
                    setProductEditModal((m) => (m ? { ...m, sku: e.target.value } : m))
                  }
                  className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Unit</label>
                <input
                  value={productEditModal.unit}
                  onChange={(e) =>
                    setProductEditModal((m) => (m ? { ...m, unit: e.target.value } : m))
                  }
                  className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Harga jualan (RM)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={productEditModal.price}
                  onChange={(e) =>
                    setProductEditModal((m) =>
                      m ? { ...m, price: parseFloat(e.target.value || '0') } : m
                    )
                  }
                  className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Harga kilang / factory (RM)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={productEditModal.factoryPrice}
                  onChange={(e) =>
                    setProductEditModal((m) =>
                      m ? { ...m, factoryPrice: parseFloat(e.target.value || '0') } : m
                    )
                  }
                  className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-slate-400">Password Main Admin</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={productEditPassword}
                  onChange={(e) => setProductEditPassword(e.target.value)}
                  placeholder="••••••••"
                  className="p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-amber-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setProductEditModal(null);
                  setProductEditPassword('');
                }}
                className="flex-1 py-2 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600">
                Batal
              </button>
              <button
                type="button"
                disabled={productEditSaving}
                onClick={() => void saveProductEdit()}
                className="flex-1 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold">
                {productEditSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-700 space-y-4">
        <h3 className="text-white font-semibold">Tambah Produk Baru</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <label className="text-xs text-slate-400 font-medium">Factory Price (RM)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.factoryPrice}
              onChange={(e) => setForm({ ...form, factoryPrice: parseFloat(e.target.value || '0') })}
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
                <th className="pb-3 px-2 text-slate-400 font-medium">Factory Price (RM)</th>
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
                  <td className="px-2 py-2.5 text-amber-300 font-medium">
                    RM {Number(p.factory_price ?? p.cost ?? p.price ?? 0).toFixed(2)}
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
                      {canDirectEditStock && (
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(p.stock ?? 0);
                            setStockEditModal({ id: p.id, name: p.name, current: cur });
                            setStockEditNew(String(cur));
                            setStockEditReason('');
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-xs transition-colors">
                          <Pencil size={10} /> Edit
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isMainAdmin && (
                        <button
                          type="button"
                          onClick={() => openProductEdit(p)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600/25 hover:bg-amber-600/45 text-amber-300 rounded text-xs font-medium transition-colors">
                          <Pencil size={10} /> Kemaskini
                        </button>
                      )}
                      <button onClick={() => del(p.id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white font-medium transition-colors">
                        Padam
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Pricing Panel */}
                {expandedPricing === p.id && (
                  <tr>
                    <td colSpan={6} className="bg-slate-800/60 px-4 py-4">
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
                <tr><td colSpan={6} className="px-2 py-8 text-center text-slate-500">Tiada produk lagi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
