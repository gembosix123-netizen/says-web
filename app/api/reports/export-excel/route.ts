import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest } from '@/lib/session';
import { canExportReports } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

interface ReportProduct {
  name: string;
  quantity: number;
}

interface ReportBranchSummary {
  branch: string;
  totalRevenue: number;
  transactionCount: number;
  avgTransaction: number;
}

interface ReportDailyData {
  date: string;
  amount: number;
  transactions: number;
}

interface ExportReportData {
  totalRevenue: number;
  totalTransactions: number;
  branchSummaries: ReportBranchSummary[];
  topProducts?: ReportProduct[];
  dailyData?: ReportDailyData[];
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function asDateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ms-MY');
}

function extractCustomerFromNotes(notes?: string | null): string {
  const m = String(notes || '').match(/\[Customer:\s*(.*?)\]/i);
  return m?.[1]?.trim() || '';
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canExportReports(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { month, branch, reportData } = body as { month: string; branch: string; reportData: ExportReportData };

    if (!month || !reportData) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Kinabatangan legacy monthly sales-invoice layout (detailed old-system style)
    if (branch === 'Kinabatangan' && supabaseAdmin) {
      const [year, monthNum] = String(month).split('-').map(Number);
      const start = `${month}-01T00:00:00Z`;
      const endDay = new Date(year, monthNum, 0).getDate();
      const end = `${month}-${String(endDay).padStart(2, '0')}T23:59:59Z`;

      const { data: salesRows, error: salesError } = await supabaseAdmin
        .from('sales_transactions')
        .select('id,invoice,transaction_date,created_at,customer_id,customer_name,grand_total,subtotal_amount,status,notes,user_id')
        .eq('branch', 'Kinabatangan')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (salesError) {
        return NextResponse.json({ error: 'Failed to fetch Kinabatangan sales data' }, { status: 500 });
      }

      const sales = salesRows || [];
      const userIds = Array.from(new Set(sales.map((s) => String(s.user_id || '')).filter(Boolean)));
      const customerIds = Array.from(new Set(sales.map((s) => String(s.customer_id || '')).filter(Boolean)));

      const [usersRes, kbRes, kkRes] = await Promise.all([
        userIds.length > 0
          ? supabaseAdmin.from('users').select('id,name,username').in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
        customerIds.length > 0
          ? supabaseAdmin.from('customers_kb').select('id,name').in('id', customerIds)
          : Promise.resolve({ data: [], error: null }),
        customerIds.length > 0
          ? supabaseAdmin.from('customers_kk').select('id,name').in('id', customerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const usersById = Object.fromEntries((usersRes.data || []).map((u: any) => [String(u.id), String(u.name || u.username || '-')])) as Record<string, string>;
      const customersById = Object.fromEntries(
        [...(kbRes.data || []), ...(kkRes.data || [])].map((c: any) => [String(c.id), String(c.name || '-')])
      ) as Record<string, string>;

      const detailedRows: Array<Array<string | number>> = [
        ['Sale Invoice'],
        [],
        ['Date', month],
        ['Status', 'All'],
        ['User', 'All'],
        [],
        ['Date', 'INV#', 'Name', 'Due', 'Sale', 'Discount', 'Tax', 'Total', 'Balance', 'Status', 'By', 'Remark'],
      ];

      sales.forEach((row: any) => {
        const txDateIso = String(row.transaction_date || row.created_at || '');
        const createdIso = String(row.created_at || row.transaction_date || '');
        const total = Number(row.grand_total ?? row.subtotal_amount ?? 0);
        const isUnpaid = String(row.status || '').toLowerCase() === 'pending';
        const customerName = customersById[String(row.customer_id || '')] || String(row.customer_name || '').trim() || extractCustomerFromNotes(row.notes) || '-';

        detailedRows.push([
          asDateLabel(txDateIso),
          String(row.invoice || '-'),
          customerName,
          asDateLabel(addDays(createdIso, 14)),
          total,
          0,
          0,
          total,
          isUnpaid ? total : 0,
          isUnpaid ? 'Unpaid' : 'Paid',
          usersById[String(row.user_id || '')] || '-',
          String(row.notes || '').replace(/\[Customer:.*?\]/i, '').trim(),
        ]);
      });

      const detailedSheet = XLSX.utils.aoa_to_sheet(detailedRows);
      detailedSheet['!cols'] = [
        { wch: 12 },
        { wch: 18 },
        { wch: 34 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 16 },
        { wch: 24 },
      ];

      XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Sale Invoice');

      const fileName = `SalesReport_${month}_Kinabatangan_Legacy.xlsx`;
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    }

    // ============================================================================
    // Sheet 1: SUMMARY
    // ============================================================================
    const summaryData = [
      ['SALES REPORT SUMMARY'],
      [`Month: ${month}`, `Branch: ${branch !== 'all' ? branch : 'All Branches'}`],
      [],
      ['Metric', 'Value'],
      ['Total Revenue', `RM ${reportData.totalRevenue.toFixed(2)}`],
      ['Total Transactions', reportData.totalTransactions],
      ['Average Transaction', `RM ${(reportData.totalRevenue / reportData.totalTransactions || 0).toFixed(2)}`],
      ['Active Branches', reportData.branchSummaries.length],
      [],
      ['Top 5 Products'],
    ];

    // Add top products
    if (reportData.topProducts && reportData.topProducts.length > 0) {
      summaryData.push(['Product Name', 'Quantity Sold']);
      reportData.topProducts.slice(0, 5).forEach((product) => {
        summaryData.push([product.name, product.quantity]);
      });
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // ============================================================================
    // Sheet 2: BRANCH BREAKDOWN
    // ============================================================================
    const branchData: Array<Array<string | number>> = [
      ['BRANCH SUMMARY'],
      [],
      ['Branch', 'Total Revenue (RM)', 'Transactions', 'Avg Transaction (RM)'],
    ];

    reportData.branchSummaries.forEach((branchSummary) => {
      branchData.push([
        branchSummary.branch,
        branchSummary.totalRevenue.toFixed(2),
        branchSummary.transactionCount,
        branchSummary.avgTransaction.toFixed(2),
      ]);
    });

    const branchSheet = XLSX.utils.aoa_to_sheet(branchData);
    branchSheet['!cols'] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 15 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, branchSheet, 'Branch Summary');

    // ============================================================================
    // Sheet 3: DAILY SALES
    // ============================================================================
    const dailyData: Array<Array<string | number>> = [
      ['DAILY SALES TREND'],
      [],
      ['Date', 'Amount (RM)', 'Transactions'],
    ];

    if (reportData.dailyData && reportData.dailyData.length > 0) {
      reportData.dailyData.forEach((day) => {
        dailyData.push([
          day.date,
          day.amount.toFixed(2),
          day.transactions,
        ]);
      });
    }

    const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
    dailySheet['!cols'] = [
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Sales');

    // ============================================================================
    // Generate Excel file
    // ============================================================================
    const fileName = `SalesReport_${month}_${branch}.xlsx`;
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/reports/export-excel:', error);
    return NextResponse.json({ error: 'Failed to export Excel' }, { status: 500 });
  }
}
