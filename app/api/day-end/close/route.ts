import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { normalizeRole } from '@/lib/roles';
import { canCloseDayEnd, canViewDayEnd } from '@/lib/permissions';
import { getSessionUserFromRequest } from '@/lib/session';

// ── Generate day-end Excel and save to Storage ──────────────────────────────
async function generateAndSaveDayEndExcel(
  date: string,
  branch: string,
  salesTable: string,
  dayEndId: string
): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    // Sales transactions — filter by branch
    const { data: txRows } = await supabaseAdmin
      .from(salesTable)
      .select('*')
      .eq('branch', branch)
      .gte('created_at', `${date}T00:00:00Z`)
      .lte('created_at', `${date}T23:59:59Z`)
      .order('created_at');
    const transactions = txRows || [];

    // sales_items
    const saleIds = transactions.map((t) => t.id as string);
    let allItems: Array<Record<string, unknown>> = [];
    if (saleIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from('sales_items')
        .select('*')
        .in('transaction_id', saleIds);
      allItems = items || [];
    }

    // Product columns
    const productNames = [...new Set(allItems.map((i) => String(i.product_name || '')).filter(Boolean))].sort();

    // Items map
    const itemsMap: Record<string, Record<string, number>> = {};
    for (const item of allItems) {
      const tid = String(item.transaction_id || '');
      const pn = String(item.product_name || '');
      if (!itemsMap[tid]) itemsMap[tid] = {};
      itemsMap[tid][pn] = (itemsMap[tid][pn] || 0) + Number(item.subtotal || 0);
    }

    // Approved refunds that day
    const { data: returns } = await supabaseAdmin
      .from('exchange_returns')
      .select('*')
      .in('status', ['approved', 'completed'])
      .gte('created_at', `${date}T00:00:00Z`)
      .lte('created_at', `${date}T23:59:59Z`);

    // Approved expenses that day
    const { data: expenses } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .in('status', ['approved', 'paid'])
      .eq('expense_date', date);

    // Customer names — query both branch tables
    const customerIds = [...new Set(transactions.map((t) => t.customer_id).filter(Boolean))] as string[];
    let customersById: Record<string, string> = {};
    if (customerIds.length > 0) {
      const [kbRes, kkRes] = await Promise.all([
        supabaseAdmin.from('customers_kb').select('id,name').in('id', customerIds),
        supabaseAdmin.from('customers_kk').select('id,name').in('id', customerIds),
      ]);
      const allCusts = [...(kbRes.data || []), ...(kkRes.data || [])];
      customersById = allCusts.reduce<Record<string, string>>((acc, c) => { acc[c.id] = c.name; return acc; }, {});
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Transactions
    const hdr = ['DATE', 'INV NO', 'KEDAI', ...productNames, 'AMOUNT (RM)', 'BAYAR', 'BUKTI', 'STATUS'];
    const rows: Array<Array<string | number>> = [
      [`DAY END REPORT — ${date} (${branch})`], [],
      hdr,
    ];
    let totalAmount = 0;
    const prodTotals: Record<string, number> = {};
    for (const tx of transactions) {
      const amount = Number(tx.grand_total || tx.subtotal_amount || 0);
      totalAmount += amount;
      const pCols = productNames.map((pn) => {
        const v = itemsMap[String(tx.id)]?.[pn] || 0;
        prodTotals[pn] = (prodTotals[pn] || 0) + v;
        return v > 0 ? v : '';
      });
      const hasProof = (Array.isArray(tx.proof_photo_urls) && tx.proof_photo_urls.length > 0) || tx.proof_photo_url ? 'ADA' : 'TIADA';
      rows.push([
        new Date(tx.transaction_date || tx.created_at).toLocaleDateString('ms-MY'),
        tx.invoice || tx.receipt_no || '',
        customersById[tx.customer_id] || tx.customer_name || '-',
        ...pCols,
        amount,
        (tx.payment_method || '').toUpperCase(),
        hasProof,
        (tx.status || '').toUpperCase(),
      ]);
    }
    rows.push(['TOTAL (RM)', '', '', ...productNames.map((pn) => prodTotals[pn] || 0), totalAmount, '', '', '']);

    const ws1 = XLSX.utils.aoa_to_sheet(rows);
    ws1['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 26 }, ...productNames.map(() => ({ wch: 12 })), { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'JUALAN');

    // Sheet 2: Refund log (if any)
    if ((returns || []).length > 0) {
      const rRows: Array<Array<string | number>> = [
        [`REFUND LOG — ${date}`], [],
        ['INV', 'KEDAI', 'PRODUK', 'QTY', 'SEBAB', 'STATUS'],
        ...(returns || []).map((r: Record<string, unknown>) => [
          String(r.invoice || '-'),
          customersById[String(r.customer_id || '')] || '-',
          String(r.product_name || ''),
          Number(r.quantity || 0),
          String(r.reason || ''),
          String(r.status || '').toUpperCase(),
        ]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(rRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'REFUND');
    }

    // Sheet 3: Expenses (if any)
    if ((expenses || []).length > 0) {
      const totalExp = (expenses || []).reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount || 0), 0);
      const eRows: Array<Array<string | number>> = [
        [`EXPENSES — ${date}`], [],
        ['STAFF', 'KATEGORI', 'KETERANGAN', 'AMOUNT (RM)'],
        ...(expenses || []).map((e: Record<string, unknown>) => [
          String(e.salesman_name || ''),
          String(e.category || ''),
          String(e.description || '-'),
          Number(e.amount || 0),
        ]),
        [], ['TOTAL', '', '', totalExp],
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(eRows);
      XLSX.utils.book_append_sheet(wb, ws3, 'EXPENSES');
    }

    const buf: Buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const fileName = `day-end/${date}_${branch.replace(/\s/g, '_')}_${dayEndId}.xlsx`;

    // Try upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('day-end-reports')
      .upload(fileName, buf, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: true });

    if (uploadError) {
      console.error('Storage upload failed (non-fatal):', uploadError.message);
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage.from('day-end-reports').getPublicUrl(fileName);
    const publicUrl = urlData?.publicUrl || null;

    // Save record to day_end_report_files if table exists
    await supabaseAdmin.from('day_end_report_files').insert([{
      day_end_id: dayEndId,
      date,
      branch,
      file_url: publicUrl,
      file_name: fileName,
      created_by: null,
    }]).select();

    return publicUrl;
  } catch (err) {
    console.error('generateAndSaveDayEndExcel error (non-fatal):', err);
    return null;
  }
}

// All sales live in sales_transactions — use branch filter instead of split tables
function resolveSalesTable(_branch: string) {
  return 'sales_transactions';
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    const role = normalizeRole(currentUser?.role);
    if (!currentUser || !canViewDayEnd(role)) {
      return NextResponse.json({ error: 'Only Admin/Main Admin can access day end status' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    // Admin can only view day-end status for their own branch
    const branch = role === 'Admin'
      ? (currentUser.branch ?? searchParams.get('branch'))
      : (searchParams.get('branch') || currentUser.branch);

    if (!date || !branch) {
      return NextResponse.json({ error: 'Missing required query params' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('day_end_closings')
      .select('*')
      .eq('date', date)
      .eq('branch', branch)
      .eq('status', 'closed')
      .order('closedAt', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching day end status:', error);
      return NextResponse.json({ error: 'Failed to check day end status' }, { status: 500 });
    }

    const record = data?.[0] || null;

    return NextResponse.json({
      closed: Boolean(record),
      record,
    });
  } catch (error) {
    console.error('Error in GET /api/day-end/close:', error);
    return NextResponse.json({ error: 'Failed to check day end status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    const role = normalizeRole(currentUser?.role);
    if (!currentUser || !canCloseDayEnd(role)) {
      await logAuditEvent({
        request,
        module: 'day_end',
        action: 'close_day_end',
        entityType: 'day_end_closing',
        status: 'denied',
        sourceSystem: 'supabase',
        metadata: {
          reason: 'Only Admin/Main Admin can perform day end',
        },
      });
      return NextResponse.json({ error: 'Only Admin/Main Admin can perform day end' }, { status: 403 });
    }

    const body = await request.json();
    const { date, cashCount, reconciliationNotes, discrepancies, referenceNo } = body;
    // Admin can only close day-end for their own branch
    const branch = role === 'Admin' ? (currentUser.branch ?? body.branch) : body.branch;

    if (!date || !branch) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!reconciliationNotes || !String(reconciliationNotes).trim()) {
      return NextResponse.json({ error: 'Reason is required for day end closing' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Create day end record
    const { data: dayEndRecord, error } = await supabaseAdmin
      .from('day_end_closings')
      .insert([
        {
          date,
          branch,
          closedBy: currentUser.id,
          closedAt: new Date().toISOString(),
          cashCount,
          reconciliationNotes,
          discrepancies: discrepancies || [],
          status: 'closed',
        },
      ])
      .select();

    if (error) {
      console.error('Error creating day end record:', error);
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'day_end',
        action: 'close_day_end',
        entityType: 'day_end_closing',
        branch,
        status: 'failed',
        reason: reconciliationNotes || null,
        sourceSystem: 'supabase',
        metadata: {
          date,
          error: error.message,
        },
      });
      return NextResponse.json({ error: 'Failed to save day end closing' }, { status: 500 });
    }

    const salesTable = resolveSalesTable(branch);

    // Lock all transactions for that day by branch
    const { error: lockError } = await supabaseAdmin
      .from(salesTable)
      .update({ is_locked: true })
      .eq('branch', branch)
      .gte('created_at', `${date}T00:00:00Z`)
      .lte('created_at', `${date}T23:59:59Z`);

    if (lockError) {
      console.error('Error locking transactions:', lockError);
    }

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'day_end',
      action: 'close_day_end',
      entityType: 'day_end_closing',
      entityId: dayEndRecord?.[0]?.id,
      branch,
      status: 'success',
      reason: reconciliationNotes || null,
      referenceNo: referenceNo || date,
      sourceSystem: 'supabase',
      metadata: {
        date,
        salesTable,
        cashCount,
        discrepancyCount: Array.isArray(discrepancies) ? discrepancies.length : 0,
      },
    });

    // Auto-generate & save Excel report (non-blocking)
    const newDayEndId = String(dayEndRecord?.[0]?.id || '');
    const excelUrl = await generateAndSaveDayEndExcel(date, branch, salesTable, newDayEndId);

    return NextResponse.json({
      success: true,
      message: 'Day end closing completed',
      record: dayEndRecord?.[0],
      excelUrl,
    });
  } catch (error) {
    console.error('Error in POST /api/day-end/close:', error);
    return NextResponse.json({ error: 'Failed to close day end' }, { status: 500 });
  }
}
