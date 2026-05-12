import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { generateUniqueInvoiceNo } from '@/lib/invoiceNumbers';

const INVOICES_TABLE = 'invoices';
const INVOICE_ITEMS_TABLE = 'invoice_items';
const CUSTOMERS_TABLE = 'customers';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    let branch: string | null = searchParams.get('branch');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');

    // Branch access control
    if (role === 'Admin') {
      branch = currentUser.branch ?? null;
    } else if (role === 'Sales') {
      branch = currentUser.branch ?? null;
    }

    // Only Main Admin can fetch all branches
    if ((!branch || branch === 'all') && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized - only Main Admin can view all invoices' }, { status: 403 });
    }

    let query = supabaseAdmin
      .from(INVOICES_TABLE)
      .select('*')
      .order('invoice_date', { ascending: false });

    if (branch && branch !== 'all') {
      query = query.eq('branch', branch);
    }

    if (status) {
      query = query.eq('payment_status', status);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data: invoicesRows, error: invoicesError } = await query;

    if (invoicesError) {
      console.error('Supabase error fetching invoices:', invoicesError);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    const invoices = invoicesRows || [];
    const invoiceIds = invoices.map((inv) => inv.id);
    const customerIds = Array.from(new Set(invoices.map((inv) => inv.customer_id).filter(Boolean)));

    let itemsByInvoiceId: Record<string, Array<Record<string, unknown>>> = {};
    if (invoiceIds.length > 0) {
      const { data: itemsRows } = await supabaseAdmin
        .from(INVOICE_ITEMS_TABLE)
        .select('*')
        .in('invoice_id', invoiceIds);

      itemsByInvoiceId = (itemsRows || []).reduce<Record<string, Array<Record<string, unknown>>>>((acc, item) => {
        const invoiceId = item.invoice_id;
        if (!acc[invoiceId]) acc[invoiceId] = [];
        acc[invoiceId].push({
          id: item.id,
          productCode: item.product_code,
          productName: item.product_name,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unit_price || 0),
          discountPercent: Number(item.discount_percent || 0),
          discountAmount: Number(item.discount_amount || 0),
          taxPercent: Number(item.tax_percent || 0),
          taxAmount: Number(item.tax_amount || 0),
          lineTotal: Number(item.line_total || 0),
          notes: item.notes
        });
        return acc;
      }, {});
    }

    let customersById: Record<string, any> = {};
    if (customerIds.length > 0) {
      const { data: customerRows } = await supabaseAdmin
        .from(CUSTOMERS_TABLE)
        .select('id,name,customer_code,address,phone,email')
        .in('id', customerIds);

      customersById = (customerRows || []).reduce<Record<string, any>>((acc, customer) => {
        acc[customer.id] = customer;
        return acc;
      }, {});
    }

    const result = invoices.map((invoice) => {
      const items = itemsByInvoiceId[invoice.id] || [];
      const customer = customersById[invoice.customer_id] || null;

      return {
        id: invoice.id,
        invoiceNo: invoice.invoice_no,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        branch: invoice.branch,
        customer: customer ? {
          id: customer.id,
          code: customer.customer_code,
          name: customer.name,
          address: customer.address,
          phone: customer.phone,
          email: customer.email
        } : null,
        poNumber: invoice.po_number,
        salesPerson: invoice.sales_person,
        items,
        subtotal: Number(invoice.subtotal || 0),
        discount: Number(invoice.discount || 0),
        tax: Number(invoice.tax || 0),
        total: Number(invoice.total || 0),
        paymentStatus: invoice.payment_status,
        amountPaid: Number(invoice.amount_paid || 0),
        balanceDue: Number(invoice.balance_due || 0),
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    
    // Only Sales and Admin can create invoices
    if (role !== 'Sales' && role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const body = await request.json();
    let branch: string = String(body.branch || currentUser.branch || '');

    // Ensure user can only create invoices for their own branch
    if (role === 'Sales' || role === 'Admin') {
      branch = currentUser.branch ?? branch;
    }

    const {
      customer_id,
      invoice_date,
      due_date,
      po_number,
      items,
      notes
    } = body;

    if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const invoiceNo = await generateUniqueInvoiceNo(supabaseAdmin, branch);

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => {
      const lineTotal = (item.quantity * item.unit_price) - (item.discount_amount || 0);
      return sum + lineTotal;
    }, 0);

    const totalTax = items.reduce((sum: number, item: any) => sum + (item.tax_amount || 0), 0);
    const total = subtotal + totalTax;

    const invoiceData = {
      invoice_no: invoiceNo,
      invoice_date: invoice_date || new Date().toISOString(),
      due_date: due_date,
      branch,
      customer_id,
      po_number: po_number || null,
      sales_person: currentUser.name || currentUser.username || null,
      subtotal,
      discount: 0,
      tax: totalTax,
      total,
      payment_status: 'UNPAID',
      amount_paid: 0,
      balance_due: total,
      notes: notes || null,
      created_at: new Date().toISOString()
    };

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from(INVOICES_TABLE)
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError) {
      console.error('Supabase error creating invoice:', invoiceError);
      return NextResponse.json({ error: 'Failed to create invoice', details: invoiceError.message }, { status: 500 });
    }

    const invoiceItems = items.map((item: any) => ({
      invoice_id: invoice.id,
      product_code: item.product_code || null,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent || 0,
      discount_amount: item.discount_amount || 0,
      tax_percent: item.tax_percent || 0,
      tax_amount: item.tax_amount || 0,
      line_total: (item.quantity * item.unit_price) - (item.discount_amount || 0) + (item.tax_amount || 0),
      notes: item.notes || null,
      created_at: new Date().toISOString()
    }));

    const { error: itemsError } = await supabaseAdmin
      .from(INVOICE_ITEMS_TABLE)
      .insert(invoiceItems);

    if (itemsError) {
      console.error('Supabase error inserting invoice items:', itemsError);
      await supabaseAdmin.from(INVOICES_TABLE).delete().eq('id', invoice.id);
      return NextResponse.json({ error: 'Failed to create invoice items', details: itemsError.message }, { status: 500 });
    }

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'invoices',
      action: 'create_invoice',
      entityType: 'invoice',
      entityId: invoice.id,
      branch,
      status: 'success',
      referenceNo: invoiceNo,
      sourceSystem: 'supabase',
      metadata: {
        invoiceNo,
        total,
        itemCount: items.length,
        customerId: customer_id
      }
    });

    return NextResponse.json({
      id: invoice.id,
      invoiceNo: invoice.invoice_no,
      total: invoice.total,
      status: invoice.payment_status
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/invoices:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
