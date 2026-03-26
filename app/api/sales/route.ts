import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { db } from '@/lib/db';
import { createSaleSchema } from '@/lib/validations';
import { logAuditEvent } from '@/lib/audit';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { canAccessSalesRoutes } from '@/lib/permissions';

const SALES_TABLE = 'sales_transactions';
const SALES_ITEMS_TABLE = 'sales_items';

function generateInvoice(branchCode = 'XX') {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `INV-${branchCode.toUpperCase().replace(/\s+/g, '_')}-${timestamp}-${rand}`;
}

export async function GET(request: NextRequest) {
  try {
    // Check authorization
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canAccessSalesRoutes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let branch: string | null = searchParams.get('branch');
    const startDate: string | null = searchParams.get('startDate');
    const endDate: string | null = searchParams.get('endDate');

    if (!supabaseAdmin) {
      // Fallback to local db so analytics pages still render when Supabase is temporarily unavailable
      const allTx = await db.transactions.getAll();
      let filtered = (!branch || branch === 'all')
        ? allTx
        : allTx.filter((t) => t.branch === branch);
      if (startDate) filtered = filtered.filter((t) => t.createdAt && t.createdAt >= startDate);
      if (endDate)   filtered = filtered.filter((t) => t.createdAt && t.createdAt <= endDate + 'T23:59:59.999Z');
      return NextResponse.json(filtered);
    }

    // Branch access control
    // If Admin, only allow their own branch
    if (role === 'Admin') {
      branch = currentUser.branch ?? null;
    } else if (role === 'Sales') {
      // Sales can only see their own data - filter by user_id
      branch = currentUser.branch ?? null;
    }
    // Main Admin can query any branch (respects branch param if provided)

    // Only Main Admin can fetch all branches
    if ((!branch || branch === 'all') && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized - only Main Admin can view all sales' }, { status: 403 });
    }

    let query = supabaseAdmin
      .from(SALES_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (branch && branch !== 'all') {
      query = query.eq('branch', branch);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59.999Z');
    }

    // Sales can only see their own transactions
    if (role === 'Sales') {
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
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canAccessSalesRoutes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only Sales and Admin can create sales
    if (role !== 'Sales' && role !== 'Admin') {
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'sales',
        action: 'create_sale',
        entityType: 'sales_transaction',
        status: 'denied',
        sourceSystem: 'supabase',
      });
      return NextResponse.json({ error: 'Unauthorized - only sales staff and admin can create sales' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const body = await request.json();
    let branch: string = String(body.branch || currentUser.branch || ''); // Default to user's branch

    // Ensure user can only create sales for their own branch
    if (role === 'Sales') {
      branch = currentUser.branch ?? branch;
    } else if (role === 'Admin') {
      // Admin can create sales for their branch only
      if (body.branch && body.branch !== currentUser.branch) {
        return NextResponse.json({ error: 'You can only create sales for your own branch' }, { status: 403 });
      }
      branch = currentUser.branch ?? branch;
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
    const isCredit = validatedData.payment_method === 'bill_to_bill';

    // Validate required reference number per payment method
    if (validatedData.payment_method === 'cash' && !validatedData.receipt_no) {
      return NextResponse.json({ error: 'Nombor resit diperlukan untuk pembayaran tunai' }, { status: 400 });
    }
    if (validatedData.payment_method === 'bill_to_bill' && !validatedData.billing_ref_no) {
      return NextResponse.json({ error: 'Nombor rujukan invois diperlukan untuk bill-to-bill' }, { status: 400 });
    }
    if (validatedData.payment_method === 'bank_transfer' && !validatedData.transfer_ref_no) {
      return NextResponse.json({ error: 'Nombor rujukan pemindahan diperlukan untuk bank transfer' }, { status: 400 });
    }
    if (validatedData.payment_method === 'qr_code' && !validatedData.qr_txn_ref_no) {
      return NextResponse.json({ error: 'Nombor transaksi QR diperlukan untuk pembayaran QR' }, { status: 400 });
    }

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
      receipt_no: validatedData.receipt_no || null,
      billing_ref_no: validatedData.billing_ref_no || null,
      transfer_ref_no: validatedData.transfer_ref_no || null,
      qr_txn_ref_no: validatedData.qr_txn_ref_no || null,
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
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'sales',
        action: 'create_sale',
        entityType: 'sales_transaction',
        branch,
        status: 'failed',
        sourceSystem: 'supabase',
        metadata: {
          error: error.message,
          invoice,
        },
      });
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
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'sales',
        action: 'create_sale',
        entityType: 'sales_transaction',
        entityId: sale.id,
        branch,
        status: 'failed',
        sourceSystem: 'supabase',
        metadata: {
          error: itemsError.message,
          invoice,
        },
      });
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

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'sales',
      action: 'create_sale',
      entityType: 'sales_transaction',
      entityId: sale.id,
      branch,
      status: 'success',
      referenceNo: sale.invoice,
      sourceSystem: 'supabase',
      metadata: {
        invoice: sale.invoice,
        total: Number(sale.grand_total ?? sale.subtotal_amount ?? 0),
        itemCount: saleItems.length,
        paymentMethod: sale.payment_method,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/sales:', error);
    return NextResponse.json({ error: 'Failed to create sale' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authorization
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canAccessSalesRoutes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only Admin and Main Admin can delete sales
    if (role !== 'Admin' && role !== 'Main Admin') {
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'sales',
        action: 'delete_sale',
        entityType: 'sales_transaction',
        status: 'denied',
        sourceSystem: 'supabase',
      });
      return NextResponse.json({ error: 'Unauthorized - only admin can delete sales' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    let branch: string | null = searchParams.get('branch');
    const reason = searchParams.get('reason');
    const referenceNo = searchParams.get('referenceNo');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Reason is required for delete action' }, { status: 400 });
    }

    // Branch access control
    if (role === 'Admin') {
      branch = currentUser.branch ?? null; // Admin can only delete from their branch
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
    if (role === 'Admin' && sale.branch !== currentUser.branch) {
      return NextResponse.json({ error: 'You cannot delete sales from other branches' }, { status: 403 });
    }

    if (branch && branch !== 'all' && sale.branch !== branch) {
      return NextResponse.json({ error: 'Sale does not belong to selected branch' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from(SALES_TABLE).delete().eq('id', id);
    if (error) {
      console.error('Supabase error deleting sale:', error);
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'sales',
        action: 'delete_sale',
        entityType: 'sales_transaction',
        entityId: id,
        branch: sale.branch,
        status: 'failed',
        sourceSystem: 'supabase',
        metadata: {
          error: error.message,
        },
      });
      return NextResponse.json({ error: 'Failed to delete sale' }, { status: 500 });
    }

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'sales',
      action: 'delete_sale',
      entityType: 'sales_transaction',
      entityId: id,
      branch: sale.branch,
      status: 'success',
      reason,
      referenceNo: referenceNo || undefined,
      sourceSystem: 'supabase',
      metadata: {
        deletedBranch: sale.branch,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/sales:', error);
    return NextResponse.json({ error: 'Failed to delete sale' }, { status: 500 });
  }
}