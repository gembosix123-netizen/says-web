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
  transaction_date?: string;    // YYYY-MM-DD — actual date from Excel row
  receipt_no?: string;
  billing_ref_no?: string;
  transfer_ref_no?: string;
  qr_txn_ref_no?: string;
  customer_name?: string;
  payment_note?: string;
}

// ── Helper: parse D.M.YYYY / DD.MM.YYYY / DD/MM/YYYY / YYYY-MM-DD → { month: "YYYY-MM", fullDate: "YYYY-MM-DD" }
function parseDateCell(raw: string): { month: string; fullDate: string } | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(/[\/\.\-]/);
  if (parts.length !== 3) return null;
  let year: string, mon: string, day: string;
  if (parts[0].length === 4) {
    // YYYY-MM-DD
    [year, mon, day] = parts;
  } else {
    // D.M.YYYY or DD/MM/YYYY (also accepts D.M.YY with 2-digit year)
    [day, mon, year] = parts;
  }
  if (!year || !mon || !day) return null;

  // Expand 2-digit years to 2000-2099 instead of zero-padding (avoids "0026").
  // 1- or 2-digit yy is interpreted as 20yy. 3-digit years are rejected to
  // prevent silent data corruption (caller must use 4-digit explicitly).
  let y: string;
  if (year.length <= 2) {
    if (!/^\d{1,2}$/.test(year)) return null;
    y = String(2000 + parseInt(year, 10)).padStart(4, '0');
  } else if (year.length === 4) {
    y = year;
  } else {
    return null;
  }

  const m = mon.padStart(2, '0');
  const d = day.padStart(2, '0');
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return null;
  return { month: `${y}-${m}`, fullDate: `${y}-${m}-${d}` };
}

// ── Helper: detect TRANSFER suffix in customer name (not a location like "MYSHOP (KM1)").
// Returns { isTransfer: true, cleanName } if the LAST word/phrase in brackets is TRANSFER or TRANSFER!
function detectTransfer(custName: string): { isTransfer: boolean; cleanName: string } {
  // Match trailing (TRANSFER) or (TRANSFER!) — case-insensitive
  const m = custName.match(/^(.+?)\s*\(TRANSFER!?\)\s*$/i);
  if (m) return { isTransfer: true, cleanName: m[1].trimEnd() };
  // Also match without brackets at end: "NAME TRANSFER"
  const m2 = custName.match(/^(.+?)\s+TRANSFER!?\s*$/i);
  if (m2) return { isTransfer: true, cleanName: m2[1].trimEnd() };
  return { isTransfer: false, cleanName: custName };
}

