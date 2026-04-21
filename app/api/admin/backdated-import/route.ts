import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { logAuditEvent } from '@/lib/audit';
import { Branch, getCustomersTableByBranch } from '@/lib/branchPermissions';

const VALID_PAYMENT_METHODS = ['cash', 'bill_to_bill', 'bank_transfer', 'qr_code', 'card', 'ewallet'];
const VALID_IMPORT_BRANCHES = ['Kota Kinabalu', 'Kinabatangan'];
const REQUIRED_COLUMNS = ['month', 'branch', 'payment_method', 'amount'];

function isCustomerForeignKeyError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    msg.includes('customer_id') &&
    (msg.includes('foreign key') || msg.includes('fkey') || msg.includes('violates'))
  );
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
  [key: string]: string | number | undefined;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

function normalizeCustomerKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function extractCustomerFromNotes(notes?: string | null): string {
  const m = String(notes || '').match(/\[Customer:\s*(.*?)\]/i);
  return m?.[1]?.trim() || '';
}

async function reconcileBackdatedCustomers(branches: string[]): Promise<number> {
  if (!supabaseAdmin || branches.length === 0) return 0;

  let reconciled = 0;

  for (const branch of branches) {
    const validBranch = getValidBranch(branch);
    if (!validBranch) continue;

    const customersTable = getCustomersTableByBranch(validBranch);
    const { data: customers } = await supabaseAdmin
      .from(customersTable)
      .select('id, name');

    if (!customers || customers.length === 0) continue;

    const customerMap: Record<string, string> = {};
    customers.forEach((c) => {
      const key = normalizeCustomerKey(c.name);
      if (key) customerMap[key] = c.id;
    });

    const { data: unmatchedTx } = await supabaseAdmin
      .from('sales_transactions')
      .select('id, notes')
      .eq('branch', validBranch)
      .eq('is_backdated', true)
      .is('customer_id', null)
      .ilike('notes', '%[Customer:%');

    if (!unmatchedTx || unmatchedTx.length === 0) continue;

    for (const tx of unmatchedTx) {
      const rawName = extractCustomerFromNotes(tx.notes);
      const matchedCustomerId = rawName ? customerMap[normalizeCustomerKey(rawName)] : undefined;
      if (!matchedCustomerId) continue;

      const cleanedNotes = String(tx.notes || '')
        .replace(/\s*\[Customer:\s*.*?\]\s*/i, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim() || 'Backdated import';

      const { error: updateError } = await supabaseAdmin
        .from('sales_transactions')
        .update({ customer_id: matchedCustomerId, notes: cleanedNotes })
        .eq('id', tx.id);

      if (!updateError) reconciled += 1;
    }
  }

  return reconciled;
}

function getValidBranch(branch?: string): Branch | undefined {
  if (branch === 'Kota Kinabalu' || branch === 'Kinabatangan' || branch === 'HQ') {
    return branch;
  }

  return undefined;
}

function normalizeImportBranch(raw?: string): 'Kota Kinabalu' | 'Kinabatangan' | null {
  const normalized = String(raw || '').trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'kota kinabalu' || normalized === 'kk' || normalized.includes('kota kinabalu')) {
    return 'Kota Kinabalu';
  }

  if (normalized === 'kinabatangan' || normalized === 'kb' || normalized.includes('kinabatangan')) {
    return 'Kinabatangan';
  }

  return null;
}

