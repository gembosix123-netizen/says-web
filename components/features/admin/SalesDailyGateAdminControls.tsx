'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { normalizeRole } from '@/lib/roles';

type GatePayload = {
  reason: string;
  dateYmd: string;
  dateLabelMs: string;
  dateLabelEn: string;
  titleMs: string;
  titleEn: string;
  bodyMs: string;
  bodyEn: string;
};

export type AdminSalesGatePayload = {
  lookup: string;
  coreBlocked: boolean;
  effectiveBlocked: boolean;
  bypassActive: boolean;
  bypassScopeDate: string | null;
  gate?: GatePayload;
};

function formatScopeYmd(ymd: string): { ms: string; en: string } {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) {
    return { ms: ymd, en: ymd };
  }
  const local = new Date(y, m - 1, d);
  return {
    ms: local.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }),
    en: local.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

type Props = {
  user: { id: string; name: string; role: string };
  isMainAdmin: boolean;
  onUpdated: () => Promise<void> | void;
};

export default function SalesDailyGateAdminControls({ user, isMainAdmin, onUpdated }: Props) {
  const [data, setData] = useState<AdminSalesGatePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [modal, setModal] = useState<'grant' | 'revoke' | null>(null);
  const [saving, setSaving] = useState(false);

  const isSalesUser = normalizeRole(user.role) === 'Sales';

  const load = useCallback(async () => {
    if (!isMainAdmin || !isSalesUser) {
      setLoading(false);
      setData(null);
      setFetchErr(null);
      return;
    }
    const uid = String(user.id || '').trim();
    if (!uid) {
      setLoading(false);
      setFetchErr('ID pengguna tiada pada kad ini — muat semula senarai pengguna. / User id is missing on this card.');
      setData(null);
      return;
    }
    setLoading(true);
    setFetchErr(null);
    try {
      const res = await fetch(
        `/api/sales/new-sale-eligibility?userId=${encodeURIComponent(uid)}`,
        { credentials: 'same-origin', cache: 'no-store' }
      );
      const json = (await res.json().catch(() => ({}))) as AdminSalesGatePayload & { error?: string };
      if (!res.ok) {
        setFetchErr(typeof json.error === 'string' ? json.error : 'Gagal memuatkan status');
        setData(null);
        return;
      }
      if (json.lookup !== 'admin_sales_gate' || typeof json.coreBlocked !== 'boolean') {
        setFetchErr(
          'Respons API tidak dijangka. Cuba muat semula halaman. / Unexpected API response — try refreshing the page.'
        );
        setData(null);
        return;
      }
      setData(json as AdminSalesGatePayload);
    } finally {
      setLoading(false);
    }
  }, [isMainAdmin, isSalesUser, user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const putBypass = async (next: boolean) => {
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: user.id, bypassSalesDailyGate: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof json.error === 'string' ? json.error : 'Gagal kemas kini');
        return;
      }
      setModal(null);
      await onUpdated();
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (!isMainAdmin || !isSalesUser) return null;

  if (loading) {
    return (
      <div className="mb-3 rounded-lg border border-slate-600/40 bg-slate-800/30 px-3 py-2 text-[11px] text-slate-400">
        Memuatkan status sekatan jualan… / Loading sales gate status…
      </div>
    );
  }

  if (fetchErr) {
    return (
      <div className="mb-3 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-[11px] text-red-200/90">
        {fetchErr}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const showPanel = data.coreBlocked || data.bypassActive;
  if (!showPanel) {
    return null;
  }

  const gate = data.gate;
  const scopeMs =
    data.bypassScopeDate != null ? formatScopeYmd(data.bypassScopeDate).ms : null;
  const scopeEn =
    data.bypassScopeDate != null ? formatScopeYmd(data.bypassScopeDate).en : null;

  const needsGrantAction = data.effectiveBlocked && Boolean(gate);
  const mismatchNote =
    data.bypassActive && data.effectiveBlocked && data.coreBlocked
      ? 'Pengecualian HQ yang sedia ada tidak merangkumi tertunggak semasa (tarikh / skop tidak sepadan). HQ boleh benarkan pengecualian baharu selepas semak. / The current HQ exception does not cover the active backlog (date scope mismatch).'
      : null;

  return (
    <>
      <div className="mb-3 space-y-2 rounded-lg border border-amber-500/25 bg-amber-950/15 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 shrink-0 text-amber-400" size={16} aria-hidden />
          <div className="min-w-0 text-[11px] leading-snug text-amber-100/85">
            {data.effectiveBlocked ? (
              <p className="font-semibold text-amber-100">Sistem menahan jualan baharu untuk akaun ini</p>
            ) : data.bypassActive ? (
              <p className="font-semibold text-amber-100">Pengecualian HQ sedang aktif — jurujual boleh merekod jualan baharu</p>
            ) : (
              <p className="font-semibold text-amber-100">Status gate laporan harian</p>
            )}
            {data.bypassActive && data.bypassScopeDate ? (
              <p className="mt-1 text-amber-100/70">
                Skop pengecualian: {scopeMs} · Exception scope: {scopeEn}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {needsGrantAction ? (
            <button
              type="button"
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              onClick={() => setModal('grant')}
            >
              Lihat sebab &amp; benarkan pengecualian
            </button>
          ) : null}
          {data.bypassActive ? (
            <button
              type="button"
              className="rounded-lg border border-amber-500/50 bg-transparent px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-950/40 disabled:opacity-50"
              onClick={() => setModal('revoke')}
              disabled={saving}
            >
              Batalkan pengecualian HQ
            </button>
          ) : null}
        </div>
      </div>

      {modal === 'grant' && gate ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gate-modal-title"
          onClick={() => !saving && setModal(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={22} aria-hidden />
              <div>
                <h3 id="gate-modal-title" className="text-base font-bold text-white">
                  {gate.titleMs}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">{gate.titleEn}</p>
              </div>
            </div>
            <p className="text-sm text-slate-200">{gate.bodyMs}</p>
            <p className="mt-2 text-xs text-slate-400">{gate.bodyEn}</p>
            <p className="mt-3 rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-slate-300">
              <span className="font-semibold text-slate-200">Tarikh berkenaan:</span> {gate.dateLabelMs} ·{' '}
              {gate.dateLabelEn}{' '}
              <span className="text-slate-500">({gate.dateYmd})</span>
            </p>
            {mismatchNote ? (
              <p className="mt-3 text-xs leading-relaxed text-amber-200/90">{mismatchNote}</p>
            ) : null}
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Pengecualian ialah untuk episod tertunggak paling awal semasa anda mengesahkan; tertunggak lain
              memerlukan tindakan berasingan. / The exception applies to the oldest pending episode at the time you
              confirm; other gaps need separate action.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                onClick={() => setModal(null)}
                disabled={saving}
              >
                Tidak — tutup
              </button>
              <button
                type="button"
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                onClick={() => void putBypass(true)}
                disabled={saving}
              >
                Benarkan (HQ)
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'revoke' ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-modal-title"
          onClick={() => !saving && setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="revoke-modal-title" className="text-base font-bold text-white">
              Batalkan pengecualian HQ?
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Jurujual akan dikenakan semula sekatan jualan baharu jika laporan harian masih tertunggak. / Sales will
              be subject again to the new-sales gate if the daily report is still pending.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                onClick={() => setModal(null)}
                disabled={saving}
              >
                Tidak
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                onClick={() => void putBypass(false)}
                disabled={saving}
              >
                Ya, batalkan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
