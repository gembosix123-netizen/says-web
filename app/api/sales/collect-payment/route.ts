import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { collectPaymentSchema } from '@/lib/validations';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { canAccessSalesRoutes } from '@/lib/permissions';
import { getCustomersTableByBranch } from '@/lib/branchPermissions';

const TABLE_KOTA = 'sales_kota_kinabalu';
const TABLE_KIN = 'sales_kinabatangan';

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

    const body = await request.json();

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

    // Get branch from sale record
    const branch = body.branch;
    
    // Determine which table
    const target = (branch === 'Kinabatangan' || branch?.toLowerCase().includes('kina')) 
      ? TABLE_KIN 
      : TABLE_KOTA;

    // Get the sale
    const { data: sale, error: fetchError } = await supabaseAdmin
      .from(target)
      .select('*')
      .eq('id', saleId)
      .single();

    if (fetchError || !sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    // Check if already paid
    if (sale.payment_status === 'paid') {
      return NextResponse.json({ error: 'Sale already paid' }, { status: 400 });
    }

    // Update sale as paid
    const { error: updateError } = await supabaseAdmin
      .from(target)
      .update({
        payment_status: 'paid',
        payment_method: payment_method || sale.payment_method,
        paid_at: new Date().toISOString(),
        paid_by: currentUser.id,
        amount_paid: amount,
        reference_number,
        payment_notes: notes,
        receipt_url
      })
      .eq('id', saleId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update sale' }, { status: 500 });
    }

    // Update customer outstanding balance
    if (sale.customer_id) {
      try {
        const customersTable = getCustomersTableByBranch(currentUser.branch);
        const { data: customer } = await supabaseAdmin
          .from(customersTable)
          .select('outstandingBalance')
          .eq('id', sale.customer_id)
          .single();

        const currentBalance = customer?.outstandingBalance || 0;
        const saleAmount = parseFloat(sale.total_amount || sale.amount || 0);
        const newBalance = Math.max(0, currentBalance - saleAmount);

        await supabaseAdmin
          .from(customersTable)
          .update({ outstandingBalance: newBalance })
          .eq('id', sale.customer_id);

        console.log(`Payment collected: Customer ${sale.customer_id} outstanding: ${currentBalance} -> ${newBalance}`);
      } catch (e) {
        console.error('Failed to update customer balance:', e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Payment collected successfully',
      saleId,
      amountPaid: amount || sale.total_amount
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

    let pendingSales = [];

    const fetchPending = async (table: string) => {
      let query = supabaseAdmin!
        .from(table)
        .select('*')
        .eq('payment_status', status)
        .order('created_at', { ascending: false });

      if (branch && branch !== 'all') {
        query = query.eq('branch', branch);
      }

      const { data } = await query;
      return data || [];
    };

    if (!branch || branch === 'all') {
      const [kk, kin] = await Promise.all([
        fetchPending(TABLE_KOTA),
        fetchPending(TABLE_KIN)
      ]);
      pendingSales = [...kk, ...kin];
    } else if (branch === 'Kinabatangan' || branch.toLowerCase().includes('kina')) {
      pendingSales = await fetchPending(TABLE_KIN);
    } else {
      pendingSales = await fetchPending(TABLE_KOTA);
    }

    // Format response
    const formatted = pendingSales.map(sale => ({
      id: sale.id,
      invoice: sale.invoice,
      customerName: sale.customer_name,
      customerId: sale.customer_id,
      amount: parseFloat(sale.total_amount || sale.amount || 0),
      branch: sale.branch,
      createdAt: sale.created_at,
      paymentStatus: sale.payment_status,
      salesmanId: sale.salesman_id,
      salesmanName: sale.salesman_name
    }));

    return NextResponse.json(formatted);

  } catch (error) {
    console.error('Error fetching pending sales:', error);
    return NextResponse.json({ error: 'Failed to fetch pending sales' }, { status: 500 });
  }
}
