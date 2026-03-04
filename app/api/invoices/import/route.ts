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
        const {
          invoice_no,
          invoice_date,
          due_date,
          customer_id,
          subtotal,
          discount = 0,
          tax = 0,
          total,
          payment_status = 'UNPAID',
          amount_paid = 0,
          items = [],
          notes = null,
          is_backdate = true,
          backdate_reason = 'Historical data import'
        } = invoiceData;

        // Validate required fields
        if (!invoice_no || !customer_id || !total) {
          results.failed++;
          results.errors.push({
            invoiceNo: invoice_no,
            error: 'Missing required fields: invoice_no, customer_id, total'
          });
          continue;
        }

        // Check if invoice already exists
        const { data: existingInvoice } = await supabaseAdmin
          .from(INVOICES_TABLE)
          .select('id')
          .eq('invoice_no', invoice_no)
          .single();

        if (existingInvoice && !overwrite) {
          results.failed++;
          results.errors.push({
            invoiceNo: invoice_no,
            error: 'Invoice already exists (use overwrite=true to replace)'
          });
          continue;
        }

        const balanceDue = total - amount_paid;

        const invoiceInsertData = {
          invoice_no,
          invoice_date: invoice_date || new Date().toISOString(),
          due_date: due_date || invoice_date,
          branch: '', // Import doesn't have branch info
          customer_id,
          subtotal,
          discount,
          tax,
          total,
          payment_status,
          amount_paid,
          balance_due: balanceDue,
          notes: notes,
          created_at: invoice_date || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        let invoiceId;

        if (existingInvoice && overwrite) {
          // Update existing invoice
          const { error: updateError } = await supabaseAdmin
            .from(INVOICES_TABLE)
            .update(invoiceInsertData)
            .eq('id', existingInvoice.id);

          if (updateError) {
            results.failed++;
            results.errors.push({
              invoiceNo: invoice_no,
              error: updateError.message
            });
            continue;
          }
          invoiceId = existingInvoice.id;
        } else {
          // Insert new invoice
          const { data: newInvoice, error: insertError } = await supabaseAdmin
            .from(INVOICES_TABLE)
            .insert(invoiceInsertData)
            .select('id')
            .single();

          if (insertError || !newInvoice) {
            results.failed++;
            results.errors.push({
              invoiceNo: invoice_no,
              error: insertError?.message || 'Failed to insert invoice'
            });
            continue;
          }
          invoiceId = newInvoice.id;
        }

        // Insert invoice items
        if (items && items.length > 0) {
          const invoiceItems = items.map((item: any) => ({
            invoice_id: invoiceId,
            product_code: item.product_code || null,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent || 0,
            discount_amount: item.discount_amount || 0,
            tax_percent: item.tax_percent || 0,
            tax_amount: item.tax_amount || 0,
            line_total: item.line_total || (item.quantity * item.unit_price),
            notes: item.notes || null,
            created_at: invoice_date || new Date().toISOString()
          }));

          // Delete existing items if overwrite
          if (existingInvoice && overwrite) {
            await supabaseAdmin
              .from(INVOICE_ITEMS_TABLE)
              .delete()
              .eq('invoice_id', invoiceId);
          }

          const { error: itemsError } = await supabaseAdmin
            .from(INVOICE_ITEMS_TABLE)
            .insert(invoiceItems);

          if (itemsError) {
            results.failed++;
            results.errors.push({
              invoiceNo: invoice_no,
              error: `Invoice created but items failed: ${itemsError.message}`
            });
            continue;
          }
        }

        results.successful++;

        // Log the import
        await logAuditEvent({
          request,
          actor: currentUser,
          module: 'invoices',
          action: 'batch_import',
          entityType: 'invoice',
          entityId: invoiceId,
          branch: '',
          status: 'success',
          referenceNo: invoice_no,
          sourceSystem: 'supabase',
          metadata: {
            invoiceNo: invoice_no,
            total,
            itemCount: items.length,
            isBackdate: is_backdate,
            backkdateReason: backdate_reason,
            overwrite: existingInvoice ? true : false
          }
        });

      } catch (err) {
        results.failed++;
        results.errors.push({
          invoiceNo: invoiceData.invoice_no,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    // Log batch import completion
    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'invoices',
      action: 'batch_import_complete',
      entityType: 'invoice',
      status: results.failed === 0 ? 'success' : 'partial',
      sourceSystem: 'supabase',
      metadata: {
        totalCount: invoices.length,
        successCount: results.successful,
        failedCount: results.failed,
        errors: results.errors
      }
    });

    return NextResponse.json(results, { 
      status: results.failed === 0 ? 200 : 207 
    });

  } catch (error) {
    console.error('Error in POST /api/invoices/import:', error);
    return NextResponse.json({ error: 'Failed to import invoices' }, { status: 500 });
  }
}