function validateRow(row: ImportRow, rowIndex: number): RowError[] {
  const errors: RowError[] = [];

  // month format YYYY-MM
  if (!row.month || !/^\d{4}-\d{2}$/.test(String(row.month).trim())) {
    errors.push({ row: rowIndex, field: 'month', message: 'Format mesti YYYY-MM (cth: 2025-11)' });
  }

  if (!row.branch || String(row.branch).trim() === '') {
    errors.push({ row: rowIndex, field: 'branch', message: 'Cawangan wajib diisi' });
  } else if (!normalizeImportBranch(String(row.branch))) {
    errors.push({
      row: rowIndex,
      field: 'branch',
      message: `Cawangan tidak sah. Guna: ${VALID_IMPORT_BRANCHES.join(', ')}`,
    });
  }

  const method = String(row.payment_method || '').trim().toLowerCase();
  if (!VALID_PAYMENT_METHODS.includes(method)) {
    errors.push({
      row: rowIndex,
      field: 'payment_method',
      message: `Kaedah bayaran tidak sah. Guna: ${VALID_PAYMENT_METHODS.join(', ')}`,
    });
  } else {
    // Reference number validation per method
    if (method === 'cash' && !String(row.receipt_no || '').trim()) {
      errors.push({ row: rowIndex, field: 'receipt_no', message: 'receipt_no wajib untuk tunai' });
    }
    if (method === 'bill_to_bill' && !String(row.billing_ref_no || '').trim()) {
      errors.push({ row: rowIndex, field: 'billing_ref_no', message: 'billing_ref_no wajib untuk bill-to-bill' });
    }
    if (method === 'bank_transfer' && !String(row.transfer_ref_no || '').trim()) {
      errors.push({ row: rowIndex, field: 'transfer_ref_no', message: 'transfer_ref_no wajib untuk bank transfer' });
    }
    if (method === 'qr_code' && !String(row.qr_txn_ref_no || '').trim()) {
      errors.push({ row: rowIndex, field: 'qr_txn_ref_no', message: 'qr_txn_ref_no wajib untuk QR code' });
    }
  }

  const amount = Number(row.amount);
  if (isNaN(amount) || amount < 0) {
    errors.push({ row: rowIndex, field: 'amount', message: 'Jumlah mesti nombor positif' });
  }

  return errors;
}

