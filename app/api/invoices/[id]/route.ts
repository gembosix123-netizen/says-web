import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';

const INVOICES_TABLE = 'invoices';
const INVOICE_ITEMS_TABLE = 'invoice_items';
const CUSTOMERS_TABLE = 'customers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 });
    }

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from(INVOICES_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check access control
    if (role === 'Admin' && invoice.branch !== currentUser.branch) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch invoice items
    const { data: items } = await supabaseAdmin
      .from(INVOICE_ITEMS_TABLE)
      .select('*')
      .eq('invoice_id', id)
      .order('created_at', { ascending: true });

    // Fetch customer
    let customer = null;
    if (invoice.customer_id) {
      const { data: customerData } = await supabaseAdmin
        .from(CUSTOMERS_TABLE)
        .select('*')
        .eq('id', invoice.customer_id)
        .single();
      
      customer = customerData;
    }

    return NextResponse.json({
      id: invoice.id,
      invoiceNo: invoice.invoice_no,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      branch: invoice.branch,
      customer: customer ? {
        id: customer.id,
        code: customer.customer_code,
        name: customer.name,
        iNumber: customer.ic_number,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        postcode: customer.postcode,
        phone: customer.phone,
        email: customer.email,
        creditLimit: customer.credit_limit,
        paymentTerms: customer.payment_terms
      } : null,
      poNumber: invoice.po_number,
      salesPerson: invoice.sales_person,
      items: (items || []).map((item: any) => ({
        id: item.id,
        productCode: item.product_code,
        productName: item.product_name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        discountPercent: Number(item.discount_percent || 0),
        discountAmount: Number(item.discount_amount || 0),
        taxPercent: Number(item.tax_percent || 0),
        taxAmount: Number(item.tax_amount || 0),
        lineTotal: Number(item.line_total),
        notes: item.notes
      })),
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      paymentStatus: invoice.payment_status,
      amountPaid: Number(invoice.amount_paid),
      balanceDue: Number(invoice.balance_due),
      notes: invoice.notes,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at
    });

  } catch (error) {
    console.error('Error in GET /api/invoices/[id]:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    
    if (role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { id } = await params;
    const body = await request.json();

    // Fetch invoice to verify access
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from(INVOICES_TABLE)
      .select('branch')
      .eq('id', id)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (role === 'Admin' && invoice.branch !== currentUser.branch) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { due_date, po_number, notes } = body;
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (due_date) updateData.due_date = due_date;
    if (po_number !== undefined) updateData.po_number = po_number;
    if (notes !== undefined) updateData.notes = notes;

    const { error: updateError } = await supabaseAdmin
      .from(INVOICES_TABLE)
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in PUT /api/invoices/[id]:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}
