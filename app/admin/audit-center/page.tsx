'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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

export default function AuditCenterPage() {
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [referenceNoFilter, setReferenceNoFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (moduleFilter) params.set('module', moduleFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (referenceNoFilter) params.set('referenceNo', referenceNoFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params;
  }, [endDate, moduleFilter, page, pageSize, referenceNoFilter, startDate, statusFilter]);

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

      const data = await response.json() as {
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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = buildParams();
      params.delete('page');
      params.delete('pageSize');
      params.set('maxRows', '10000');

      const response = await fetch(`/api/audit/export?${params.toString()}`);
      if (!response.ok) {
        return;
      }

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

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const moduleOptions = useMemo(() => {
    const set = new Set(items.map((item) => item.module));
    return Array.from(set).sort();
  }, [items]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Audit Center</h1>
        <p className="text-slate-400 mt-2">System-wide audit trail for sales, inventory, orders, users, and operational actions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3 bg-slate-900 p-4 rounded-xl border border-slate-700">
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="bg-slate-800 text-white border border-slate-700 rounded px-3 py-2"
        >
          <option value="">All modules</option>
          {moduleOptions.map((moduleName) => (
            <option key={moduleName} value={moduleName}>{moduleName}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-800 text-white border border-slate-700 rounded px-3 py-2"
        >
          <option value="">All status</option>
          <option value="success">success</option>
          <option value="failed">failed</option>
          <option value="denied">denied</option>
        </select>

        <input
          type="text"
          value={referenceNoFilter}
          onChange={(e) => setReferenceNoFilter(e.target.value)}
          placeholder="Reference No"
          className="bg-slate-800 text-white border border-slate-700 rounded px-3 py-2"
        />

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-slate-800 text-white border border-slate-700 rounded px-3 py-2"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-slate-800 text-white border border-slate-700 rounded px-3 py-2"
        />

        <button
          onClick={() => {
            setPage(1);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2"
        >
          Apply Filter
        </button>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded px-3 py-2"
        >
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
        <p className="text-slate-300">Total: {total} records</p>
        <div className="flex items-center gap-2">
          <label className="text-slate-400">Page size</label>
          <select
            value={pageSize}
            onChange={(event) => {
              setPage(1);
              setPageSize(Number(event.target.value));
            }}
            className="bg-slate-800 text-white border border-slate-700 rounded px-2 py-1"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-300">Loading audit events...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-slate-400">No audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">Module</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Actor</th>
                  <th className="text-left px-4 py-3">Entity</th>
                  <th className="text-left px-4 py-3">Branch</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Reference</th>
                  <th className="text-left px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map((event) => (
                  <tr key={event.id} className="border-t border-slate-800 text-slate-200 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(event.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">{event.module}</td>
                    <td className="px-4 py-3">{event.action}</td>
                    <td className="px-4 py-3">{event.actor_name || event.actor_username || '-'}</td>
                    <td className="px-4 py-3">{event.entity_type || '-'} {event.entity_id ? `(${event.entity_id})` : ''}</td>
                    <td className="px-4 py-3">{event.branch || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        event.status === 'success'
                          ? 'bg-green-900/40 text-green-300 border border-green-800'
                          : event.status === 'failed'
                            ? 'bg-amber-900/40 text-amber-300 border border-amber-800'
                            : 'bg-red-900/40 text-red-300 border border-red-800'
                      }`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{event.reference_no || '-'}</td>
                    <td className="px-4 py-3 max-w-[280px] break-words">{event.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((old) => Math.max(old - 1, 1))}
          disabled={page <= 1 || loading}
          className="px-3 py-2 rounded bg-slate-800 text-white border border-slate-700 disabled:opacity-50"
        >
          Previous
        </button>
        <p className="text-slate-300 text-sm">Page {page} / {Math.max(totalPages, 1)}</p>
        <button
          onClick={() => setPage((old) => (totalPages > 0 ? Math.min(old + 1, totalPages) : old + 1))}
          disabled={loading || (totalPages > 0 && page >= totalPages)}
          className="px-3 py-2 rounded bg-slate-800 text-white border border-slate-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
