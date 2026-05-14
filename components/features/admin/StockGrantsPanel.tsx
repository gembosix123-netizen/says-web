'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X,
  ClipboardList,
  ShieldCheck,
  Inbox,
  Zap,
  Archive,
  ChevronRight,
  Info,
} from 'lucide-react';

type StockAdjustAuditEvent = {
  id: string;
  created_at: string;
  reason: string | null;
  entity_id: string | null;
  metadata?: { product_name?: string | null; delta?: number };
  audit_event_changes?: Array<{ field_name: string; old_value: unknown; new_value: unknown }>;
};

type GrantRow = {
  id: string;
  requester_id: string;
  requester_name: string | null;
  requester_branch: string | null;
  status: string;
  duration_minutes: number;
  requested_duration_minutes: number | null;
  requested_at: string;
  approved_at: string | null;
  expires_at: string | null;
  reason_request: string | null;
  reason_approve: string | null;
  change_count: number;
};

const STATUS_LABEL_MS: Record<string, string> = {
  pending: 'Menunggu kelulusan',
  active: 'Sesi aktif',
  expired: 'Tamat (masa habis atau ditamatkan)',
  revoked: 'Ditarik balik oleh HQ',
  denied: 'Permintaan ditolak',
};

export function StockGrantsPanel() {
  const [tab, setTab] = useState<'pending' | 'active' | 'history'>('pending');
  const [pending, setPending] = useState<GrantRow[]>([]);
  const [active, setActive] = useState<GrantRow[]>([]);
  const [historyItems, setHistoryItems] = useState<GrantRow[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [durationById, setDurationById] = useState<Record<string, number>>({});
  const [approveNotesById, setApproveNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [changesModalGrant, setChangesModalGrant] = useState<GrantRow | null>(null);
  const [changesLoading, setChangesLoading] = useState(false);
  const [changesEvents, setChangesEvents] = useState<StockAdjustAuditEvent[]>([]);

  const loadGrantStockChanges = useCallback(async (grantId: string) => {
    setChangesLoading(true);
    try {
      const params = new URLSearchParams({
        referenceNo: grantId,
        action: 'stock_adjust',
        module: 'inventory',
        pageSize: '100',
        page: '1',
      });
      const res = await fetch(`/api/audit/events?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      setChangesEvents(Array.isArray(data.items) ? data.items : []);
    } catch {
      setChangesEvents([]);
    }
    setChangesLoading(false);
  }, []);

  const openChangesModal = (g: GrantRow) => {
    setChangesModalGrant(g);
    loadGrantStockChanges(g.id);
  };

  const closeChangesModal = () => {
    setChangesModalGrant(null);
    setChangesEvents([]);
  };

  const formatAuditVal = (v: unknown) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  const loadPending = useCallback(async () => {
    const res = await fetch('/api/stock-grants?status=pending');
    if (!res.ok) return;
    const data = await res.json();
    setPending(Array.isArray(data.items) ? data.items : []);
  }, []);

  const loadActive = useCallback(async () => {
    const res = await fetch('/api/stock-grants?status=active');
    if (!res.ok) return;
    const data = await res.json();
    setActive(Array.isArray(data.items) ? data.items : []);
  }, []);

  const loadHistory = useCallback(async (page: number) => {
    const res = await fetch(`/api/stock-grants?view=history&page=${page}&pageSize=30`);
    if (!res.ok) return;
    const data = await res.json();
    setHistoryItems(Array.isArray(data.items) ? data.items : []);
    setHistoryTotalPages(Number(data.totalPages) || 0);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadPending(), loadActive(), loadHistory(historyPage)]);
    } finally {
      setLoading(false);
    }
  }, [loadPending, loadActive, loadHistory, historyPage]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (tab !== 'active') return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [tab]);

  useEffect(() => {
    if (tab === 'history') loadHistory(historyPage);
  }, [tab, historyPage, loadHistory]);

  const approve = async (g: GrantRow) => {
    const mins = durationById[g.id] ?? g.requested_duration_minutes ?? g.duration_minutes ?? 15;
    setBusyId(g.id);
    try {
      const res = await fetch(`/api/stock-grants/${g.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_minutes: mins,
          reason_approve: approveNotesById[g.id]?.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal');
      await refreshAll();
      setTab('active');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal');
    }
    setBusyId(null);
  };

  const deny = async (g: GrantRow) => {
    if (!confirm('Tolak permintaan ini?')) return;
    setBusyId(g.id);
    try {
      const res = await fetch(`/api/stock-grants/${g.id}/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal');
      await refreshAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal');
    }
    setBusyId(null);
  };

  const revoke = async (g: GrantRow) => {
    if (!confirm('Tarik balik sesi aktif ini? Staf tidak boleh edit stok lagi.')) return;
    setBusyId(g.id);
    try {
      const res = await fetch(`/api/stock-grants/${g.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal');
      await refreshAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal');
    }
    setBusyId(null);
  };

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

  const secondsLeft = (expiresAt: string | null) => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  };

  const statusLabel = (s: string) => STATUS_LABEL_MS[s.toLowerCase()] || s;

  const tabHints: Record<'pending' | 'active' | 'history', { title: string; body: string }> = {
    pending: {
      title: 'Permintaan daripada Admin cawangan',
      body:
        'Staf di cawangan (contoh Kinabatangan) sudah tekan “Minta akses” di halaman Produk. Anda pilih berapa minit sesi jika lulus, kemudian Lulus atau Tolak.',
    },
    active: {
      title: 'Sesi sedang dibenarkan',
      body:
        'Staf sedang boleh edit stok freezer di Produk sehingga masa tamat. Gunakan “Lihat ubahan stok” untuk semak produk yang sudah diubah; “Tarik balik” jika mahu tutup sesi lebih awal.',
    },
    history: {
      title: 'Rekod sesi yang lepas',
      body:
        'Setiap baris ialah satu permintaan/sesi. “Ubahan rekod” = bilangan kali stok diubah dalam sesi itu. Klik “Lihat ubahan stok” untuk jadual produk, kuantiti lama/baharu, dan sebab.',
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400/90 text-xs font-semibold uppercase tracking-wide mb-1">
            <ShieldCheck size={14} /> Kawalan HQ — stok freezer
          </div>
          <h1 className="text-2xl font-bold text-white">Lulusan edit stok</h1>
          <p className="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
            Halaman ini untuk <strong className="text-slate-200">meluluskan masa</strong> sahaja: Admin cawangan tidak boleh ubah nombor stok
            sesuka hati — mereka perlu <strong className="text-slate-200">sesi yang anda luluskan</strong>. Semua ubahan stok direkod dalam
            audit (jelas siapa, produk apa, nilai lama/baharu).
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshAll()}
          className="shrink-0 px-4 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600"
        >
          Segarkan data
        </button>
      </div>

      {/* Apa yang dipaparkan di halaman ini */}
      <div className="rounded-2xl border border-slate-600/80 bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/15 text-blue-300 shrink-0">
            <Info size={20} />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Apa yang anda bentangkan di sini?</h2>
            <ul className="mt-2 space-y-2 text-sm text-slate-300 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold shrink-0">1.</span>
                <span>
                  <strong className="text-white">Senarai permintaan</strong> — siapa di cawangan mana, bila minta, dan{' '}
                  <strong className="text-white">sebab</strong> mereka perlukan edit stok (contoh: pembetulan key-in).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold shrink-0">2.</span>
                <span>
                  <strong className="text-white">Tindakan anda:</strong> lulus dengan tempoh (minit) atau tolak; atau semasa sesi aktif,{' '}
                  <strong className="text-white">tarik balik</strong> jika perlu henti awal.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold shrink-0">3.</span>
                <span>
                  <strong className="text-white">Bukti ubahan:</strong> butang <strong className="text-emerald-300">Lihat ubahan stok</strong>{' '}
                  membuka jadual — produk mana, stok lama → baharu, sebab setiap kali ubah. Pautan ke{' '}
                  <Link href="/admin/audit-center" className="text-blue-400 hover:underline">
                    Pusat Audit
                  </Link>{' '}
                  untuk rekod penuh sistem.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Aliran ringkas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        {[
          { step: '1', label: 'Admin cawangan', sub: 'Minta akses di Produk', icon: Inbox },
          { step: '2', label: 'Anda (HQ)', sub: 'Lulus / tolak tempoh', icon: ShieldCheck },
          { step: '3', label: 'Cawangan', sub: 'Edit stok dalam masa', icon: Zap },
          { step: '4', label: 'Semakan', sub: 'Lihat ubahan / Audit', icon: ClipboardList },
        ].map(({ step, label, sub, icon: Icon }) => (
          <div
            key={step}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2.5"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-300 font-bold text-[11px]">
              {step}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-white font-medium">
                <Icon size={12} className="text-slate-400 shrink-0" />
                {label}
              </div>
              <p className="text-slate-500 truncate">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700">
        {(
          [
            { id: 'pending' as const, label: 'Menunggu', icon: Inbox, count: pending.length },
            { id: 'active' as const, label: 'Aktif', icon: Zap, count: active.length },
            { id: 'history' as const, label: 'Sejarah', icon: Archive, count: null },
          ]
        ).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={16} className={tab === id ? 'text-emerald-400' : ''} />
            {label}
            {count !== null && count > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 flex gap-3">
        <ChevronRight className="text-emerald-500 shrink-0 mt-0.5" size={18} />
        <div>
          <p className="text-white text-sm font-medium">{tabHints[tab].title}</p>
          <p className="text-slate-400 text-sm mt-1 leading-relaxed">{tabHints[tab].body}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Memuatkan...</p>
      ) : tab === 'pending' ? (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Senarai permintaan — pilih tempoh lalu Lulus atau Tolak</h3>
          {pending.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/30 px-4 py-8 text-center">
              <Inbox className="mx-auto text-slate-600 mb-2" size={32} />
              <p className="text-slate-400 text-sm">Tiada permintaan menunggu.</p>
              <p className="text-slate-600 text-xs mt-2">Apabila Admin cawangan hantar permintaan dari halaman Produk, ia akan muncul di sini.</p>
            </div>
          ) : (
            pending.map((g) => (
              <div
                key={g.id}
                className="rounded-xl border border-amber-900/40 bg-slate-900/80 p-4 space-y-3 text-sm text-slate-200"
              >
                <div className="flex flex-wrap justify-between gap-2 items-start">
                  <div>
                    <span className="inline-block text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 mb-1">
                      Permintaan kelulusan
                    </span>
                    <p className="font-semibold text-white">{g.requester_name || g.requester_id}</p>
                    <p className="text-xs text-slate-400">{g.requester_branch || '—'} · Diminta {fmt(g.requested_at)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 mb-1">Sebab staf (kenapa perlu edit stok)</p>
                  <p className="text-slate-300 whitespace-pre-wrap rounded-lg bg-slate-950/50 p-3 border border-slate-700/50">{g.reason_request}</p>
                </div>
                <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-slate-700/50">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400">Tempoh jika lulus (minit)</label>
                    <select
                      value={durationById[g.id] ?? g.requested_duration_minutes ?? g.duration_minutes ?? 15}
                      onChange={(e) =>
                        setDurationById((prev) => ({ ...prev, [g.id]: Number(e.target.value) }))
                      }
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white"
                    >
                      {[10, 15, 20, 30, 45, 60].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    placeholder="Catatan lulus (pilihan)"
                    value={approveNotesById[g.id] || ''}
                    onChange={(e) =>
                      setApproveNotesById((prev) => ({ ...prev, [g.id]: e.target.value }))
                    }
                    className="flex-1 min-w-[160px] bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
                  />
                  <button
                    type="button"
                    disabled={busyId === g.id}
                    title="Benarkan staf edit stok freezer untuk tempoh yang dipilih"
                    onClick={() => approve(g)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
                  >
                    Lulus sesi
                  </button>
                  <button
                    type="button"
                    disabled={busyId === g.id}
                    title="Permintaan ditolak — staf tidak dapat edit melalui sesi ini"
                    onClick={() => deny(g)}
                    className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white font-medium disabled:opacity-50"
                  >
                    Tolak permintaan
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : tab === 'active' ? (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sesi yang dibenarkan sekarang</h3>
          {active.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/30 px-4 py-8 text-center">
              <Zap className="mx-auto text-slate-600 mb-2" size={32} />
              <p className="text-slate-400 text-sm">Tiada sesi aktif pada masa ini.</p>
              <p className="text-slate-600 text-xs mt-2">Selepas anda meluluskan permintaan, sesi akan dipaparkan di sini dengan kiraan mundur.</p>
            </div>
          ) : (
            active.map((g) => {
              const sec = secondsLeft(g.expires_at);
              const mm = Math.floor(sec / 60);
              const ss = sec % 60;
              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-4 flex flex-wrap justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-white">{g.requester_name || g.requester_id}</p>
                    <p className="text-xs text-slate-400">{g.requester_branch}</p>
                    <p className="text-emerald-300 mt-2">
                      Baki: {mm}:{String(ss).padStart(2, '0')} · Ubahan: {g.change_count ?? 0}/50
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 self-start">
                    <button
                      type="button"
                      title="Jadual produk yang sudah diubah dalam sesi ini (dari audit)"
                      onClick={() => openChangesModal(g)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-emerald-700/40 text-emerald-200 text-xs font-medium"
                    >
                      <ClipboardList size={14} /> Lihat ubahan stok
                    </button>
                    <button
                      type="button"
                      disabled={busyId === g.id}
                      title="Hentikan sesi lebih awal — staf tidak boleh edit stok lagi"
                      onClick={() => revoke(g)}
                      className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-medium disabled:opacity-50"
                    >
                      Tarik balik lulusan
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Log sesi lepas — semak status dan bukti ubahan</h3>
          {historyItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/30 px-4 py-8 text-center">
              <Archive className="mx-auto text-slate-600 mb-2" size={32} />
              <p className="text-slate-400 text-sm">Tiada rekod sejarah.</p>
            </div>
          ) : (
            historyItems.map((g) => (
              <div
                key={g.id}
                className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300 flex flex-wrap justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="inline-block text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-slate-700 text-slate-300 mb-1">
                    {statusLabel(g.status)}
                  </span>
                  <div className="mt-1">
                    <span className="text-white font-medium">{g.requester_name}</span>{' '}
                    <span className="text-xs text-slate-500">({g.requester_branch})</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Diminta {fmt(g.requested_at)}
                    {g.expires_at ? ` · sesi tamat ${fmt(g.expires_at)}` : ''}
                  </p>
                  {g.reason_request && (
                    <p className="text-xs mt-2 text-slate-400 line-clamp-2 border-l-2 border-slate-600 pl-2">{g.reason_request}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 text-xs text-slate-400 shrink-0">
                  <div className="text-right leading-snug">
                    <span className="text-slate-500">Bilangan kali stok diubah:</span>
                    <br />
                    <span className="text-white font-semibold text-base">{g.change_count ?? 0}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openChangesModal(g)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200"
                  >
                    <ClipboardList size={12} /> Lihat ubahan stok
                  </button>
                  <Link
                    href={`/admin/audit-center?referenceNo=${encodeURIComponent(g.id)}&module=inventory&action=stock_adjust`}
                    className="text-blue-400 hover:underline text-[11px]"
                  >
                    Buka di Pusat Audit
                  </Link>
                </div>
              </div>
            ))
          )}
          {historyTotalPages > 1 && (
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded bg-slate-700 text-white text-sm disabled:opacity-40"
              >
                Sebelum
              </button>
              <span className="text-slate-400 text-sm py-1">
                Halaman {historyPage} / {historyTotalPages}
              </span>
              <button
                type="button"
                disabled={historyPage >= historyTotalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
                className="px-3 py-1 rounded bg-slate-700 text-white text-sm disabled:opacity-40"
              >
                Seterusnya
              </button>
            </div>
          )}
        </div>
      )}

      {changesModalGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-600 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-700">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ClipboardList size={18} className="text-emerald-400" />
                  Bukti ubahan stok (audit)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Setiap baris = satu kali Admin cawangan simpan stok baharu. {changesModalGrant.requester_name} ·{' '}
                  {changesModalGrant.requester_branch} · Rujukan sesi{' '}
                  <code className="text-slate-300">{changesModalGrant.id.slice(0, 8)}…</code>
                </p>
                <p className="text-xs text-slate-500 mt-2 border-l-2 border-emerald-600/50 pl-2">
                  Lajur: masa simpan, nama produk, bacaan stok sebelum/selepas ubah, dan sebab yang ditulis staf.
                </p>
              </div>
              <button
                type="button"
                onClick={closeChangesModal}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {changesLoading ? (
                <p className="text-slate-400 text-sm">Memuatkan rekod audit…</p>
              ) : changesEvents.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  Tiada rekod penyesuaian stok (<code className="text-slate-400">stock_adjust</code>) untuk sesi ini —
                  mungkin tiada ubahan atau sesi belum digunakan untuk edit.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-slate-300 text-xs uppercase">
                      <tr>
                        <th className="px-3 py-2">Masa</th>
                        <th className="px-3 py-2">Produk</th>
                        <th className="px-3 py-2">Stok lama</th>
                        <th className="px-3 py-2">Stok baharu</th>
                        <th className="px-3 py-2">Sebab</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700 text-slate-200">
                      {changesEvents.map((ev) => {
                        const ch =
                          ev.audit_event_changes?.find((c) => c.field_name === 'current_stock') ||
                          ev.audit_event_changes?.[0];
                        const name =
                          (ev.metadata?.product_name as string | undefined) ||
                          ev.entity_id ||
                          '—';
                        return (
                          <tr key={ev.id} className="bg-slate-900/50">
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-400">
                              {fmt(ev.created_at)}
                            </td>
                            <td className="px-3 py-2 font-medium text-white">{name}</td>
                            <td className="px-3 py-2">{formatAuditVal(ch?.old_value)}</td>
                            <td className="px-3 py-2 text-emerald-300">{formatAuditVal(ch?.new_value)}</td>
                            <td className="px-3 py-2 text-xs text-slate-400 max-w-[200px]">
                              {ev.reason || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-700 flex flex-wrap gap-2 justify-end">
              <Link
                href={`/admin/audit-center?referenceNo=${encodeURIComponent(changesModalGrant.id)}&module=inventory&action=stock_adjust`}
                className="text-sm px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-600"
                onClick={closeChangesModal}
              >
                Buka semua rekod di Pusat Audit
              </Link>
              <button
                type="button"
                onClick={closeChangesModal}
                className="text-sm px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
