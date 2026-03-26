import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { db } from '@/lib/db';
import { createSaleSchema } from '@/lib/validations';
import { logAuditEvent } from '@/lib/audit';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { canAccessSalesRoutes } from '@/lib/permissions';
import { getCustomersTableByBranch, type Branch } from '@/lib/branchPermissions';
import { VanInventory } from '@/types';

const SALES_TABLE = 'sales_transactions';
const SALES_ITEMS_TABLE = 'sales_items';

function toSafeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBranchCode(branch = 'XX') {
  const compact = branch
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  if (!compact) return 'XX';

  const parts = compact.split(/\s+/).filter(Boolean);
  const initials = parts.map((part) => part[0]).join('').slice(0, 4);
  return initials || compact.slice(0, 4);
}

function generateDocumentNumber(prefix: string, branch: string) {
  const branchCode = normalizeBranchCode(branch);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const timestamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${prefix}-${branchCode}-${today}-${timestamp}-${rand}`;
}

async function generateUniqueCashReceiptNo(branch: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateDocumentNumber('RCPT', branch);

    const { data, error } = await supabaseAdmin!
      .from(SALES_TABLE)
      .select('id')
      .eq('receipt_no', candidate)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to validate receipt number uniqueness: ${error.message}`);
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error('Gagal menjana nombor resit unik. Sila cuba lagi.');
}

async function restoreVanInventory(inventoryId: string, previousItems: Record<string, number>, userId: string) {
  await db.vanInventories.save({
    id: inventoryId,
    userId,
    items: previousItems,
    lastUpdated: new Date().toISOString(),
  });
}

function normalizeProofPhotoUrls(value: unknown, fallback?: string | null) {
  const urls: string[] = [];

  if (Array.isArray(value)) {
    urls.push(...value.map((item) => String(item || '').trim()).filter(Boolean));
  } else if (typeof value === 'string' && value.trim()) {
    const raw = value.trim();

    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          urls.push(...parsed.map((item) => String(item || '').trim()).filter(Boolean));
        }
      } catch {
        urls.push(raw);
      }
    } else {
      urls.push(raw);
    }
  }

  if (fallback && fallback.trim()) {
    urls.unshift(fallback.trim());
  }

  return Array.from(new Set(urls.filter(Boolean))).slice(0, 4);
}

function generateInvoice(branchCode = 'XX') {
  return generateDocumentNumber('INV', branchCode);
}

