import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';

const INVOICES_TABLE = 'invoices';
const INVOICE_ITEMS_TABLE = 'invoice_items';

interface ImportInvoice {
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  customer_id: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_status: 'UNPAID' | 'PARTIAL' | 'PAID';
  amount_paid: number;
  items?: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total?: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    
    // Only Admin and Main Admin can import
    if (role !== 'Admin' && role !== 'Main Admin') {
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'invoices',
        action: 'batch_import',
        entityType: 'invoice',
        status: 'denied',
        sourceSystem: 'supabase',
      });
      return NextResponse.json({ error: 'Unauthorized - only admin can import invoices' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const body = await request.json();
    const { invoices, dryRun = false } = body;

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json({ error: 'No invoices provided' }, { status: 400 });
    }

    // Validate each invoice
    const validationErrors: Array<{ index: number; errors: string[] }> = [];
    const validInvoices: (ImportInvoice & { index: number })[] = [];

    invoices.forEach((invoice: any, index: number) => {
      const errors: string[] = [];

      if (!invoice.invoice_no) errors.push('Missing invoice_no');
      if (!invoice.invoice_date) errors.push('Missing invoice_date');
      if (!invoice.due_date) errors.push('Missing due_date');
      if (!invoice.customer_id) errors.push('Missing customer_id');
      if (invoice.total === undefined || invoice.total === null) errors.push('Missing total');
      if (invoice.payment_status && !['UNPAID', 'PARTIAL', 'PAID'].includes(invoice.payment_status)) {
        errors.push('Invalid payment_status');
      }

      if (errors.length > 0) {
        validationErrors.push({ index, errors });
      } else {
        validInvoices.push({
          ...invoice,
          index,
          subtotal: invoice.subtotal || invoice.total,
          tax: invoice.tax || 0,
          amount_paid: invoice.amount_paid || 0,
          payment_status: invoice.payment_status || 'UNPAID'
        });
      }
    });

    // If validation errors, return early
    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: 'Validation failed',
        validationErrors,
        totalErrors: validationErrors.length,
        totalRows: invoices.length
      }, { status: 400 });
    }

    // If dry run, return preview
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'Validation passed',
        totalRows: validInvoices.length,
        preview: validInvoices.slice(0, 10),
        totalToImport: validInvoices.length
      });
    }

    // Perform actual import
    let successCount = 0;
    let errorCount = 0;
    const importedIds: string[] = [];

    for (const invoice of validInvoices) {
      try {
        const balanceDue = invoice.total - (invoice.amount_paid || 0);

        const { data: newInvoice, error: invoiceError } = await supabaseAdmin
          .from(INVOICES_TABLE)
          .insert({
            invoice_no: invoice.invoice_no,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            branch: currentUser.branch || 'IMPORT',
            customer_id: invoice.customer_id,
            subtotal: invoice.subtotal,
            tax: invoice.tax,
            discount: 0,
            total: invoice.total,
            payment_status: invoice.payment_status,
            amount_paid: invoice.amount_paid,
            balance_due: balanceDue,
            notes: 'Imported from legacy system',
            created_at: invoice.invoice_date
          })
          .select()
          .single();

        if (invoiceError) {
          console.error(`Error importing invoice ${invoice.invoice_no}:`, invoiceError);
          errorCount++;
          continue;
        }

        if (newInvoice && invoice.items && invoice.items.length > 0) {
          const items = invoice.items.map((item: any) => ({
            invoice_id: newInvoice.id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total || (item.quantity * item.unit_price),
            created_at: invoice.invoice_date
          }));

          const { error: itemsError } = await supabaseAdmin
            .from(INVOICE_ITEMS_TABLE)
            .insert(items);

          if (itemsError) {
            console.error(`Error importing items for ${invoice.invoice_no}:`, itemsError);
          }
        }

        successCount++;
        importedIds.push(newInvoice.id);
      } catch (err) {
        console.error(`Error processing invoice ${invoice.invoice_no}:`, err);
        errorCount++;
      }
    }

    // Audit log
    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'invoices',
      action: 'batch_import',
      entityType: 'invoice',
      branch: currentUser.branch || 'IMPORT',
      status: 'success',
      sourceSystem: 'supabase',
      metadata: {
        totalRows: validInvoices.length,
        successCount,
        errorCount,
        importedIds: importedIds.slice(0, 10)
      }
    });

    return NextResponse.json({
      success: true,
      message: `Import completed: ${successCount} invoices imported, ${errorCount} failed`,
      successCount,
      errorCount,
      totalRows: validInvoices.length,
      importedInvoiceCount: successCount
    });

  } catch (error) {
    console.error('Error in POST /api/invoices/import:', error);
    return NextResponse.json({ error: 'Failed to import invoices' }, { status: 500 });
  }
}

// GET endpoint untuk download template
export async function GET(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Return CSV template
    const template = `invoice_no,invoice_date,due_date,customer_id,subtotal,tax,total,payment_status,amount_paid
INV-2025-001,2025-01-15,2025-02-15,CUST-001,500.00,50.00,550.00,PAID,550.00
INV-2025-002,2025-01-20,2025-02-20,CUST-002,1000.00,100.00,1100.00,PARTIAL,600.00
INV-2025-003,2025-02-01,2025-03-01,CUST-003,750.00,75.00,825.00,UNPAID,0.00`;

    return new Response(template, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="invoice-import-template.csv"'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/invoices/import:', error);
    return NextResponse.json({ error: 'Failed to get template' }, { status: 500 });
  }
}
