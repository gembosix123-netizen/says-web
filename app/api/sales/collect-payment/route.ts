import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { collectPaymentSchema } from '@/lib/validations';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { canAccessSalesRoutes } from '@/lib/permissions';
import { getCustomersTableByBranch } from '@/lib/branchPermissions';

const TABLE_CANONICAL = 'sales_transactions';
const TABLE_KOTA = 'sales_kota_kinabalu';
const TABLE_KIN = 'sales_kinabatangan';

function normalizeBranchValue(value?: string | null): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function branchMatches(value?: string | null, expected?: string | null): boolean {
  const left = normalizeBranchValue(value);
  const right = normalizeBranchValue(expected);
  if (!right || right === 'all') return true;
  if (!left) return false;
  return left === right;
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && (
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  );
}

function normalizePaymentMethod(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'cash';
  if (raw === 'transfer') return 'bank_transfer';
  return raw;
}

function extractCustomerFromNotes(notes?: string | null): string {
  const m = String(notes || '').match(/\[Customer:\s*(.*?)\]/i);
  return m?.[1]?.trim() || '';
}

/**
 * POST /api/sales/collect-payment
 * Mark a credit sale as paid and update customer outstanding balance
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canAccessSalesRoutes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const rawBody = await request.json();

    const body = {
      ...rawBody,
      amount: Number(rawBody?.amount ?? rawBody?.amountPaid ?? 0),
      payment_method: normalizePaymentMethod(rawBody?.payment_method ?? rawBody?.paymentMethod),
      customerId: String(rawBody?.customerId ?? rawBody?.customer_id ?? rawBody?.saleCustomerId ?? 'unknown'),
      reference_number: rawBody?.reference_number ?? rawBody?.referenceNo ?? rawBody?.referenceNumber,
    };

    // Validate payment data with Zod
    const validation = collectPaymentSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
      return NextResponse.json(
        { error: 'Ralat pengesahan', details: errors },
        { status: 400 }
      );
    }

    const { saleId, amount, payment_method, reference_number, notes, receipt_url } = validation.data;

    // Get branch hint from request; actual branch will be taken from matched sale record.
    const branch = String(body.branch || '').trim();

    // Resolve sale source table (canonical first, then legacy fallback).
    let target = TABLE_CANONICAL;
    let sale: Record<string, unknown> | null = null;

    const canonicalFetch = await supabaseAdmin
      .from(TABLE_CANONICAL)
      .select('*')
      .eq('id', saleId)
      .maybeSingle();

    if (!canonicalFetch.error && canonicalFetch.data) {
      sale = canonicalFetch.data as Record<string, unknown>;
      target = TABLE_CANONICAL;
    } else {
      const tryTables = branchMatches(branch, 'Kinabatangan')
        ? [TABLE_KIN, TABLE_KOTA]
        : [TABLE_KOTA, TABLE_KIN];

      for (const table of tryTables) {
        const legacyFetch = await supabaseAdmin
          .from(table)
          .select('*')
          .eq('id', saleId)
          .maybeSingle();

        if (!legacyFetch.error && legacyFetch.data) {
          sale = legacyFetch.data as Record<string, unknown>;
          target = table;
          break;
        }
      }
    }

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    // Check if already paid
    if (sale.payment_status === 'paid' || sale.status === 'completed') {
      return NextResponse.json({ error: 'Sale already paid' }, { status: 400 });
    }

    // Update sale as paid. Support both legacy (payment_status) and canonical (status) schemas.
    const legacyUpdatePayload: Record<string, unknown> = {
      payment_status: 'paid',
      payment_method: payment_method || sale.payment_method,
      paid_at: new Date().toISOString(),
      paid_by: currentUser.id,
      amount_paid: amount,
      reference_number,
      payment_notes: notes,
      receipt_url,
    };

    const canonicalUpdatePayload: Record<string, unknown> = {
      status: 'completed',
      payment_method: payment_method || sale.payment_method,
    };

    if (notes) {
      canonicalUpdatePayload.notes = [String(sale.notes || '').trim(), String(notes).trim()].filter(Boolean).join(' | ');
    }

    if (receipt_url) {
      canonicalUpdatePayload.receipt_url = receipt_url;
    }

    if (reference_number) {
      if (payment_method === 'bill_to_bill') canonicalUpdatePayload.billing_ref_no = reference_number;
      if (payment_method === 'bank_transfer') canonicalUpdatePayload.transfer_ref_no = reference_number;
      if (payment_method === 'qr_code') canonicalUpdatePayload.qr_txn_ref_no = reference_number;
    }

    let updateError: unknown = null;

    if (target === TABLE_CANONICAL) {
      const canonicalUpdate = await supabaseAdmin
        .from(target)
        .update(canonicalUpdatePayload)
        .eq('id', saleId);

      updateError = canonicalUpdate.error;
    } else {
      const legacyUpdate = await supabaseAdmin
        .from(target)
        .update(legacyUpdatePayload)
        .eq('id', saleId);

      updateError = legacyUpdate.error;

      if (updateError && (
        isMissingColumnError(updateError, 'payment_status') ||
        isMissingColumnError(updateError, 'amount_paid') ||
        isMissingColumnError(updateError, 'payment_notes') ||
        isMissingColumnError(updateError, 'reference_number')
      )) {
        const canonicalUpdate = await supabaseAdmin
          .from(target)
          .update(canonicalUpdatePayload)
          .eq('id', saleId);

        updateError = canonicalUpdate.error;
      }
    }

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update sale' }, { status: 500 });
    }

    // Update customer outstanding balance
    if (sale.customer_id) {
      try {
        const effectiveBranch = String(sale.branch || branch || currentUser.branch || '');
        const customersTable = getCustomersTableByBranch(effectiveBranch);

        let customer: { outstandingBalance?: number | string | null; current_balance?: number | string | null } | null = null;

        const firstRead = await supabaseAdmin
          .from(customersTable)
          .select('outstandingBalance, current_balance')
          .eq('id', sale.customer_id)
          .maybeSingle();

        if (!firstRead.error) {
          customer = firstRead.data;
        } else if (isMissingColumnError(firstRead.error, 'current_balance')) {
          const fallbackRead = await supabaseAdmin
            .from(customersTable)
            .select('outstandingBalance')
            .eq('id', sale.customer_id)
            .maybeSingle();

          customer = (fallbackRead.data || null) as { outstandingBalance?: number | string | null } | null;
        } else if (isMissingColumnError(firstRead.error, 'outstandingBalance')) {
          const fallbackRead = await supabaseAdmin
            .from(customersTable)
            .select('current_balance')
            .eq('id', sale.customer_id)
            .maybeSingle();

          customer = (fallbackRead.data || null) as { current_balance?: number | string | null } | null;
        }

        const currentBalance = Number(customer?.current_balance ?? customer?.outstandingBalance ?? 0);
        const rawSaleAmount = sale.grand_total ?? sale.total_amount ?? sale.amount ?? sale.subtotal_amount ?? 0;
        const saleAmount = Number(typeof rawSaleAmount === 'string' || typeof rawSaleAmount === 'number' ? rawSaleAmount : 0);
        const newBalance = Math.max(0, currentBalance - saleAmount);

        const fullUpdate = await supabaseAdmin
          .from(customersTable)
          .update({
            outstandingBalance: newBalance,
            current_balance: newBalance,
          })
          .eq('id', sale.customer_id);

        if (fullUpdate.error && isMissingColumnError(fullUpdate.error, 'current_balance')) {
          await supabaseAdmin
            .from(customersTable)
            .update({ outstandingBalance: newBalance })
            .eq('id', sale.customer_id);
        } else if (fullUpdate.error && isMissingColumnError(fullUpdate.error, 'outstandingBalance')) {
          await supabaseAdmin
            .from(customersTable)
            .update({ current_balance: newBalance })
            .eq('id', sale.customer_id);
        }

        console.log(`Payment collected: Customer ${sale.customer_id} outstanding: ${currentBalance} -> ${newBalance}`);
      } catch (e) {
        console.error('Failed to update customer balance:', e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Payment collected successfully',
      saleId,
      amountPaid: amount || sale.grand_total || sale.total_amount || sale.amount || sale.subtotal_amount
    });

  } catch (error) {
    console.error('Error collecting payment:', error);
    return NextResponse.json({ error: 'Failed to collect payment' }, { status: 500 });
  }
}

/**
 * GET /api/sales/collect-payment?status=pending
 * Get all pending credit sales (outstanding)
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canAccessSalesRoutes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    let branch: string | null = searchParams.get('branch');

    // Branch access control
    if (role === 'Admin' || role === 'Sales') {
      branch = currentUser.branch ?? null;
    }

    let pendingSales: Array<Record<string, unknown>> = [];

    const fetchPending = async (table: string) => {
      const expectedStatus = status === 'pending' ? 'pending' : 'completed';

      // Prefer canonical status column first.
      let canonicalQuery = supabaseAdmin!
        .from(table)
        .select('*')
        .eq('status', expectedStatus)
        .order('created_at', { ascending: false });

      if (branch && branch !== 'all') {
        canonicalQuery = canonicalQuery.ilike('branch', normalizeBranchValue(branch));
      }

      const canonicalResult = await canonicalQuery;
      if (!canonicalResult.error) {
        return (canonicalResult.data || []) as Array<Record<string, unknown>>;
      }

      // Backward fallback: legacy schema may still use payment_status.
      if (!isMissingColumnError(canonicalResult.error, 'status')) {
        return [];
      }

      let legacyQuery = supabaseAdmin!
        .from(table)
        .select('*')
        .eq('payment_status', status)
        .order('created_at', { ascending: false });

      if (branch && branch !== 'all') {
        legacyQuery = legacyQuery.ilike('branch', normalizeBranchValue(branch));
      }

      const legacyResult = await legacyQuery;
      return (legacyResult.data || []) as Array<Record<string, unknown>>;
    };

    // Canonical table stores both branches now.
    const canonicalPending = await fetchPending(TABLE_CANONICAL);

    // Merge legacy pending sales for deployments that still have old branch tables.
    let legacyPending: Array<Record<string, unknown>> = [];
    if (!branch || branch === 'all') {
      const [kk, kin] = await Promise.all([
        fetchPending(TABLE_KOTA),
        fetchPending(TABLE_KIN)
      ]);
      legacyPending = [...kk, ...kin];
    } else if (branchMatches(branch, 'Kinabatangan')) {
      legacyPending = await fetchPending(TABLE_KIN);
    } else {
      legacyPending = await fetchPending(TABLE_KOTA);
    }

    const mergedById = new Map<string, Record<string, unknown>>();
    [...canonicalPending, ...legacyPending].forEach((sale) => {
      const id = String(sale.id || '');
      if (!id) return;
      const saleBranch = typeof sale.branch === 'string' ? sale.branch : null;
      if (!branchMatches(saleBranch, branch)) return;
      if (!mergedById.has(id)) {
        mergedById.set(id, sale);
      }
    });

    pendingSales = Array.from(mergedById.values());

    // Format response
    const formatted = pendingSales.map((sale) => {
      const notesText = typeof sale.notes === 'string' ? sale.notes : null;
      const rawAmount = sale.grand_total ?? sale.total_amount ?? sale.amount ?? sale.subtotal_amount ?? 0;

      return {
        id: sale.id,
        invoice: sale.invoice,
        customerName: sale.customer_name || extractCustomerFromNotes(notesText) || 'N/A',
        customerId: sale.customer_id,
        amount: Number(typeof rawAmount === 'string' || typeof rawAmount === 'number' ? rawAmount : 0),
        branch: sale.branch,
        createdAt: sale.created_at,
        paymentStatus: sale.payment_status || sale.status || 'pending',
        salesmanId: sale.salesman_id || sale.user_id,
        salesmanName: sale.salesman_name || sale.user_name || null
      };
    });

    return NextResponse.json(formatted);

  } catch (error) {
    console.error('Error fetching pending sales:', error);
    return NextResponse.json({ error: 'Failed to fetch pending sales' }, { status: 500 });
  }
}
