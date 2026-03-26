import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { logAuditEvent } from '@/lib/audit';

const VALID_PAYMENT_METHODS = ['cash', 'bill_to_bill', 'bank_transfer', 'qr_code', 'card', 'ewallet'];
const REQUIRED_COLUMNS = ['month', 'branch', 'payment_method', 'amount'];

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

function validateRow(row: ImportRow, rowIndex: number): RowError[] {
  const errors: RowError[] = [];

  // month format YYYY-MM
  if (!row.month || !/^\d{4}-\d{2}$/.test(String(row.month).trim())) {
    errors.push({ row: rowIndex, field: 'month', message: 'Format mesti YYYY-MM (cth: 2025-11)' });
  }

  if (!row.branch || String(row.branch).trim() === '') {
    errors.push({ row: rowIndex, field: 'branch', message: 'Cawangan wajib diisi' });
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

    if (rows.length > 500) {
      return NextResponse.json({ error: 'Maksimum 500 baris setiap import' }, { status: 400 });
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

    // Lookup customer IDs by name (case-insensitive) for all unique names in the import
    const uniqueCustomerNames = Array.from(
      new Set(rows.map((r) => String(r.customer_name || '').trim()).filter(Boolean))
    );
    const customerNameToId: Record<string, string> = {};
    if (uniqueCustomerNames.length > 0) {
      const { data: customerRows } = await supabaseAdmin
        .from('customers')
        .select('id, name')
        .in('name', uniqueCustomerNames);
      (customerRows || []).forEach((c) => {
        customerNameToId[c.name.toLowerCase()] = c.id;
      });
    }

    const records = rows.map((row) => {
      const method = String(row.payment_method).trim().toLowerCase();
      const monthStr = String(row.month).trim(); // YYYY-MM
      const customerName = String(row.customer_name || '').trim();
      const resolvedCustomerId = customerName
        ? (customerNameToId[customerName.toLowerCase()] ?? null)
        : null;
      return {
        invoice: `BACK-${String(row.branch).trim().toUpperCase().replace(/\s+/g, '_')}-${monthStr}-${String(row.receipt_no || row.billing_ref_no || row.transfer_ref_no || row.qr_txn_ref_no || Math.random().toString(36).slice(2, 7).toUpperCase())}`,
        branch: String(row.branch).trim(),
        user_id: currentUser.id,
        customer_id: resolvedCustomerId,
        transaction_date: `${monthStr}-01T00:00:00.000Z`,
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

    if (insertError) {
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'backdated_import',
        action: 'import_sales',
        entityType: 'sales_transaction',
        status: 'failed',
        sourceSystem: 'supabase',
        metadata: { error: insertError.message, rows: rows.length },
      });
      return NextResponse.json({ error: 'Gagal import data', details: insertError.message }, { status: 500 });
    }

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'backdated_import',
      action: 'import_sales',
      entityType: 'sales_transaction',
      status: 'success',
      sourceSystem: 'supabase',
      metadata: { rows_imported: inserted?.length ?? rows.length },
    });

    return NextResponse.json({
      mode: 'confirm',
      valid: true,
      total: rows.length,
      imported: inserted?.length ?? rows.length,
      message: `${inserted?.length ?? rows.length} rekod berjaya diimport ke database.`,
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
  const { data } = await supabaseAdmin
    .from('customers')
    .select('id, name, branch')
    .order('name', { ascending: true });
  return NextResponse.json({ customers: data || [] });
}
