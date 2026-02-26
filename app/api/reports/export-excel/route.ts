import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

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

// Helper: Get current user from session
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

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { month, branch, reportData } = body as { month: string; branch: string; reportData: ExportReportData };

    if (!month || !reportData) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

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