function parseKinabatanganLegacyRows(
  aoa: unknown[][],
  branch: string
): { rows: ImportRow[]; skipped: number } {
  if (!Array.isArray(aoa) || aoa.length === 0) return { rows: [], skipped: 0 };

  let headerIdx = -1;
  let header: string[] = [];

  for (let i = 0; i < Math.min(aoa.length, 12); i += 1) {
    const row = (aoa[i] || []).map((cell) => String(cell || '').trim().toLowerCase());
    if (row.length === 0) continue;

    const hasDate = row.some((h) => h === 'date');
    const hasInv = row.some((h) => h.includes('inv'));
    const hasName = row.some((h) => h === 'name' || h.includes('customer'));
    const hasTotal = row.some((h) => h === 'total' || h.includes('balance') || h.includes('sale'));

    if (hasDate && hasInv && hasName && hasTotal) {
      headerIdx = i;
      header = row;
      break;
    }
  }

  if (headerIdx === -1) return { rows: [], skipped: 0 };

  const findIndex = (patterns: RegExp[]) => header.findIndex((h) => patterns.some((p) => p.test(h)));
  const dateIdx = findIndex([/^date$/i]);
  const invIdx = findIndex([/^inv/i]);
  const nameIdx = findIndex([/^name$/i, /customer/i]);
  const saleIdx = findIndex([/^sale$/i, /amount/i]);
  const discountIdx = findIndex([/^discount$/i]);
  const taxIdx = findIndex([/^tax$/i]);
  const totalIdx = findIndex([/^total$/i]);
  const balanceIdx = findIndex([/^balance$/i]);
  const statusIdx = findIndex([/^status$/i]);
  const byIdx = findIndex([/^by$/i, /sales/i]);
  const remarkIdx = findIndex([/^remark$/i, /^notes?$/i]);

  const rows: ImportRow[] = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < aoa.length; i += 1) {
    const row = aoa[i] || [];
    const rawDate = String(row[dateIdx] || '').trim();
    const rawInv = String(row[invIdx] || '').trim();
    const rawName = String(row[nameIdx] || '').trim();
    const rawStatus = String(row[statusIdx] || '').trim();

    if (!rawDate || /^total$/i.test(rawDate) || /^status$/i.test(rawDate)) { skipped++; continue; }
    if (!rawInv || !rawName) { skipped++; continue; }

    const parsedDate = parseDateCell(rawDate);
    if (!parsedDate) { skipped++; continue; }

    const sale = Number(String(row[saleIdx] || '').replace(/[^0-9.-]/g, ''));
    const discount = Number(String(row[discountIdx] || '').replace(/[^0-9.-]/g, ''));
    const tax = Number(String(row[taxIdx] || '').replace(/[^0-9.-]/g, ''));
    const total = Number(String(row[totalIdx] || '').replace(/[^0-9.-]/g, ''));
    const balance = Number(String(row[balanceIdx] || '').replace(/[^0-9.-]/g, ''));

    const computedTotal = Number.isFinite(total) && total > 0
      ? total
      : Math.max(0, (Number.isFinite(sale) ? sale : 0) - (Number.isFinite(discount) ? discount : 0) + (Number.isFinite(tax) ? tax : 0));

    if (!Number.isFinite(computedTotal) || computedTotal <= 0) { skipped++; continue; }

    const statusNorm = rawStatus.toLowerCase();
    const isCredit = statusNorm.includes('unpaid') || statusNorm.includes('pending') || (Number.isFinite(balance) && balance > 0);
    const paymentMethod = isCredit ? 'bill_to_bill' : 'cash';
    const refNo = `BACK-${rawInv}`;

    const salesman = byIdx >= 0 ? String(row[byIdx] || '').trim() : '';
    const remark = remarkIdx >= 0 ? String(row[remarkIdx] || '').trim() : '';
    const paymentNote = [
      'Kinabatangan Legacy Import',
      rawStatus ? `Status: ${rawStatus}` : '',
      salesman ? `By: ${salesman}` : '',
      remark ? `Remark: ${remark}` : '',
    ].filter(Boolean).join(' | ');

    rows.push({
      month: parsedDate.month,
      transaction_date: parsedDate.fullDate,
      branch,
      payment_method: paymentMethod,
      amount: computedTotal,
      customer_name: rawName,
      receipt_no: paymentMethod === 'cash' ? refNo : undefined,
      billing_ref_no: paymentMethod === 'bill_to_bill' ? refNo : undefined,
      payment_note: paymentNote,
    });
  }

  return { rows, skipped };
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
  details?: string;
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
  // Weekly Excel detection
  const [detectedFormat, setDetectedFormat] = useState<'standard' | 'weekly' | 'kinabatangan_legacy' | null>(null);
  const [skippedRows, setSkippedRows] = useState(0);
  const [weeklyBranch, setWeeklyBranch] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUserRole(u.role || '');
      if (u.role !== 'Main Admin') setWeeklyBranch(u.branch || '');
    } catch {}
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
        // Read full file before parsing as Excel (sniff buffer only has first 4 bytes)
        const excelReader = new FileReader();
        excelReader.onload = async (excelEv) => {
          try {
            const fullBuf = excelEv.target?.result as ArrayBuffer;
            const XLSX = await import('xlsx');
            const wb = XLSX.read(fullBuf, { type: 'array' });
            const userBranch = (() => {
              try {
                return JSON.parse(localStorage.getItem('user') || '{}').branch || '';
              } catch {
                return '';
              }
            })();

            // Kinabatangan legacy monthly invoice format (detailed columns from old system)
            const legacyBranch = userBranch || 'Kinabatangan';
            let legacySkipped = 0;
            const legacyRows = wb.SheetNames.flatMap((sheetName) => {
              const ws = wb.Sheets[sheetName];
              if (!ws) return [] as ImportRow[];
              const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
              const parsed = parseKinabatanganLegacyRows(aoa, legacyBranch);
              legacySkipped += parsed.skipped;
              return parsed.rows;
            });

            if (legacyRows.length > 0) {
              if (userRole === 'Main Admin' && !weeklyBranch) {
                setWeeklyBranch('Kinabatangan');
              }
              setRows(legacyRows);
              setSkippedRows(legacySkipped);
              setDetectedFormat('kinabatangan_legacy');
              return;
            }

            // ── Detect weekly Excel format (sheets named WEEK 1, WEEK 2, …) ──
            const weekSheets = wb.SheetNames.filter((n) => /^WEEK \d+/i.test(n));
            // Also support old-format: single TRANSACTIONS sheet
            const hasOldTransactions = !weekSheets.length && wb.SheetNames.includes('TRANSACTIONS');

            if (weekSheets.length > 0 || hasOldTransactions) {
              const ub = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').branch || ''; } catch { return ''; } })();
              const importRows: ImportRow[] = [];

              // Proses WEEK sheets dahulu, kemudian Sheet1.
              // Sheet1 akan dimasukkan TAPI baris yang inv no-nya sudah ada dalam WEEK sheets akan di-skip
              // supaya tak jadi duplikat (MYSHOP boleh kredit minggu ni, cash minggu depan, dll).
              const weekOnlySheets = weekSheets.length > 0 ? weekSheets : ['TRANSACTIONS'];
              const sheetsToProcess = weekSheets.length > 0 && wb.SheetNames.includes('Sheet1')
                ? [...weekOnlySheets, 'Sheet1']
                : weekOnlySheets;

              // Set untuk track inv no yang sudah diproses dari WEEK sheets
              const processedInvNos = new Set<string>();

              for (const sheetName of sheetsToProcess) {
                const isSheet1 = sheetName === 'Sheet1';
                // Derive base payment method from sheet name suffix
                let basePayMethod: string | null = null;
                if (/transfer/i.test(sheetName))        basePayMethod = 'bank_transfer';
                else if (/credit/i.test(sheetName))     basePayMethod = 'bill_to_bill';
                else if (isSheet1)                      basePayMethod = 'bill_to_bill'; // Sheet1 = kredit (PO required)
                else if (sheetName === 'TRANSACTIONS')  basePayMethod = null; // baca dari kolum PAYMENT

                const ws = wb.Sheets[sheetName];
                if (!ws) continue;
                const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

                // Find header row — first row whose first cell is "DATE" (scan first 8 rows)
                let headerIdx = -1;
                for (let i = 0; i < Math.min(aoa.length, 8); i++) {
                  if (/^DATE$/i.test(String(aoa[i]?.[0] || '').trim())) { headerIdx = i; break; }
                }
                if (headerIdx === -1) continue; // unreadable sheet — skip

                const hdrs      = aoa[headerIdx].map((h) => String(h).toLowerCase());
                const dataStart = headerIdx + 1;
                const amtColIdx  = hdrs.findIndex((h) => /amount/i.test(h));
                const payColIdx  = hdrs.findIndex((h) => /payment|bayar/i.test(h));
                const invColIdx  = hdrs.findIndex((h) => /^inv/i.test(h));
                const custColIdx = hdrs.findIndex((h) => /customer|kedai/i.test(h));
                const invCol  = invColIdx  >= 0 ? invColIdx  : 1;
                const custCol = custColIdx >= 0 ? custColIdx : 2;

                for (let i = dataStart; i < aoa.length; i++) {
                  const row = aoa[i];
                  if (!row || row.length < 3) continue;

                  const dateVal = String(row[0] || '').trim();
                  const invNo   = String(row[invCol]  || '').trim();
                  const rawCust = String(row[custCol] || '').trim();

                  // Skip Sheet1 rows whose INV NO was already imported from a WEEK sheet (true duplicate)
                  if (isSheet1 && invNo && processedInvNos.has(invNo)) continue;

                  if (!dateVal || /^TOTAL/i.test(dateVal) || /^\s*$/.test(dateVal)) continue;

                  // Fix 1: parse actual date → YYYY-MM-DD + YYYY-MM
                  const parsed = parseDateCell(dateVal);
                  if (!parsed) continue;
                  const { month, fullDate } = parsed;

                  // Amount
                  let amount = NaN;
                  if (amtColIdx >= 0) {
                    amount = Number(String(row[amtColIdx] || '').replace(/[^0-9.]/g, ''));
                  }
                  if (isNaN(amount) || amount <= 0) {
                    for (let c = row.length - 1; c >= 3; c--) {
                      const cell = String(row[c] || '').trim();
                      if (/^(CASH|CREDIT|TRANSFER)$/i.test(cell)) continue;
                      const n = Number(cell.replace(/[^0-9.]/g, ''));
                      if (!isNaN(n) && n > 0) { amount = n; break; }
                    }
                  }
                  if (isNaN(amount) || amount <= 0) continue;

                  // Fix 2: detect (TRANSFER) / (TRANSFER!) suffix in customer name
                  const { isTransfer, cleanName } = detectTransfer(rawCust);
                  const custName = cleanName || rawCust;

                  // Payment method resolution
                  let resolvedMethod: string;
                  if (isTransfer) {
                    resolvedMethod = 'bank_transfer';
                  } else if (basePayMethod) {
                    resolvedMethod = basePayMethod;
                  } else {
                    const payRaw = payColIdx >= 0 ? String(row[payColIdx] || '').toLowerCase() : '';
                    if (/transfer|bank/i.test(payRaw))           resolvedMethod = 'bank_transfer';
                    else if (/credit|kredit|bill/i.test(payRaw)) resolvedMethod = 'bill_to_bill';
                    else if (/qr/i.test(payRaw))                 resolvedMethod = 'qr_code';
                    else if (/card|kad/i.test(payRaw))           resolvedMethod = 'card';
                    else if (/ewallet|wallet/i.test(payRaw))     resolvedMethod = 'ewallet';
                    else                                          resolvedMethod = 'cash';
                  }

                  // Fix 4: invoice = BACK-{originalInvNo}
                  const refNo = invNo
                    ? `BACK-${invNo}`
                    : `BACK-${month}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

                  importRows.push({
                    month,
                    transaction_date: fullDate,
                    branch: ub,
                    payment_method: resolvedMethod,
                    amount,
                    customer_name: custName || undefined,
                    receipt_no:      resolvedMethod === 'cash'          ? refNo : undefined,
                    billing_ref_no:  resolvedMethod === 'bill_to_bill'  ? refNo : undefined,
                    transfer_ref_no: resolvedMethod === 'bank_transfer' ? refNo : undefined,
                    qr_txn_ref_no:   resolvedMethod === 'qr_code'       ? refNo : undefined,
                    payment_note: `Weekly – ${sheetName}`,
                  });
                  // Track inv nos from WEEK sheets so Sheet1 can skip duplicates
                  if (!isSheet1 && invNo) processedInvNos.add(invNo);
                }
              }

              if (importRows.length === 0) {
                alert('Fail Weekly Excel tidak ada data transaksi yang boleh dibaca.');
                return;
              }
              setRows(importRows);
              setDetectedFormat('weekly');
              return;
            }

            // ── Standard import template (first sheet) ──
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: '' });
            if (json.length === 0) {
              alert(t('backdated_import') + ': Excel empty / no data in first sheet.');
              return;
            }
            setRows(json);
            setDetectedFormat('standard');
          } catch (error) {
            console.error('Excel parse error:', error);
            alert('Fail Excel tidak sah atau rosak. Sila guna fail .xlsx/.xls yang sah.');
          }
        };
        excelReader.readAsArrayBuffer(file);
      } else {
        // Parse as CSV text
        const textReader = new FileReader();
        textReader.onload = (ev) => {
          const text = ev.target?.result as string;

          // ── Detect weekly report CSV (first row contains "WEEKLY SALES REPORT") ──
          const lines = text.trim().split(/\r?\n/);
          if (lines.length > 1 && /WEEKLY SALES REPORT/i.test(lines[0])) {
            const ub = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').branch || ''; } catch { return ''; } })();

            // Find the actual header row — first row whose first cell is "DATE"
            let headerIdx = -1;
            for (let i = 1; i < Math.min(lines.length, 8); i++) {
              const firstCell = lines[i].split(',')[0].trim().replace(/^"|"$/g, '');
              if (/^DATE$/i.test(firstCell)) { headerIdx = i; break; }
            }
            if (headerIdx === -1) {
              alert('Tidak dapat baca format Weekly CSV — baris header (DATE) tidak dijumpai.');
              return;
            }

            const headers = lines[headerIdx].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
            const amtIdx  = headers.findIndex((h) => /amount/i.test(h));
            const payIdx  = headers.findIndex((h) => /payment|bayar/i.test(h));
            const invIdx  = headers.findIndex((h) => /inv/i.test(h));
            const custIdx = headers.findIndex((h) => /customer|kedai/i.test(h));

            const importRows: ImportRow[] = [];
            for (let i = headerIdx + 1; i < lines.length; i++) {
              const cells = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
              const dateVal = cells[0];
              if (!dateVal || /^TOTAL/i.test(dateVal)) continue;

              // Fix 1: parse actual date → YYYY-MM-DD
              const parsed = parseDateCell(dateVal);
              if (!parsed) continue;
              const { month, fullDate } = parsed;

              // Amount
              let amount = NaN;
              if (amtIdx >= 0) {
                amount = Number(String(cells[amtIdx] || '').replace(/[^0-9.]/g, ''));
              } else {
                for (let c = cells.length - 1; c >= 3; c--) {
                  const n = Number(String(cells[c] || '').replace(/[^0-9.]/g, ''));
                  if (!isNaN(n) && n > 0) { amount = n; break; }
                }
              }
              if (isNaN(amount) || amount <= 0) continue;

              const invNoRaw = invIdx >= 0 ? cells[invIdx] : '';
              const rawCust  = custIdx >= 0 ? cells[custIdx] : '';

              // Fix 2: detect TRANSFER suffix in customer name
              const { isTransfer, cleanName } = detectTransfer(rawCust);
              const custName = cleanName || rawCust;

              // Payment method from PAYMENT column or TRANSFER detection
              let payMethod: string;
              if (isTransfer) {
                payMethod = 'bank_transfer';
              } else {
                const payRaw = (payIdx >= 0 ? cells[payIdx] : '').toLowerCase();
                if (/transfer|bank/i.test(payRaw))           payMethod = 'bank_transfer';
                else if (/credit|kredit|bill/i.test(payRaw)) payMethod = 'bill_to_bill';
                else if (/qr/i.test(payRaw))                 payMethod = 'qr_code';
                else if (/card|kad/i.test(payRaw))           payMethod = 'card';
                else if (/ewallet|wallet/i.test(payRaw))     payMethod = 'ewallet';
                else                                          payMethod = 'cash';
              }

              // Fix 4: invoice = BACK-{originalInvNo}
              const refNo = invNoRaw
                ? `BACK-${invNoRaw}`
                : `BACK-${month}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

              importRows.push({
                month,
                transaction_date: fullDate,
                branch: ub,
                payment_method: payMethod,
                amount,
                customer_name: custName || undefined,
                receipt_no:      payMethod === 'cash'          ? refNo : undefined,
                billing_ref_no:  payMethod === 'bill_to_bill'  ? refNo : undefined,
                transfer_ref_no: payMethod === 'bank_transfer' ? refNo : undefined,
                qr_txn_ref_no:   payMethod === 'qr_code'       ? refNo : undefined,
                payment_note: 'Weekly CSV import',
              });
            }

            if (importRows.length === 0) {
              alert('Fail Weekly CSV tidak ada data transaksi yang boleh dibaca.');
              return;
            }
            setRows(importRows);
            setDetectedFormat('weekly');
            return;
          }

          // ── Standard import template CSV ──
          const parsed = parseCsv(text);
          if (parsed.length === 0) {
            alert('CSV file empty or invalid format.');
            return;
          }
          setRows(parsed);
          setDetectedFormat('standard');
        };
        textReader.readAsText(file, 'utf-8');
      }
    };
    sniff.readAsArrayBuffer(file.slice(0, 4));
  }, [t, userRole, weeklyBranch]);

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
    // For weekly format, apply selected branch to all rows before sending
    const rowsToSend = ((detectedFormat === 'weekly' || detectedFormat === 'kinabatangan_legacy') && weeklyBranch)
      ? rows.map((r) => ({ ...r, branch: weeklyBranch }))
      : rows;
    try {
      const res = await fetch(`/api/admin/backdated-import?mode=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rowsToSend }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));

      if (!res.ok) {
        setResult({
          mode,
          valid: false,
          total: rows.length,
          error: String(data.error || 'Gagal memproses import'),
          details: String(data.details || ''),
        });
        return;
      }

      const normalizedData: ImportResult = {
        mode,
        valid: Boolean(data.valid),
        total: Number(data.total || rows.length),
        error_count: typeof data.error_count === 'number' ? data.error_count : undefined,
        errors: Array.isArray(data.errors) ? data.errors as RowError[] : undefined,
        summary_by_method: (data.summary_by_method && typeof data.summary_by_method === 'object')
          ? data.summary_by_method as Record<string, number>
          : undefined,
        imported: typeof data.imported === 'number' ? data.imported : undefined,
        message: typeof data.message === 'string' ? data.message : undefined,
        error: typeof data.error === 'string' ? data.error : undefined,
        details: typeof data.details === 'string' ? data.details : undefined,
      };

      setResult(normalizedData);
      if (mode === 'dry_run' && normalizedData.valid) setStep('validated');
      if (mode === 'confirm' && normalizedData.valid) setStep('done');
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
    setDetectedFormat(null);
    setSkippedRows(0);
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

        {/* Weekly Excel detected banner */}
        {(detectedFormat === 'weekly' || detectedFormat === 'kinabatangan_legacy') && rows.length > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle size={16} />
              {detectedFormat === 'kinabatangan_legacy'
                ? 'Fail Legacy Kinabatangan Dikesan'
                : 'Fail Weekly Excel Dikesan'}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              {detectedFormat === 'kinabatangan_legacy'
                ? `${rows.length} transaksi dijumpai dari format Sales Invoice lama (detailed). Data telah dipetakan automatik untuk import backdated.${skippedRows > 0 ? ` (${skippedRows} baris dibuang: baris Total/kosong/jumlah tidak sah)` : ''}`
                : `${rows.length} transaksi dijumpai dari semua sheet WEEK (Cash · Transfer · Credit). Data sudah diproses secara automatik.`}
            </p>
            {/* Branch selector — only needed for Main Admin */}
            {userRole === 'Main Admin' && (
              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs text-emerald-700 dark:text-emerald-300 font-medium whitespace-nowrap">Cawangan data ini:</label>
                <select
                  value={weeklyBranch}
                  onChange={(e) => setWeeklyBranch(e.target.value)}
                  className="text-sm border border-emerald-300 dark:border-emerald-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800"
                >
                  <option value="">-- Pilih Cawangan --</option>
                  <option value="Kota Kinabalu">Kota Kinabalu</option>
                  <option value="Kinabatangan">Kinabatangan</option>
                  <option value="HQ">HQ</option>
                </select>
                {!weeklyBranch && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">⚠ Pilih cawangan sebelum validate</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Upload zone — show when no file loaded yet */}
        {step === 'upload' && rows.length === 0 && (
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

        {/* Re-upload button if already loaded a weekly file */}
        {(detectedFormat === 'weekly' || detectedFormat === 'kinabatangan_legacy') && step !== 'done' && (
          <div className="flex justify-end">
            <button onClick={handleReset} className="text-xs text-slate-500 hover:text-red-500 underline">
              Buang fail & muat semula
            </button>
          </div>
        )}

        {/* Preview table */}
        {rows.length > 0 && step !== 'done' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="font-medium text-slate-800 dark:text-white text-sm">{rows.length} {t('rows_detected')} — {fileName}</span>
              <button onClick={handleReset} className="text-xs text-red-500 hover:underline">{t('discard_file')}</button>
            </div>
            {/* Fix 5 UI: warn for large imports */}
            {rows.length > 500 && (
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle size={13} /> Import besar ({rows.length} baris). Proses mungkin mengambil masa lebih lama.
              </div>
            )}
            <div className="overflow-x-auto">
              {(() => {
                // Fix 6: build customer name set for unmatched badge
                const customerNameSet = new Set(customers.map((c) => c.name.toLowerCase()));
                return (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Tarikh</th>
                        <th className="px-3 py-2">Branch</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Reference No</th>
                        <th className="px-3 py-2">Customer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 10).map((row, i) => {
                        const ref = row.receipt_no || row.billing_ref_no || row.transfer_ref_no || row.qr_txn_ref_no || '—';
                        const dateDisplay = (row as ImportRow & { transaction_date?: string }).transaction_date || row.month;
                        const custName = row.customer_name || '';
                        const isUnmatched = !!custName && !customerNameSet.has(custName.toLowerCase());
                        return (
                          <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{dateDisplay}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.branch}</td>
                            <td className="px-3 py-2">
                              <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs">
                                {methodLabel[row.payment_method] || row.payment_method}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-medium">RM {Number(row.amount).toFixed(2)}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{ref}</td>
                            <td className="px-3 py-2">
                              {custName ? (
                                <span className="flex items-center gap-1">
                                  <span className="text-slate-700 dark:text-slate-300">{custName}</span>
                                  {isUnmatched && (
                                    <span className="text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 px-1.5 py-0 rounded text-[10px] font-medium whitespace-nowrap">
                                      ⚠ Unmatched
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
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
                {result.valid
                  ? t('all_rows_valid')
                  : result.error && !result.error_count
                    ? result.error
                    : `${result.error_count ?? 0} ${t('errors_found_label')}`}
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

        {result && result.mode === 'confirm' && !result.valid && (
          <div className="rounded-xl border p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="text-red-500" size={20} />
              <span className="font-semibold text-sm text-red-700 dark:text-red-300">Import gagal disimpan</span>
            </div>
            <p className="text-xs text-red-700 dark:text-red-300">{result.error || 'Ralat tidak diketahui semasa simpan data.'}</p>
            {result.details && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Butiran: {result.details}</p>
            )}
          </div>
        )}

        {/* Action buttons */}
        {rows.length > 0 && step !== 'done' && (
          <div className="flex gap-3">
            {step === 'upload' && (
              <button
                disabled={loading || (detectedFormat === 'weekly' && userRole === 'Main Admin' && !weeklyBranch)}
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
          <p className="mt-2 font-semibold text-slate-700 dark:text-slate-300">Format Weekly Excel (Auto-detect)</p>
          <p>• Upload fail <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">.xlsx</code> dari butang <strong>Muat Turun Excel Bulan</strong> — sistem akan baca semua sheet WEEK secara automatik</p>
          <p>• Sheet <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">WEEK 1</code> → Cash &nbsp;|&nbsp; <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">(TRANSFER)</code> → Bank Transfer &nbsp;|&nbsp; <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">(CREDIT)</code> → Kredit</p>
          <p>• Setiap baris transaksi dalam sheet akan diimport — no invois digunakan sebagai rujukan</p>
        </div>
      </div>
    </div>
  );
}