function generatePaymentReference(paymentMethod: string, branch: string) {
  const prefixMap: Record<string, string> = {
    bill_to_bill: 'B2B',
    bank_transfer: 'TRF',
    qr_code: 'QR',
  };

  const prefix = prefixMap[paymentMethod];
  return prefix ? generateDocumentNumber(prefix, branch) : null;
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
      const customersTable = getCustomersTableByBranch(currentUser.branch as Branch | undefined);
      const { data: customerRows } = await supabaseAdmin
        .from(customersTable)
        .select('id,name')
        .in('id', customerIds);

      customersById = (customerRows || []).reduce<Record<string, string>>((acc, customer) => {
        acc[customer.id] = customer.name;
        return acc;
      }, {});
    }

    let usersById: Record<string, string> = {};
    if (userIds.length > 0) {
      const selectCandidates = [
        'id,name,full_name,username',
        'id,name,username',
        'id,full_name,username',
      ];

      let userRows: Array<Record<string, unknown>> = [];
      let lastUserError: { message?: string } | null = null;

      for (const selectClause of selectCandidates) {
        const { data, error } = await supabaseAdmin
          .from('users')
          .select(selectClause)
          .in('id', userIds);

        if (!error) {
          userRows = (data as unknown as Array<Record<string, unknown>> | null) || [];
          lastUserError = null;
          break;
        }

        lastUserError = error;
      }

      if (lastUserError) {
        console.error('Supabase error fetching sales users:', lastUserError);
      }

      usersById = userRows.reduce<Record<string, string>>((acc, user) => {
        const userId = String(user.id || '');
        if (!userId) return acc;

        const resolvedName =
          String(user.name || '').trim() ||
          String(user.full_name || '').trim() ||
          String(user.username || '').trim();

        if (resolvedName) {
          acc[userId] = resolvedName;
        }

        return acc;
      }, {});
    }

    const transactions = salesAll.map((sale) => {
      const items = itemsBySaleId[sale.id] || [];
      const total = Number(sale.grand_total ?? sale.subtotal_amount ?? 0);
      const paymentStatus = sale.status === 'pending' ? 'pending' : 'paid';
      const paymentReferenceNo =
        sale.billing_ref_no ||
        sale.transfer_ref_no ||
        sale.qr_txn_ref_no ||
        null;
      const proofPhotoUrls = normalizeProofPhotoUrls(
        sale.proof_photo_urls,
        sale.proof_photo_url || sale.receipt_url || null
      );

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
        salesmanName:
          usersById[sale.user_id] ||
          sale.salesman_name ||
          sale.user_name ||
          null,
        payment: { method: sale.payment_method || 'cash', amount: total },
        payment_method: sale.payment_method || 'cash',
        receiptNo: sale.receipt_no || null,
        billingRefNo: sale.billing_ref_no || null,
        transferRefNo: sale.transfer_ref_no || null,
        qrTxnRefNo: sale.qr_txn_ref_no || null,
        paymentReferenceNo,
        receiptUrl: sale.receipt_url || proofPhotoUrls[0] || null,
        proofPhotoUrl: proofPhotoUrls[0] || null,
        proofPhotoUrls: proofPhotoUrls.length > 0 ? proofPhotoUrls : null,
        notes: sale.notes || null,
        transactionDate: sale.transaction_date || sale.created_at || null,
        updatedAt: sale.updated_at || null
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

    const invoice = validatedData.invoice?.trim() || generateInvoice(branch);
    const isCredit = validatedData.payment_method === 'bill_to_bill';
    const requestedQuantities = validatedData.items.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = (acc[item.productId] || 0) + Number(item.quantity || 0);
      return acc;
    }, {});
    const inventoryId = `van_${currentUser.id}`;
    const currentVanInventory = (await db.vanInventories.getById(inventoryId)) as VanInventory | null;
    const vanItems = Object.entries(currentVanInventory?.items || {}).reduce<Record<string, number>>((acc, [productId, quantity]) => {
      acc[productId] = toSafeNumber(quantity);
      return acc;
    }, {});

    const resolvedBillingRefNo = validatedData.payment_method === 'bill_to_bill'
      ? validatedData.billing_ref_no?.trim() || generatePaymentReference('bill_to_bill', validatedData.branch)
      : null;
    const resolvedTransferRefNo = validatedData.payment_method === 'bank_transfer'
      ? validatedData.transfer_ref_no?.trim() || generatePaymentReference('bank_transfer', validatedData.branch)
      : null;
    const resolvedQrTxnRefNo = validatedData.payment_method === 'qr_code'
      ? validatedData.qr_txn_ref_no?.trim() || generatePaymentReference('qr_code', validatedData.branch)
      : null;
    const normalizedProofPhotoUrls = normalizeProofPhotoUrls(
      validatedData.proof_photo_urls,
      validatedData.proof_photo_url || validatedData.receipt_url || null
    );
    const primaryProofPhotoUrl = normalizedProofPhotoUrls[0] || null;
    const resolvedReceiptUrl = validatedData.receipt_url?.trim() || primaryProofPhotoUrl;

    const vanStockErrors: string[] = [];
    for (const item of validatedData.items) {
      const availableVanStock = vanItems[item.productId] || 0;
      if (item.quantity > availableVanStock) {
        vanStockErrors.push(`${item.name}: stok van tidak mencukupi. Baki semasa ${availableVanStock}, diminta ${item.quantity}`);
      }
    }

    if (vanStockErrors.length > 0) {
      return NextResponse.json(
        { error: 'Stok van tidak mencukupi untuk meneruskan jualan', details: vanStockErrors },
        { status: 409 }
      );
    }

    const resolvedReceiptNo = validatedData.payment_method === 'cash'
      ? await generateUniqueCashReceiptNo(validatedData.branch)
      : null;
    const nextVanItems = { ...vanItems };

    for (const [productId, requestedQty] of Object.entries(requestedQuantities)) {
      nextVanItems[productId] = Math.max(0, (nextVanItems[productId] || 0) - requestedQty);
    }

    await db.vanInventories.save({
      id: inventoryId,
      userId: currentUser.id,
      items: nextVanItems,
      lastUpdated: new Date().toISOString(),
    });


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
      receipt_no: resolvedReceiptNo,
      billing_ref_no: resolvedBillingRefNo,
      transfer_ref_no: resolvedTransferRefNo,
      qr_txn_ref_no: resolvedQrTxnRefNo,
      receipt_url: resolvedReceiptUrl,
      proof_photo_url: primaryProofPhotoUrl,
      proof_photo_urls: normalizedProofPhotoUrls.length > 0 ? normalizedProofPhotoUrls : null,
      status: isCredit ? 'pending' : 'completed',
      notes: validatedData.notes || null,
      created_at: new Date().toISOString()
    };

    const insertPayload: Record<string, unknown> = { ...saleData };
    let sale: Record<string, any> | null = null;
    let error: { message?: string } | null = null;

    // Backward-compatible fallback: some deployments may not have all optional columns yet.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const insertResult = await supabaseAdmin
        .from(SALES_TABLE)
        .insert(insertPayload)
        .select()
        .single();

      sale = (insertResult.data as Record<string, any> | null) || null;
      error = insertResult.error;

      if (!error) {
        break;
      }

      const missingColumnMatch = /Could not find the '([^']+)' column/i.exec(String(error.message || ''));
      if (!missingColumnMatch) {
        break;
      }

      const missingColumn = missingColumnMatch[1];
      if (!(missingColumn in insertPayload)) {
        break;
      }

      delete insertPayload[missingColumn];
      console.warn(`[sales] Missing optional column '${missingColumn}', retrying insert without it.`);
    }

    if (error) {
      await restoreVanInventory(inventoryId, vanItems, currentUser.id);
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

    if (!sale) {
      await restoreVanInventory(inventoryId, vanItems, currentUser.id);
      return NextResponse.json({ error: 'Failed to create sale' }, { status: 500 });
    }

    const createdSale = sale;

    const saleItems = validatedData.items.map((item) => ({
      transaction_id: createdSale.id,
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
      await supabaseAdmin.from(SALES_TABLE).delete().eq('id', createdSale.id);
      await restoreVanInventory(inventoryId, vanItems, currentUser.id);
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'sales',
        action: 'create_sale',
        entityType: 'sales_transaction',
        entityId: createdSale.id,
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
        const customersTable = getCustomersTableByBranch(currentUser.branch as Branch | undefined);
        // Get current outstanding balance
        const { data: customer } = await supabaseAdmin
          .from(customersTable)
          .select('current_balance')
          .eq('id', body.customer_id)
          .single();

        const currentBalance = Number(customer?.current_balance || 0);
        const newBalance = currentBalance + validatedData.total_amount;

        // Update customer's outstanding balance
        await supabaseAdmin
          .from(customersTable)
          .update({ current_balance: newBalance })
          .eq('id', body.customer_id);
          
        console.log(`Updated customer ${body.customer_id} outstanding: ${currentBalance} -> ${newBalance}`);
      } catch (updateErr) {
        console.error('Failed to update customer outstanding balance:', updateErr);
        // Don't fail the sale, just log the error
      }
    }

    const transaction = {
      id: createdSale.id,
      invoice: createdSale.invoice,
      total: Number(createdSale.grand_total ?? createdSale.subtotal_amount ?? 0),
      branch: createdSale.branch,
      items: saleItems.map((item) => ({
        productId: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        price: item.unit_price,
        subtotal: item.subtotal
      })),
      status: isCredit ? 'Pending Payment' : 'Completed',
      paymentStatus: createdSale.status === 'pending' ? 'pending' : 'paid',
      createdAt: createdSale.created_at,
      customer: { id: createdSale.customer_id, name: validatedData.customer_name || null },
      salesmanId: createdSale.user_id,
      salesmanName: currentUser.name || currentUser.username || null,
      receiptNo: createdSale.receipt_no || resolvedReceiptNo,
      billingRefNo: createdSale.billing_ref_no || resolvedBillingRefNo,
      transferRefNo: createdSale.transfer_ref_no || resolvedTransferRefNo,
      qrTxnRefNo: createdSale.qr_txn_ref_no || resolvedQrTxnRefNo,
      paymentReferenceNo:
        createdSale.billing_ref_no ||
        createdSale.transfer_ref_no ||
        createdSale.qr_txn_ref_no ||
        resolvedBillingRefNo ||
        resolvedTransferRefNo ||
        resolvedQrTxnRefNo,
      receiptUrl: createdSale.receipt_url || resolvedReceiptUrl || null,
      proofPhotoUrl: normalizeProofPhotoUrls(
        createdSale.proof_photo_urls,
        createdSale.proof_photo_url || resolvedReceiptUrl || null
      )[0] || null,
      proofPhotoUrls: normalizeProofPhotoUrls(
        createdSale.proof_photo_urls,
        createdSale.proof_photo_url || resolvedReceiptUrl || null
      )
    };

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'sales',
      action: 'create_sale',
      entityType: 'sales_transaction',
      entityId: createdSale.id,
      branch,
      status: 'success',
      referenceNo: createdSale.invoice,
      sourceSystem: 'supabase',
      metadata: {
        invoice: createdSale.invoice,
        total: Number(createdSale.grand_total ?? createdSale.subtotal_amount ?? 0),
        itemCount: saleItems.length,
        paymentMethod: createdSale.payment_method,
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