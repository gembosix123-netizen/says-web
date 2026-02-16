import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const TABLE_KOTA = 'sales_kota_kinabalu';
const TABLE_KIN = 'sales_kinabatangan';

// Get current user from session cookie
async function getCurrentUser(request: Request) {
  try {
    const session = (request as any).cookies.get('session');
    if (!session) return null;
    const data = JSON.parse(session.value);
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/sales/collect-payment
 * Mark a credit sale as paid and update customer outstanding balance
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json();
    const { saleId, branch, amountPaid, paymentMethod } = body;

    if (!saleId) {
      return NextResponse.json({ error: 'Missing saleId' }, { status: 400 });
    }

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
        payment_method: paymentMethod || sale.payment_method,
        paid_at: new Date().toISOString(),
        paid_by: currentUser.id,
        amount_paid: amountPaid || sale.total_amount
      })
      .eq('id', saleId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update sale' }, { status: 500 });
    }

    // Update customer outstanding balance
    if (sale.customer_id) {
      try {
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('outstandingBalance')
          .eq('id', sale.customer_id)
          .single();

        const currentBalance = customer?.outstandingBalance || 0;
        const saleAmount = parseFloat(sale.total_amount || sale.amount || 0);
        const newBalance = Math.max(0, currentBalance - saleAmount);

        await supabaseAdmin
          .from('customers')
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
      amountPaid: amountPaid || sale.total_amount
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
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    let branch = searchParams.get('branch');

    // Branch access control
    if (currentUser.role === 'Admin' || currentUser.role === 'Sales') {
      branch = currentUser.branch;
    }

    let pendingSales: any[] = [];

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
