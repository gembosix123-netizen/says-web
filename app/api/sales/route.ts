import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSaleSchema } from '@/lib/validations';

const SALES_TABLE = 'sales_transactions';
const SALES_ITEMS_TABLE = 'sales_items';

// Get current user from session cookie
async function getCurrentUser(request: NextRequest) {
  try {
    const session = request.cookies.get('session');
    if (!session) return null;
    const data = JSON.parse(session.value);
    return data;
  } catch {
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

    // Only Main Admin can fetch all branches
    if ((!branch || branch === 'all') && currentUser.role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized - only Main Admin can view all sales' }, { status: 403 });
    }

    let query = supabaseAdmin
      .from(SALES_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (branch && branch !== 'all') {
      query = query.eq('branch', branch);
    }

    // Sales can only see their own transactions
    if (currentUser.role === 'Sales') {
      query = query.eq('user_id', currentUser.id);
    }

    const { data: salesRows, error: salesError } = await query;

    if (salesError) {
      console.error('Supabase error fetching sales:', salesError);
      return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 });
    }

    const salesAll = salesRows || [];
    const saleIds = salesAll.map((sale) => sale.id);
    const customerIds = Array.from(new Set(salesAll.map((sale) => sale.customer_id).filter(Boolean)));
    const userIds = Array.from(new Set(salesAll.map((sale) => sale.user_id).filter(Boolean)));

    let itemsBySaleId: Record<string, Array<Record<string, unknown>>> = {};
    if (saleIds.length > 0) {
      const { data: itemsRows, error: itemsError } = await supabaseAdmin
        .from(SALES_ITEMS_TABLE)
        .select('*')
        .in('transaction_id', saleIds)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('Supabase error fetching sales items:', itemsError);
        return NextResponse.json({ error: 'Failed to fetch sales items' }, { status: 500 });
      }

      itemsBySaleId = (itemsRows || []).reduce<Record<string, Array<Record<string, unknown>>>>((acc, item) => {
        const transactionId = item.transaction_id;
        if (!acc[transactionId]) acc[transactionId] = [];
        acc[transactionId].push({
          productId: item.product_id,
          name: item.product_name,
          quantity: Number(item.quantity || 0),
          price: Number(item.unit_price || 0),
          subtotal: Number(item.subtotal || 0)
        });
        return acc;
      }, {});
    }

    let customersById: Record<string, string> = {};
    if (customerIds.length > 0) {
      const { data: customerRows } = await supabaseAdmin
        .from('customers')
        .select('id,name')
        .in('id', customerIds);

      customersById = (customerRows || []).reduce<Record<string, string>>((acc, customer) => {
        acc[customer.id] = customer.name;
        return acc;
      }, {});
    }

    let usersById: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: userRows } = await supabaseAdmin
        .from('users')
        .select('id,name,full_name,username')
        .in('id', userIds);

      usersById = (userRows || []).reduce<Record<string, string>>((acc, user) => {
        acc[user.id] = user.name || user.full_name || user.username || '';
        return acc;
      }, {});
    }

    const transactions = salesAll.map((sale) => {
      const items = itemsBySaleId[sale.id] || [];
      const total = Number(sale.grand_total ?? sale.subtotal_amount ?? 0);
      const paymentStatus = sale.status === 'pending' ? 'pending' : 'paid';

      return {
        id: sale.id,
        invoice: sale.invoice,
        total,
        total_amount: total,
        branch: sale.branch,
        items,
        status: sale.status || 'completed',
        paymentStatus,
        createdAt: sale.created_at,
        created_at: sale.created_at,
        customer: { id: sale.customer_id || null, name: customersById[sale.customer_id] || null },
        customer_id: sale.customer_id || null,
        customer_name: customersById[sale.customer_id] || null,
        salesmanId: sale.user_id || null,
        salesmanName: usersById[sale.user_id] || null,
        payment: { method: sale.payment_method || 'cash', amount: total },
        payment_method: sale.payment_method || 'cash'
      };
    });

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
      const errors = validation.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
      return NextResponse.json(
        { error: 'Ralat pengesahan', details: errors },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    const invoice = validatedData.invoice || generateInvoice(branch.replace(/\s+/g, '_'));
    const isCredit = validatedData.payment_method === 'credit';

    const subtotalAmount = validatedData.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const saleData: Record<string, unknown> = {
      invoice,
      branch: validatedData.branch,
      user_id: currentUser.id,
      customer_id: validatedData.customer_id || null,
      transaction_date: new Date().toISOString(),
      subtotal_amount: subtotalAmount,
      grand_total: validatedData.total_amount,
      payment_method: validatedData.payment_method,
      status: isCredit ? 'pending' : 'completed',
      notes: validatedData.notes || null,
      created_at: new Date().toISOString()
    };

    const { data: sale, error } = await supabaseAdmin
      .from(SALES_TABLE)
      .insert(saleData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to create sale', details: error.message }, { status: 500 });
    }

    const saleItems = validatedData.items.map((item) => ({
      transaction_id: sale.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.subtotal,
      created_at: new Date().toISOString()
    }));

    const { error: itemsError } = await supabaseAdmin
      .from(SALES_ITEMS_TABLE)
      .insert(saleItems);

    if (itemsError) {
      console.error('Supabase error inserting sales items:', itemsError);
      // Best effort cleanup for orphaned transaction
      await supabaseAdmin.from(SALES_TABLE).delete().eq('id', sale.id);
      return NextResponse.json({ error: 'Failed to create sale items', details: itemsError.message }, { status: 500 });
    }

    // Update customer outstanding balance if credit payment
    if (isCredit && body.customer_id) {
      try {
        // Get current outstanding balance
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('current_balance')
          .eq('id', body.customer_id)
          .single();

        const currentBalance = Number(customer?.current_balance || 0);
        const newBalance = currentBalance + validatedData.total_amount;

        // Update customer's outstanding balance
        await supabaseAdmin
          .from('customers')
          .update({ current_balance: newBalance })
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
      total: Number(sale.grand_total ?? sale.subtotal_amount ?? 0),
      branch: sale.branch,
      items: saleItems.map((item) => ({
        productId: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        price: item.unit_price,
        subtotal: item.subtotal
      })),
      status: isCredit ? 'Pending Payment' : 'Completed',
      paymentStatus: sale.status === 'pending' ? 'pending' : 'paid',
      createdAt: sale.created_at,
      customer: { id: sale.customer_id, name: validatedData.customer_name || null },
      salesmanId: sale.user_id,
      salesmanName: currentUser.name || currentUser.username || null,
      proofPhotoUrl: null
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

    // Verify the sale exists before deleting
    const { data: sale, error: fetchError } = await supabaseAdmin
      .from(SALES_TABLE)
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

    if (branch && branch !== 'all' && sale.branch !== branch) {
      return NextResponse.json({ error: 'Sale does not belong to selected branch' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from(SALES_TABLE).delete().eq('id', id);
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