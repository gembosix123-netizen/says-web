'use client';

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Shield,
  Search,
  ClipboardCheck,
  Package,
  ShoppingCart,
  ClipboardList,
  Users,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';

type AuditChange = {
  id: string;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
};

type AuditEvent = {
  id: string;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  actor_role: string | null;
  branch: string | null;
  status: 'success' | 'failed' | 'denied';
  reason: string | null;
  reference_no: string | null;
  created_at: string;
  audit_event_changes?: AuditChange[];
};

/** Nama paparan BM untuk kod modul teknikal */
const MODULE_LABEL_MS: Record<string, string> = {
  inventory: 'Inventori & stok',
  van_inventory: 'Van / muatan',
  sales: 'Jualan',
  orders: 'Pesanan',
  user_management: 'Pengguna & akses',
  invoices: 'Invois',
  exchange_returns: 'Tukar & pulangan',
  expenses: 'Perbelanjaan',
  day_end: 'Tutup hari',
  reports: 'Laporan',
  backdated_import: 'Import data lama',
};

/** Nama paparan BM untuk kod tindakan teknikal */
const ACTION_LABEL_MS: Record<string, string> = {
  stock_adjust: 'Penyesuaian stok',
  stock_grant_requested: 'Mohon sesi edit stok',
  stock_grant_approved: 'Lulus sesi edit stok',
  stock_grant_denied: 'Tolak permintaan',
  stock_grant_revoked: 'Tarik balik sesi',
  stock_grant_finished_by_requester: 'Tamat sesi (staf)',
};

const STATUS_LABEL_MS: Record<string, string> = {
  success: 'Berjaya',
  failed: 'Gagal',
  denied: 'Ditolak sistem',
};

function labelModule(code: string) {
  return MODULE_LABEL_MS[code] || code;
}

function labelAction(code: string) {
  return ACTION_LABEL_MS[code] || code;
}

function labelStatus(code: string) {
  return STATUS_LABEL_MS[code] || code;
}

function formatChangeVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

type QuickPreset = {
  id: string;
  title: string;
  subtitle: string;
  module: string;
  action: string;
  icon: typeof Package;
  accent: string;
};

const QUICK_PRESETS: QuickPreset[] = [
  {
    id: 'all',
    title: 'Semua rekod',
    subtitle: 'Tiada penapis — semua jenis log',
    module: '',
    action: '',
    icon: LayoutGrid,
    accent: 'border-slate-600 bg-slate-800/80 hover:bg-slate-800',
  },
  {
    id: 'stock_adjust',
    title: 'Ubah nombor stok',
    subtitle: 'Siapa ubah stok freezer & berapa',
    module: 'inventory',
    action: 'stock_adjust',
    icon: Package,
    accent: 'border-emerald-700/60 bg-emerald-950/30 hover:bg-emerald-950/50',
  },
  {
    id: 'inventory_all',
    title: 'Semua inventori',
    subtitle: 'Stok + lulusan sesi + lain (modul inventori)',
    module: 'inventory',
    action: '',
    icon: ClipboardList,
    accent: 'border-cyan-700/50 bg-cyan-950/20 hover:bg-cyan-950/35',
  },
  {
    id: 'sales',
    title: 'Jualan',
    subtitle: 'Peristiwa berkaitan jualan',
    module: 'sales',
    action: '',
    icon: ShoppingCart,
    accent: 'border-orange-700/50 bg-orange-950/25 hover:bg-orange-950/40',
  },
  {
    id: 'orders',
    title: 'Pesanan',
    subtitle: 'Perubahan pesanan',
    module: 'orders',
    action: '',
    icon: ClipboardCheck,
    accent: 'border-violet-700/50 bg-violet-950/25 hover:bg-violet-950/40',
  },
  {
    id: 'users',
    title: 'Pengguna',
    subtitle: 'Tambah / ubah akaun staf',
    module: 'user_management',
    action: '',
    icon: Users,
    accent: 'border-pink-700/50 bg-pink-950/20 hover:bg-pink-950/35',
  },
];

function AuditCenterPageInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [referenceNoFilter, setReferenceNoFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activePreset, setActivePreset] = useState<string>('all');
  /** Memaksa muat semula API bila masih di halaman 1 (setPage(1) tidak picu semula) */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ref = searchParams.get('referenceNo');
    const mod = searchParams.get('module');
    const act = searchParams.get('action');
    let dirty = false;
    if (ref) {
      setReferenceNoFilter(ref);
      dirty = true;
    }
    if (mod) {
      setModuleFilter(mod);
      dirty = true;
    }
    if (act) {
      setActionFilter(act);
      dirty = true;
    }
    if (dirty) {
      setPage(1);
      setActivePreset('custom');
    }
  }, [pathname, searchParams.toString()]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (moduleFilter) params.set('module', moduleFilter);
    if (actionFilter) params.set('action', actionFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (referenceNoFilter) params.set('referenceNo', referenceNoFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params;
  }, [actionFilter, endDate, moduleFilter, page, pageSize, referenceNoFilter, startDate, statusFilter]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const response = await fetch(`/api/audit/events?${params.toString()}`);
      if (!response.ok) {
        setItems([]);
        setTotal(0);
        setTotalPages(0);
        return;
      }
      const data = (await response.json()) as {
        items?: AuditEvent[];
        total?: number;
        totalPages?: number;
      };
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents, reloadKey]);

  const moduleOptions = useMemo(() => {
    const set = new Set(items.map((item) => item.module));
    return Array.from(set).sort();
  }, [items]);

  const actionOptions = useMemo(() => {
    const set = new Set(items.map((item) => item.action));
    return Array.from(set).sort();
  }, [items]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = buildParams();
      params.delete('page');
      params.delete('pageSize');
      params.set('maxRows', '10000');
      const response = await fetch(`/api/audit/export?${params.toString()}`);
      if (!response.ok) return;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `audit_export_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const applyQuickPreset = (p: QuickPreset) => {
    setModuleFilter(p.module);
    setActionFilter(p.action);
    setStatusFilter('');
    setReferenceNoFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setActivePreset(p.id);
  };

  const resetAllFilters = () => {
    setModuleFilter('');
    setActionFilter('');
    setStatusFilter('');
    setReferenceNoFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setActivePreset('all');
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 lg:px-6 space-y-8 pb-16">
      {/* Tajuk utama — satu mesej sahaja */}
      <header className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-indigo-600/20 text-indigo-300 shrink-0">
            <Shield size={28} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400/90 mb-1">
              Main Admin · Jejak sistem
            </p>
            <h1 className="text-2xl lg:text-3xl font-bold text-white leading-tight">Pusat Audit</h1>
            <p className="text-slate-300 mt-3 text-base leading-relaxed max-w-2xl">
              Halaman ini menunjukkan <strong className="text-white">log aktiviti</strong> — iaitu rekod
              &quot;siapa melakukan apa, bila&quot; dalam aplikasi (contoh: ubah stok, kemas kini pesanan, urus pengguna).
              Gunakan untuk <strong className="text-white">semakan, bukti, atau siasat</strong> —{' '}
              <span className="text-slate-500">bukan tempat untuk kerja gudang harian</span> (itu di menu Produk / Van).
            </p>
          </div>
        </div>

        {/* 3 ikon ringkas: apakah boleh buat */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 flex gap-3">
            <Search className="text-sky-400 shrink-0" size={22} />
            <div>
              <p className="text-white font-medium text-sm">Cari & tapis</p>
              <p className="text-slate-500 text-xs mt-1 leading-snug">
                Pilih jenis aktiviti di bawah, atau buka penapis lanjutan untuk tarikh &amp; no. rujukan.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 flex gap-3">
            <ClipboardCheck className="text-emerald-400 shrink-0" size={22} />
            <div>
              <p className="text-white font-medium text-sm">Baca keputusan</p>
              <p className="text-slate-500 text-xs mt-1 leading-snug">
                Jadual tunjuk masa, orang, dan apa yang berlaku. Klik baris untuk lihat butiran lama→baharu jika ada.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 flex gap-3">
            <Download className="text-amber-400 shrink-0" size={22} />
            <div>
              <p className="text-white font-medium text-sm">Eksport</p>
              <p className="text-slate-500 text-xs mt-1 leading-snug">
                Muat turun CSV mengikut penapis semasa — untuk simpan fail atau laporan.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Pintasan: pilih apa nak tengok */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <Info size={16} className="text-slate-400" />
          Langkah 1 — Pilih apa yang nak dipaparkan
        </div>
        <p className="text-slate-500 text-sm -mt-1">
          Klik satu kad. Yang dipilih akan <span className="text-slate-300">bergaris cerah</span>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_PRESETS.map((p) => {
            const Icon = p.icon;
            const selected = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyQuickPreset(p)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${p.accent} ${
                  selected ? 'ring-2 ring-indigo-500 border-indigo-500/80' : 'border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon size={22} className="text-white/90 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-sm">{p.title}</p>
                    <p className="text-slate-400 text-xs mt-1 leading-snug">{p.subtitle}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetAllFilters}
            className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Kosongkan penapis &amp; tunjuk semua
          </button>
        </div>
      </section>

      {/* Penapis lanjutan */}
      <section className="rounded-2xl border border-slate-700 bg-slate-900/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left text-white font-medium text-sm bg-slate-800/50 hover:bg-slate-800/80"
        >
          <span className="flex items-center gap-2">
            Langkah 2 — Penapis lanjutan (pilihan)
            <span className="text-slate-500 font-normal text-xs">tarikh, status, no. rujukan, kod teknikal</span>
          </span>
          {advancedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {advancedOpen && (
          <div className="p-4 space-y-4 border-t border-slate-700">
            <p className="text-slate-500 text-xs">
              Gunakan jika pintasan di atas tidak cukup. Kod modul/tindakan dalam dropdown adalah nama teknikal dalam
              sistem — lajur jadual di bawah akan tunjuk nama mudah.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">Modul (teknikal)</label>
                <select
                  value={moduleFilter}
                  onChange={(e) => {
                    setModuleFilter(e.target.value);
                    setActivePreset('custom');
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 text-white border border-slate-600 rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="">— Semua modul —</option>
                  {Object.entries(MODULE_LABEL_MS).map(([code, ms]) => (
                    <option key={code} value={code}>
                      {ms} ({code})
                    </option>
                  ))}
                  {moduleOptions
                    .filter((m) => !MODULE_LABEL_MS[m])
                    .map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">Tindakan (teknikal)</label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setActivePreset('custom');
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 text-white border border-slate-600 rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="">— Semua tindakan —</option>
                  {Object.entries(ACTION_LABEL_MS).map(([code, ms]) => (
                    <option key={code} value={code}>
                      {ms} ({code})
                    </option>
                  ))}
                  {actionOptions
                    .filter((a) => !ACTION_LABEL_MS[a])
                    .map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setActivePreset('custom');
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 text-white border border-slate-600 rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="">— Semua —</option>
                  <option value="success">{labelStatus('success')}</option>
                  <option value="failed">{labelStatus('failed')}</option>
                  <option value="denied">{labelStatus('denied')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">No. rujukan</label>
                <input
                  type="text"
                  value={referenceNoFilter}
                  onChange={(e) => {
                    setReferenceNoFilter(e.target.value);
                    setActivePreset('custom');
                    setPage(1);
                  }}
                  placeholder="Contoh: ID sesi dari Lulusan Stok"
                  className="w-full bg-slate-950 text-white border border-slate-600 rounded-lg px-3 py-2.5 text-sm placeholder:text-slate-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">Tarikh mula</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset('custom');
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 text-white border border-slate-600 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">Tarikh akhir</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset('custom');
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 text-white border border-slate-600 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (page !== 1) setPage(1);
                  else setReloadKey((k) => k + 1);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
              >
                <Search size={16} />
                {page !== 1 ? 'Tuju halaman 1' : 'Muat semula senarai'}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium"
              >
                <Download size={16} /> {isExporting ? 'Menjana CSV…' : 'Eksport CSV (ikut penapis)'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Keputusan */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              Langkah 3 — Keputusan
            </p>
            <p className="text-slate-500 text-xs mt-1">
              Jumlah <strong className="text-slate-300">{total}</strong> rekod sepadan penapis.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-slate-400">Baris setiap halaman</label>
            <select
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value));
              }}
              className="bg-slate-800 text-white border border-slate-600 rounded-lg px-2 py-1.5"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/40 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="inline-block h-8 w-8 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin mb-3" />
              <p>Memuatkan rekod…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-300 font-medium">Tiada rekod</p>
              <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                Cuba pilih kad &quot;Semua rekod&quot; atau longgarkan penapis tarikh. Jika sistem baru digunakan, log
                mungkin masih sedikit.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-3 w-10" />
                    <th className="text-left px-3 py-3">Masa</th>
                    <th className="text-left px-3 py-3">Apa berlaku</th>
                    <th className="text-left px-3 py-3">Oleh siapa</th>
                    <th className="text-left px-3 py-3">Cawangan</th>
                    <th className="text-left px-3 py-3">Status</th>
                    <th className="text-left px-3 py-3 max-w-[200px]">Nota / sebab</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((event) => {
                    const hasDetail =
                      (event.audit_event_changes && event.audit_event_changes.length > 0) ||
                      (event.reason && event.reason.length > 0);
                    const expanded = expandedIds.has(event.id);
                    return (
                      <Fragment key={event.id}>
                        <tr className="border-t border-slate-800 text-slate-200 hover:bg-slate-900/80">
                          <td className="px-3 py-3 align-top">
                            {hasDetail ? (
                              <button
                                type="button"
                                onClick={() => toggleExpand(event.id)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400"
                                title={expanded ? 'Sembunyi butiran' : 'Tunjuk butiran'}
                              >
                                {expanded ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            ) : (
                              <span className="inline-block w-6" />
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap align-top text-xs text-slate-400">
                            {new Date(event.created_at).toLocaleString()}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <p className="text-white font-medium">{labelAction(event.action)}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{labelModule(event.module)}</p>
                            {(event.entity_type || event.entity_id) && (
                              <p className="text-[11px] text-slate-600 mt-1 font-mono truncate max-w-[240px]">
                                {event.entity_type || ''}
                                {event.entity_id ? ` · ${event.entity_id}` : ''}
                              </p>
                            )}
                            {event.reference_no && (
                              <p className="text-[11px] text-indigo-400/90 mt-1">Rujukan: {event.reference_no}</p>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top text-slate-300">
                            {event.actor_name || event.actor_username || '—'}
                            {event.actor_role && (
                              <span className="block text-[11px] text-slate-500">{event.actor_role}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top text-slate-400">{event.branch || '—'}</td>
                          <td className="px-3 py-3 align-top">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs ${
                                event.status === 'success'
                                  ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-800'
                                  : event.status === 'failed'
                                    ? 'bg-amber-900/50 text-amber-200 border border-amber-800'
                                    : 'bg-red-900/50 text-red-300 border border-red-800'
                              }`}
                            >
                              {labelStatus(event.status)}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top text-slate-400 text-xs max-w-[220px] break-words">
                            {event.reason || '—'}
                          </td>
                        </tr>
                        {expanded && hasDetail && (
                          <tr className="bg-slate-900/90 border-t border-slate-800">
                            <td colSpan={7} className="px-4 py-4">
                              {event.audit_event_changes && event.audit_event_changes.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-slate-700">
                                  <table className="min-w-full text-xs">
                                    <thead>
                                      <tr className="text-slate-500 text-left">
                                        <th className="px-2 py-1">Medan</th>
                                        <th className="px-2 py-1">Nilai lama</th>
                                        <th className="px-2 py-1">Nilai baharu</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {event.audit_event_changes.map((c) => (
                                        <tr key={c.id} className="border-t border-slate-800 text-slate-300">
                                          <td className="px-2 py-1.5 font-mono">{c.field_name}</td>
                                          <td className="px-2 py-1.5">{formatChangeVal(c.old_value)}</td>
                                          <td className="px-2 py-1.5 text-emerald-300">{formatChangeVal(c.new_value)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-slate-500 text-xs">Tiada medan perubahan tersimpan untuk rekod ini.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setPage((old) => Math.max(old - 1, 1))}
            disabled={page <= 1 || loading}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white border border-slate-600 disabled:opacity-40 text-sm"
          >
            ← Halaman sebelum
          </button>
          <p className="text-slate-400 text-sm">
            Halaman <span className="text-white font-medium">{page}</span> /{' '}
            <span className="text-white font-medium">{Math.max(totalPages, 1)}</span>
          </p>
          <button
            type="button"
            onClick={() => setPage((old) => (totalPages > 0 ? Math.min(old + 1, totalPages) : old + 1))}
            disabled={loading || (totalPages > 0 && page >= totalPages)}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white border border-slate-600 disabled:opacity-40 text-sm"
          >
            Halaman seterusnya →
          </button>
        </div>
      </section>
    </div>
  );
}

export default function AuditCenterPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto p-12 text-center text-slate-400">
          <div className="inline-block h-8 w-8 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin mb-3" />
          <p>Memuatkan Pusat Audit…</p>
        </div>
      }
    >
      <AuditCenterPageInner />
    </Suspense>
  );
}