// POST — supports two modes via query param: ?mode=dry_run (validate only) or ?mode=confirm (save)
export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (role !== 'Main Admin' && role !== 'Admin') {
      return NextResponse.json({ error: 'Hanya Main Admin atau Admin boleh import data' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') === 'confirm' ? 'confirm' : 'dry_run';

    const body = await request.json();
    const rows: ImportRow[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Tiada data untuk diimport' }, { status: 400 });
    }

    if (rows.length > 2000) {
      return NextResponse.json({ error: 'Maksimum 2000 baris setiap import' }, { status: 400 });
    }

    // Validate headers
    const firstRow = rows[0];
    const missingColumns = REQUIRED_COLUMNS.filter((col) => !(col in firstRow));
    if (missingColumns.length > 0) {
      return NextResponse.json({
        error: `Kolum wajib tidak ditemui: ${missingColumns.join(', ')}`,
      }, { status: 400 });
    }

    // Validate all rows
    const allErrors: RowError[] = [];
    rows.forEach((row, idx) => {
      const errs = validateRow(row, idx + 1);
      allErrors.push(...errs);
    });

    // Extra check: Admin cannot import data for a different branch
    if (role === 'Admin' && currentUser.branch) {
      rows.forEach((row, idx) => {
        const rowBranch = String(row.branch || '').trim();
        if (rowBranch && rowBranch !== currentUser.branch) {
          allErrors.push({
            row: idx + 1,
            field: 'branch',
            message: `Anda hanya boleh import data untuk cawangan ${currentUser.branch}. Baris ini mengandungi cawangan "${rowBranch}".`,
          });
        }
      });
    }

    if (allErrors.length > 0) {
      return NextResponse.json({
        mode,
        valid: false,
        total: rows.length,
        error_count: allErrors.length,
        errors: allErrors,
      });
    }

    // Dry run — return summary without saving
    if (mode === 'dry_run') {
      const summary = rows.reduce<Record<string, number>>((acc, row) => {
        const method = String(row.payment_method).trim().toLowerCase();
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {});

      return NextResponse.json({
        mode: 'dry_run',
        valid: true,
        total: rows.length,
        error_count: 0,
        summary_by_method: summary,
        message: `${rows.length} baris sah. Klik "Confirm Import" untuk simpan.`,
      });
    }

    // Confirm mode — build upsert records into sales_transactions
    const now = new Date().toISOString();

    // Lookup customer IDs by name from canonical `customers` table.
    // sales_transactions.customer_id FK points to public.customers(id),
    // so we must only assign IDs that exist there.
    const uniqueCustomerNames = Array.from(
      new Set(rows.map((r) => String(r.customer_name || '').trim()).filter(Boolean))
    );
    const customerNameToId: Record<string, string> = {};
    if (uniqueCustomerNames.length > 0) {
      // Load all customers and match case-insensitively in memory.
      // PostgreSQL .in() is case-sensitive so exact-match would miss
      // names that differ only in capitalisation (e.g. "SINTONG ENTERPRISE" vs "Sintong Enterprise").
      const { data: customerRows, error: customerLookupError } = await supabaseAdmin
        .from('customers')
        .select('id, name');

      if (customerLookupError) {
        console.warn('Backdated import customer lookup warning:', customerLookupError.message);
      } else {
        (customerRows || []).forEach((c) => {
          // Key by normalised (lowercase + collapsed whitespace) name so minor
          // spacing/casing differences in the CSV still resolve to the right ID.
          const key = String(c.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
          if (key) customerNameToId[key] = String(c.id || '');
        });
      }
    }

    // For non-Main Admin, force all records to the user's own branch regardless
    // of what is in the CSV — prevents cross-branch data injection.
    const enforcedBranch = role === 'Main Admin' ? null : (currentUser.branch ?? null);

    const records = rows.map((row) => {
      const method = String(row.payment_method).trim().toLowerCase();
      const monthStr = String(row.month).trim(); // YYYY-MM
      const customerName = String(row.customer_name || '').trim();
      const resolvedCustomerId = customerName
        ? (customerNameToId[customerName.toLowerCase().replace(/\s+/g, ' ').trim()] ?? null)
        : null;
      // Use the ref_no that was set by the client (already prefixed with BACK-)
      const refValue = String(row.receipt_no || row.billing_ref_no || row.transfer_ref_no || row.qr_txn_ref_no || '').trim()
        || `BACK-${monthStr}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      // Fix 7: use actual per-row date if provided, else fall back to 1st of month
      const txDate = (row as ImportRow & { transaction_date?: string }).transaction_date
        ? `${(row as ImportRow & { transaction_date?: string }).transaction_date}T00:00:00.000Z`
        : `${monthStr}-01T00:00:00.000Z`;
      // Use enforcedBranch for Admin; Main Admin can specify per-row branch from CSV
      const normalizedRowBranch = normalizeImportBranch(String(row.branch));
      const rowBranch = enforcedBranch ?? normalizedRowBranch ?? String(row.branch).trim();
      return {
        invoice: refValue,
        branch: rowBranch,
        user_id: currentUser.id,
        customer_id: resolvedCustomerId,
        transaction_date: txDate,
        subtotal_amount: Number(row.amount),
        grand_total: Number(row.amount),
        payment_method: method,
        receipt_no: method === 'cash' ? String(row.receipt_no || '').trim() || null : null,
        billing_ref_no: method === 'bill_to_bill' ? String(row.billing_ref_no || '').trim() || null : null,
        transfer_ref_no: method === 'bank_transfer' ? String(row.transfer_ref_no || '').trim() || null : null,
        qr_txn_ref_no: method === 'qr_code' ? String(row.qr_txn_ref_no || '').trim() || null : null,
        status: method === 'bill_to_bill' ? 'pending' : 'completed',
        notes: (() => {
          const payNote = String(row.payment_note || '').trim();
          const unmatched = customerName && !resolvedCustomerId ? `[Customer: ${customerName}]` : '';
          return [payNote, unmatched].filter(Boolean).join(' ') || 'Backdated import';
        })(),
        is_backdated: true,
        imported_by: currentUser.name || currentUser.username || currentUser.id,
        imported_at: now,
        created_at: now,
      };
    });

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('sales_transactions')
      .insert(records)
      .select('id');

    let insertedRows = inserted;
    let finalInsertError = insertError;

    // Fallback: if DB FK for customer_id still rejects a subset of rows,
    // retry with null customer_id while keeping customer names in notes.
    if (finalInsertError && isCustomerForeignKeyError(finalInsertError)) {
      const fallbackRecords = records.map((record, idx) => {
        const customerName = String(rows[idx]?.customer_name || '').trim();
        const existingNotes = String(record.notes || '').trim();
        const hasCustomerTag = /\[Customer:\s*.*?\]/i.test(existingNotes);
        const customerTag = customerName && !hasCustomerTag ? `[Customer: ${customerName}]` : '';

        return {
          ...record,
          customer_id: null,
          notes: [existingNotes, customerTag].filter(Boolean).join(' ') || 'Backdated import',
        };
      });

      const retry = await supabaseAdmin
        .from('sales_transactions')
        .insert(fallbackRecords)
        .select('id');

      insertedRows = retry.data;
      finalInsertError = retry.error;
    }

    if (finalInsertError) {
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'backdated_import',
        action: 'import_sales',
        entityType: 'sales_transaction',
        status: 'failed',
        sourceSystem: 'supabase',
        metadata: { error: finalInsertError.message, rows: rows.length },
      });
      return NextResponse.json({ error: 'Gagal import data', details: finalInsertError.message }, { status: 500 });
    }

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'backdated_import',
      action: 'import_sales',
      entityType: 'sales_transaction',
      status: 'success',
      sourceSystem: 'supabase',
      metadata: { rows_imported: insertedRows?.length ?? rows.length },
    });

    // Auto-reconcile previously unmatched backdated rows in relevant branch(es).
    // This lets newly-added customers get linked to old imported transactions.
    const targetBranches = Array.from(new Set(records.map((r) => r.branch).filter(Boolean)));
    const reconciled = await reconcileBackdatedCustomers(targetBranches);

    return NextResponse.json({
      mode: 'confirm',
      valid: true,
      total: rows.length,
      imported: insertedRows?.length ?? rows.length,
      reconciled,
      message: `${insertedRows?.length ?? rows.length} rekod berjaya diimport ke database.${reconciled > 0 ? ` ${reconciled} rekod lama berjaya dipadankan semula dengan customer.` : ''}`,
    });
  } catch (error) {
    console.error('Backdated import error:', error);
    return NextResponse.json({ error: 'Ralat sistem' }, { status: 500 });
  }
}

// GET — returns list of customers for reference in import page
export async function GET(request: NextRequest) {
  const currentUser = getSessionUserFromRequest(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = normalizeRole(currentUser.role);
  if (role !== 'Main Admin' && role !== 'Admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ customers: [] });
  }
  
  // Main Admin sees all customers from both branches, Admin sees only their branch
  if (role === 'Main Admin') {
    // Fetch from both customer tables and combine
    const [{ data: kbCustomers }, { data: kkCustomers }] = await Promise.all([
      supabaseAdmin
        .from('customers_kb')
        .select('id, name, branch')
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('customers_kk')
        .select('id, name, branch')
        .order('name', { ascending: true })
    ]);

    const allCustomers = [
      ...(kbCustomers || []).map(c => ({ ...c, branch: 'Kota Kinabalu' })),
      ...(kkCustomers || []).map(c => ({ ...c, branch: 'Kinabatangan' }))
    ];
    
    return NextResponse.json({ customers: allCustomers });
  } else {
    // Admin sees only their branch customers
    const customersTable = getCustomersTableByBranch(getValidBranch(currentUser.branch));
    const { data } = await supabaseAdmin
      .from(customersTable)
      .select('id, name, branch')
      .order('name', { ascending: true });
    
    return NextResponse.json({ customers: data || [] });
  }
}
