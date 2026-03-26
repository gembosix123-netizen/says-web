'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, CheckCircle, XCircle, AlertTriangle, Download, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface CustomerRef {
  id: string;
  name: string;
  branch?: string;
}

interface ImportRow {
  month: string;
  branch: string;
  payment_method: string;
  amount: string | number;
  receipt_no?: string;
  billing_ref_no?: string;
  transfer_ref_no?: string;
  qr_txn_ref_no?: string;
  customer_name?: string;
  payment_note?: string;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  mode: string;
  valid: boolean;
  total: number;
  error_count?: number;
  errors?: RowError[];
  summary_by_method?: Record<string, number>;
  imported?: number;
  message?: string;
  error?: string;
}

function parseCsv(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row as unknown as ImportRow;
  });
}

export default function BackdatedImportPage() {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'validated' | 'done'>('upload');
  const [dragging, setDragging] = useState(false);
  const [customers, setCustomers] = useState<CustomerRef[]>([]);
  const [showCustomers, setShowCustomers] = useState(false);

  useEffect(() => {
    fetch('/api/admin/backdated-import')
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []))
      .catch(() => {});
  }, []);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setResult(null);
    setStep('upload');

    // Detect real file type via magic bytes — ignore extension name
    const sniff = new FileReader();
    sniff.onload = (sniffEv) => {
      const buf = sniffEv.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buf);
      // XLSX/ZIP magic: PK (0x50 0x4B)
      // XLS magic: D0 CF
      const isExcel =
        (bytes[0] === 0x50 && bytes[1] === 0x4b) ||
        (bytes[0] === 0xd0 && bytes[1] === 0xcf);

      if (isExcel) {
        // Parse as Excel
        import('xlsx').then((XLSX) => {
          const wb = XLSX.read(buf, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: '' });
          if (json.length === 0) {
            alert(t('backdated_import') + ': Excel empty / no data in first sheet.');
            return;
          }
          setRows(json);
        });
      } else {
        // Parse as CSV text
        const textReader = new FileReader();
        textReader.onload = (ev) => {
          const text = ev.target?.result as string;
          const parsed = parseCsv(text);
          if (parsed.length === 0) {
            alert('CSV file empty or invalid format.');
            return;
          }
          setRows(parsed);
        };
        textReader.readAsText(file, 'utf-8');
      }
    };
    sniff.readAsArrayBuffer(file.slice(0, 4));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDownloadTemplate = () => {
    const a = document.createElement('a');
    a.href = '/templates/backdated_import_template.xlsx';
    a.download = 'backdated_import_template.xlsx';
    a.click();
  };

  const callApi = async (mode: 'dry_run' | 'confirm') => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/backdated-import?mode=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data: ImportResult = await res.json();
      setResult(data);
      if (mode === 'dry_run' && data.valid) setStep('validated');
      if (mode === 'confirm' && data.valid) setStep('done');
    } catch {
      setResult({ mode, valid: false, total: rows.length, error: 'Connection error to server' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRows([]);
    setFileName('');
    setResult(null);
    setStep('upload');
    if (fileRef.current) fileRef.current.value = '';
  };

  const methodLabel: Record<string, string> = {
    cash: 'Tunai',
    bill_to_bill: 'Kredit (Bill-to-Bill)',
    bank_transfer: 'Bank Transfer',
    qr_code: 'QR Code',
    card: 'Kad',
    ewallet: 'eWallet',
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('backdated_import')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {t('backdated_import_desc')}
          </p>
        </div>

        {/* Template download */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-900 dark:text-blue-200 text-sm">{t('official_csv_template')}</p>
<p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              {t('official_template_desc')}
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={16} /> Download Template
          </button>
        </div>

        {/* Customer name reference list */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowCustomers((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Users size={15} />
              {t('customer_list_system')} ({customers.length})
            </span>
            <span className="text-xs text-slate-400">{showCustomers ? '▲' : '▼'}</span>
          </button>
          {showCustomers && (
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
              {customers.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">{t('no_customer_data')}</p>
              ) : (
                customers.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-2">
                    <span className="text-sm text-slate-800 dark:text-slate-200 font-mono">{c.name}</span>
                    {c.branch && (
                      <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{c.branch}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          <p className="px-4 py-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
            ⚠ {t('customer_name_warning')}
          </p>
        </div>

        {/* Upload zone */}
        {step === 'upload' && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
              dragging
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            <Upload
              className={`mx-auto mb-3 transition-colors ${
                dragging ? 'text-emerald-500' : 'text-slate-400'
              }`}
              size={40}
            />
            {dragging ? (
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-lg mb-1">{t('release_here')}</p>
            ) : (
              <>
                <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">{t('drag_drop_file')}</p>
                <p className="text-xs text-slate-400 mb-4">{t('drop_hint')}</p>
              </>
            )}
            {!dragging && (
              <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white text-sm px-5 py-2.5 rounded-lg inline-block transition-colors">
                {t('choose_file_btn')}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            )}
            {fileName && rows.length > 0 && (
              <p className="mt-3 text-sm text-emerald-500 font-medium">
                ✓ {fileName} — {rows.length} {t('rows_detected')}
              </p>
            )}
          </div>
        )}

        {/* Preview table */}
        {rows.length > 0 && step !== 'done' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="font-medium text-slate-800 dark:text-white text-sm">{rows.length} {t('rows_detected')} — {fileName}</span>
              <button onClick={handleReset} className="text-xs text-red-500 hover:underline">{t('discard_file')}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Branch</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Reference No</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => {
                    const ref = row.receipt_no || row.billing_ref_no || row.transfer_ref_no || row.qr_txn_ref_no || '—';
                    return (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.month}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.branch}</td>
                        <td className="px-3 py-2">
                          <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs">
                            {methodLabel[row.payment_method] || row.payment_method}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-medium">RM {Number(row.amount).toFixed(2)}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{ref}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 10 && (
                <p className="px-4 py-2 text-xs text-slate-400">... {t('row_label')} {rows.length - 10} {t('rows_detected').toLowerCase()}</p>
              )}
            </div>
          </div>
        )}

        {/* Validation result */}
        {result && result.mode === 'dry_run' && (
          <div className={`rounded-xl border p-4 ${result.valid ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.valid
                ? <CheckCircle className="text-emerald-600" size={20} />
                : <XCircle className="text-red-500" size={20} />}
              <span className={`font-semibold text-sm ${result.valid ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-700 dark:text-red-300'}`}>
                {result.valid ? t('all_rows_valid') : `${result.error_count} ${t('errors_found_label')}`}
              </span>
            </div>
            {result.valid && result.summary_by_method && (
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(result.summary_by_method).map(([method, count]) => (
                  <span key={method} className="bg-emerald-100 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs px-2 py-1 rounded">
                    {methodLabel[method] || method}: {count} rekod
                  </span>
                ))}
              </div>
            )}
            {!result.valid && result.errors && (
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-700 dark:text-red-300 flex gap-2">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    {t('row_label')} {err.row} — <span className="font-medium">{err.field}</span>: {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Success */}
        {step === 'done' && result && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 text-center">
            <CheckCircle className="mx-auto text-emerald-600 mb-3" size={40} />
            <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">{t('import_success_title')}</h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">{result.message}</p>
            <button
              onClick={handleReset}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {t('import_another')}
            </button>
          </div>
        )}

        {/* Action buttons */}
        {rows.length > 0 && step !== 'done' && (
          <div className="flex gap-3">
            {step === 'upload' && (
              <button
                disabled={loading}
                onClick={() => callApi('dry_run')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
              >
                {loading ? t('validating') : 'Validate (Dry Run)'}
              </button>
            )}
            {step === 'validated' && (
              <>
                <button
                  onClick={handleReset}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  {t('load_new_file')}
                </button>
                <button
                  disabled={loading}
                  onClick={() => callApi('confirm')}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  {loading ? t('saving') : t('confirm_import')}
                </button>
              </>
            )}
          </div>
        )}

        {/* Rules */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Peraturan Import</p>
          <p>• <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">month</code> — format YYYY-MM (cth: 2025-11)</p>
          <p>• <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">payment_method</code> — cash, bill_to_bill, bank_transfer, qr_code, card, ewallet</p>
          <p>• <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">cash</code> — wajib isi <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">receipt_no</code></p>
          <p>• <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">bill_to_bill</code> — wajib isi <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">billing_ref_no</code></p>
          <p>• <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">bank_transfer</code> — wajib isi <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">transfer_ref_no</code></p>
          <p>• <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">qr_code</code> — wajib isi <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">qr_txn_ref_no</code></p>
          <p>• Maksimum 500 baris setiap import</p>
        </div>
      </div>
    </div>
  );
}
