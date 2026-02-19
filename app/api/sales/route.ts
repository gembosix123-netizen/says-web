import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSaleSchema } from '@/lib/validations';

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

function generateInvoice(branchCode = 'XX') {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `INV-${branchCode.toUpperCase().replace(/\s+/g, '_')}-${timestamp}-${rand}`;
}

export async function GET(request: NextRequest) {
  try {
    // Check authorization
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    let branch = searchParams.get('branch');

    // Branch access control
    // If Admin, only allow their own branch
    if (currentUser.role === 'Admin') {
      branch = currentUser.branch;
    } else if (currentUser.role === 'Sales') {
      // Sales can only see their own data - filter by user_id
      branch = currentUser.branch;
    }
    // Main Admin can query any branch (respects branch param if provided)

    let salesAll: any[] = [];

    if (!branch || branch === 'all') {
      // Only Main Admin can fetch all
      if (currentUser.role !== 'Main Admin') {
        return NextResponse.json({ error: 'Unauthorized - only Main Admin can view all sales' }, { status: 403 });
      }
      const [{ data: a }, { data: b }] = await Promise.all([
        supabaseAdmin.from(TABLE_KOTA).select('*').order('created_at', { ascending: false }),
        supabaseAdmin.from(TABLE_KIN).select('*').order('created_at', { ascending: false }),
      ]);
      salesAll = (a || []).concat(b || []);
    } else if (branch === 'Kota Kinabalu' || branch.toLowerCase().includes('kota')) {
      // Check access
      if (currentUser.role === 'Admin' && currentUser.branch !== 'Kota Kinabalu') {
        return NextResponse.json({ error: 'Unauthorized - you cannot access other branches' }, { status: 403 });
      }
      const { data } = await supabaseAdmin.from(TABLE_KOTA).select('*').order('created_at', { ascending: false });
      salesAll = data || [];
    } else if (branch === 'Kinabatangan' || branch.toLowerCase().includes('kina')) {
      // Check access
      if (currentUser.role === 'Admin' && currentUser.branch !== 'Kinabatangan') {
        return NextResponse.json({ error: 'Unauthorized - you cannot access other branches' }, { status: 403 });
      }
      const { data } = await supabaseAdmin.from(TABLE_KIN).select('*').order('created_at', { ascending: false });
      salesAll = data || [];
    } else {
      // Unknown branch -> return empty
      salesAll = [];
    }

    const transactions = salesAll.map((sale) => ({
      id: sale.id,
      invoice: sale.invoice,
      total: parseFloat(sale.total_amount ?? sale.amount ?? 0),
      branch: sale.branch,
      items: sale.items ?? (sale.item_name ? [{ name: sale.item_name, quantity: 1, price: parseFloat(sale.amount || 0) }] : []),
      status: 'Completed',
      createdAt: sale.created_at,
      customer: { id: sale.customer_id || null, name: sale.customer_name || null },
      salesmanId: sale.salesman_id || null,
      payment: { method: sale.payment_method || 'cash', amount: parseFloat(sale.total_amount ?? sale.amount ?? 0) }
    }));

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error in GET /api/sales:', error);
    return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Sales and Admin can create sales
    if (currentUser.role !== 'Sales' && currentUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized - only sales staff and admin can create sales' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const body = await request.json();
    let branch = body.branch || currentUser.branch; // Default to user's branch

    // Ensure user can only create sales for their own branch
    if (currentUser.role === 'Sales') {
      branch = currentUser.branch;
    } else if (currentUser.role === 'Admin') {
      // Admin can create sales for their branch only
      if (body.branch && body.branch !== currentUser.branch) {
        return NextResponse.json({ error: 'You can only create sales for your own branch' }, { status: 403 });
      }
      branch = currentUser.branch;
    }

    // Set branch for validation
    body.branch = branch;

    // Validate sale data with Zod
    const validation = createSaleSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`);
      return NextResponse.json(
        { error: 'Ralat pengesahan', details: errors },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    const target = (branch === 'Kinabatangan' || branch.toLowerCase().includes('kina')) ? TABLE_KIN : TABLE_KOTA;

    const invoice = validatedData.invoice || generateInvoice(branch.replace(/\s+/g, '_'));

    const isCredit = validatedData.payment_method === 'credit';

    const saleData: Record<string, any> = {
      invoice,
      branch: validatedData.branch,
      total_amount: validatedData.total_amount,
      amount: validatedData.total_amount,
      items: validatedData.items,
      item_name: validatedData.items.length > 0 ? validatedData.items[0].name : 'Sale Item',
      customer_name: validatedData.customer_name || null,
      customer_id: validatedData.customer_id || null,
      salesman_id: validatedData.salesman_id || currentUser.id,  // Track who made the sale
      salesman_name: validatedData.salesman_name || currentUser.name || currentUser.username || null,
      check_in_time: validatedData.check_in_time || null,
      gps_lat: validatedData.gps_lat ?? null,
      gps_long: validatedData.gps_long ?? null,
      payment_method: validatedData.payment_method,
      payment_status: isCredit ? 'pending' : 'paid',  // Track payment status
      return_amount: validatedData.return_amount,
      exchange_amount: validatedData.exchange_amount,
      foc_amount: validatedData.foc_amount,
      proof_photo_url: validatedData.proof_photo_url || validatedData.receipt_url || null,
      created_at: new Date().toISOString()
    };

    const { data: sale, error } = await supabaseAdmin
      .from(target)
      .insert(saleData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to create sale', details: error.message }, { status: 500 });
    }

    // Update customer outstanding balance if credit payment
    if (isCredit && body.customer_id) {
      try {
        // Get current outstanding balance
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('outstandingBalance')
          .eq('id', body.customer_id)
          .single();

        const currentBalance = customer?.outstandingBalance || 0;
        const newBalance = currentBalance + validatedData.total_amount;

        // Update customer's outstanding balance
        await supabaseAdmin
          .from('customers')
          .update({ outstandingBalance: newBalance })
          .eq('id', body.customer_id);
          
        console.log(`Updated customer ${body.customer_id} outstanding: ${currentBalance} -> ${newBalance}`);
      } catch (updateErr) {
        console.error('Failed to update customer outstanding balance:', updateErr);
        // Don't fail the sale, just log the error
      }
    }

    const transaction = {
      id: sale.id,
      invoice: sale.invoice,
      total: parseFloat((sale.total_amount ?? sale.amount ?? 0) as any),
      branch: sale.branch,
      items: sale.items ?? [{ name: sale.item_name, quantity: 1, price: parseFloat((sale.amount ?? 0) as any) }],
      status: isCredit ? 'Pending Payment' : 'Completed',
      paymentStatus: sale.payment_status,
      createdAt: sale.created_at,
      customer: { id: sale.customer_id, name: sale.customer_name },
      salesmanId: sale.salesman_id,
      salesmanName: sale.salesman_name,
      proofPhotoUrl: sale.proof_photo_url ?? sale.receipt_url
    };

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/sales:', error);
    return NextResponse.json({ error: 'Failed to create sale' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authorization
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Admin and Main Admin can delete sales
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized - only admin can delete sales' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    let branch = searchParams.get('branch');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Branch access control
    if (currentUser.role === 'Admin') {
      branch = currentUser.branch; // Admin can only delete from their branch
    }

    const target = (branch && (branch === 'Kinabatangan' || branch.toLowerCase().includes('kina'))) ? TABLE_KIN : TABLE_KOTA;

    // Verify the sale exists in the correct branch before deleting
    const { data: sale, error: fetchError } = await supabaseAdmin
      .from(target)
      .select('branch')
      .eq('id', id)
      .single();

    if (fetchError || !sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    // Double check Admin can only delete from their branch
    if (currentUser.role === 'Admin' && sale.branch !== currentUser.branch) {
      return NextResponse.json({ error: 'You cannot delete sales from other branches' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from(target).delete().eq('id', id);
    if (error) {
      console.error('Supabase error deleting sale:', error);
      return NextResponse.json({ error: 'Failed to delete sale' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/sales:', error);
    return NextResponse.json({ error: 'Failed to delete sale' }, { status: 500 });
  }
}