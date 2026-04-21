'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Policy = {
  id: string;
  status: 'draft' | 'active' | 'archived';
  branch: string;
  cashCommissionRate: number;
  creditCommissionRate: number;
  effectiveFrom: string;
  notes?: string;
};

type DailyReport = {
  id: string;
  userName: string;
  branch: string;
  date: string;
  totalSales: number;
  totalCash: number;
  totalCredit: number;
  status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'returned';
  reviewNotes?: string;
};

export default function WorkflowControlPanel() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [currentRole, setCurrentRole] = useState('');
  const [currentBranch, setCurrentBranch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    effectiveFrom: new Date().toISOString().split('T')[0],
    branch: 'Kota Kinabalu',
    cashCommissionRate: '4',
    creditCommissionRate: '0.4',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [meRes, policyRes, reportRes] = await Promise.all([
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/commission-settings', { cache: 'no-store' }),
        fetch('/api/daily-reports', { cache: 'no-store' }),
      ]);
      const meData = await meRes.json().catch(() => ({}));
      const policyData = await policyRes.json().catch(() => ({ policies: [] }));
      const reportData = await reportRes.json().catch(() => ({ reports: [] }));
      const apiRole = String(meData.role || '').trim();
      const apiBranch = String(meData.branch || '').trim();
      let localRole = '';
      let localBranch = '';
      try {
        const rawUser = localStorage.getItem('user');
        if (rawUser) {
          const parsed = JSON.parse(rawUser);
          localRole = String(parsed?.role || '').trim();
          localBranch = String(parsed?.branch || '').trim();
        }
      } catch {
        // ignore localStorage parse errors
      }
      setCurrentRole(apiRole || localRole);
      setCurrentBranch(apiBranch || localBranch);
      setPolicies(Array.isArray(policyData.policies) ? policyData.policies : []);
      setReports(Array.isArray(reportData.reports) ? reportData.reports : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const summary = useMemo(() => {
    return {
      total: reports.length,
      submitted: reports.filter((item) => item.status === 'submitted').length,
      approved: reports.filter((item) => item.status === 'approved').length,
      returned: reports.filter((item) => item.status === 'returned').length,
    };
  }, [reports]);

  const normalizedRole = currentRole.trim().toLowerCase();
  const canManagePolicies = normalizedRole === 'main admin';

  const handleCreatePolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPolicy(true);
    try {
      const payload = {
        effectiveFrom: policyForm.effectiveFrom,
        branch: policyForm.branch,
        status: 'active',
        cashCommissionRate: Number(policyForm.cashCommissionRate) / 100,
        creditCommissionRate: Number(policyForm.creditCommissionRate) / 100,
        marginCommissionEnabled: true,
        marginCommissionPerUnit: 0.5,
        kpiTiers: [
          { minSales: 10000, maxSales: 24999, payout: 200 },
          { minSales: 25000, maxSales: 49999, payout: 500 },
          { minSales: 50000, maxSales: 99999, payout: 1000 },
          { minSales: 100000, maxSales: 199999, payout: 2000 },
          { minSales: 200000, maxSales: null, payout: 4000 },
        ],
        notes: policyForm.notes,
      };

      await fetch('/api/commission-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchData();
    } finally {
      setSavingPolicy(false);
    }
  };

  const updateReportStatus = async (id: string, status: DailyReport['status']) => {
    await fetch('/api/daily-reports', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Reports" value={summary.total} />
        <StatCard label="Submitted" value={summary.submitted} />
        <StatCard label="Approved" value={summary.approved} />
        <StatCard label="Returned" value={summary.returned} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
          <h3 className="text-lg font-semibold text-white">Tetapan Komisen (Main Admin)</h3>
          <p className="mt-1 text-sm text-slate-400">
            Tetapkan kadar komisen aktif untuk cawangan. Simpan sekali, sistem guna automatik untuk kiraan seterusnya.
          </p>
          {canManagePolicies ? (
            <form onSubmit={handleCreatePolicy} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Cawangan
                  </label>
                  <select
                    value={policyForm.branch}
                    onChange={(e) => setPolicyForm((prev) => ({ ...prev, branch: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  >
                    <option value="Kota Kinabalu">Kota Kinabalu</option>
                    <option value="Kinabatangan">Kinabatangan</option>
                    <option value="all">Semua Cawangan</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Tarikh Kuat Kuasa
                  </label>
                  <input
                    type="date"
                    value={policyForm.effectiveFrom}
                    onChange={(e) => setPolicyForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Komisen Tunai (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={policyForm.cashCommissionRate}
                    onChange={(e) => setPolicyForm((prev) => ({ ...prev, cashCommissionRate: e.target.value }))}
                    placeholder="Contoh: 4"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500">Contoh 4 = 4%</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Komisen Kredit (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={policyForm.creditCommissionRate}
                    onChange={(e) => setPolicyForm((prev) => ({ ...prev, creditCommissionRate: e.target.value }))}
                    placeholder="Contoh: 0.4"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500">Contoh 0.4 = 0.4%</p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Nota / Sebab Perubahan
                </label>
                <textarea
                  value={policyForm.notes}
                  onChange={(e) => setPolicyForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Contoh: Kemaskini kadar ikut harga semasa pasaran."
                  className="min-h-20 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Kadar ini akan jadi polisi aktif selepas disimpan.</p>
                <button
                  disabled={savingPolicy}
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingPolicy ? 'Menyimpan...' : 'Simpan Polisi Aktif'}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
              Read-only view. Hanya Main Admin HQ boleh ubah commission settings.
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Active / Recent Policies</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {loading ? (
              <p className="text-slate-400 text-sm">Loading...</p>
            ) : policies.length === 0 ? (
              <p className="text-slate-400 text-sm">No policy configured yet.</p>
            ) : (
              policies
                .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())
                .slice(0, 8)
                .map((policy) => (
                  <div key={policy.id} className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white font-medium">{policy.branch}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${policy.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                        {policy.status}
                      </span>
                    </div>
                    <p className="text-slate-300 mt-1">
                      Cash {(policy.cashCommissionRate * 100).toFixed(2)}% | Credit {(policy.creditCommissionRate * 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-slate-400">Effective: {policy.effectiveFrom}</p>
                  </div>
                ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
        <p className="text-xs text-slate-400">
          Nota: Semakan laporan harian/mingguan kini berada di halaman <span className="text-white font-semibold">Reports</span> untuk aliran kerja yang lebih kemas.
        </p>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
