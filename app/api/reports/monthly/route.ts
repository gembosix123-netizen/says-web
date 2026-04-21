import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest } from '@/lib/session';
import { db } from '@/lib/db';

// Helper: Get current user from session
interface SaleItemRecord {
  name?: string;
  quantity?: number;
}

interface MonthlySaleRecord {
  created_at?: string;
  branch?: string;
  amount?: number | string;
  total_amount?: number | string;
  items?: SaleItemRecord[] | null;
  item_name?: string;
}

interface DailyEntry {
  date: string;
  amount: number;
  transactions: number;
  branch: string;
}

interface BranchEntry {
  branch: string;
  totalRevenue: number;
  transactionCount: number;
}

const SALES_TABLE = 'sales_transactions';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM
    const startDate = searchParams.get('startDate'); // For date range
    const endDate = searchParams.get('endDate'); // For date range
    const useClosedSnapshot = searchParams.get('useClosed') === 'true';
    let branch: string = searchParams.get('branch') || 'all';

    // Admin can only see their own branch
    if (role === 'Admin') {
      branch = currentUser.branch || 'all';
    }

    if (!month && !startDate) {
      return NextResponse.json({ error: 'Missing month or date range parameter' }, { status: 400 });
    }

    if (useClosedSnapshot && month) {
      if (supabaseAdmin) {
        let closedQuery = supabaseAdmin
          .from('monthly_report_history')
          .select('*')
          .eq('month', month)
          .eq('status', 'closed')
          .limit(1);

        if (branch !== 'all') {
          closedQuery = closedQuery.eq('branch', branch);
        }

        const { data: closedRows, error: closedError } = await closedQuery;
        if (!closedError && closedRows && closedRows.length > 0) {
          const closedRow = closedRows[0] as any;
          return NextResponse.json({
            ...closedRow.snapshot,
            month: closedRow.month,
            branch: closedRow.branch,
            isClosed: true,
            submittedAt: closedRow.submitted_at,
            submittedBy: closedRow.submitted_by,
            notes: closedRow.notes || '',
          });
        }
      }

      const localClosedHistory = await db.monthlyReportHistory.getAll();
      const matchingClosed = localClosedHistory.find((entry) => {
        if (entry.month !== month || entry.status !== 'closed') {
          return false;
        }
        return branch === 'all' || entry.branch === branch;
      });

      if (matchingClosed) {
        return NextResponse.json({
          ...matchingClosed.snapshot,
          month: matchingClosed.month,
          branch: matchingClosed.branch,
          isClosed: true,
          submittedAt: matchingClosed.submittedAt,
          submittedBy: matchingClosed.submittedBy,
          notes: matchingClosed.notes || '',
        });
      }
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Determine date range — use last day of month correctly
    const [yr, mo] = (month || '2026-01').split('-').map(Number);
    const lastDay = new Date(yr, mo, 0).getDate(); // day 0 of next month = last day of this month
    let dateStart = `${month}-01T00:00:00Z`;
    let dateEnd = `${month}-${String(lastDay).padStart(2, '0')}T23:59:59Z`;

    if (startDate && endDate) {
      dateStart = `${startDate}T00:00:00Z`;
      dateEnd = `${endDate}T23:59:59Z`;
    }

    // Build query for sales_transactions table
    let query = supabaseAdmin
      .from(SALES_TABLE)
      .select('*')
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd);

    // Filter by branch if specified
    if (branch && branch !== 'all') {
      query = query.eq('branch', branch);
    }

    // Fetch sales data
    const { data: allSales, error } = await query;

    if (error) {
      console.error('Error fetching sales:', error);
      return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 });
    }

    const salesData = allSales || [];

    // Process data for report
    const dailyData: Record<string, DailyEntry> = {};
    const branchData: Record<string, BranchEntry> = {};
    const productData: Record<string, number> = {};

    salesData.forEach((sale: any) => {
      const date = sale.created_at?.split('T')[0] || 'unknown';
      const branchName = sale.branch || 'Unknown';
      const amount = Number(sale.grand_total ?? sale.subtotal_amount ?? sale.amount ?? sale.total_amount ?? 0);

      // Daily data
      if (!dailyData[date]) {
        dailyData[date] = { date, amount: 0, transactions: 0, branch: branchName };
      }
      dailyData[date].amount += amount;
      dailyData[date].transactions += 1;

      // Branch data
      if (!branchData[branchName]) {
        branchData[branchName] = { branch: branchName, totalRevenue: 0, transactionCount: 0 };
      }
      branchData[branchName].totalRevenue += amount;
      branchData[branchName].transactionCount += 1;

      // Product data (if items are embedded in the sale record)
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const productName = item.name || item.product_name || 'Unknown Product';
          productData[productName] = (productData[productName] || 0) + (item.quantity || 1);
        });
      } else if (sale.item_name) {
        productData[sale.item_name] = (productData[sale.item_name] || 0) + 1;
      }
    });

    // Calculate summary
    const totalRevenue = Object.values(dailyData).reduce((sum, d) => sum + d.amount, 0);
    const totalTransactions = salesData.length;

    // Branch summaries with avg
    const branchSummaries = Object.values(branchData).map((b) => ({
      ...b,
      avgTransaction: b.totalRevenue / b.transactionCount,
      topProduct: 'N/A', // Could be enhanced
    }));

    // Top products
    const topProducts = Object.entries(productData)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Daily data sorted by date
    const dailyDataArray = Object.values(dailyData)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 31);

    // Fetch exchange_returns for same period
    let totalReturns = 0;
    let totalReturnQuantity = 0;
    const returnReasonMap: Record<string, number> = {};
    const returnItemsList: { product_name: string; quantity: number; reason: string; created_at: string; salesman?: string }[] = [];

    try {
      let retQuery = supabaseAdmin
        .from('exchange_returns')
        .select('*')
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd);

      if (branch && branch !== 'all') {
        retQuery = retQuery.eq('branch', branch);
      }

      const { data: retData } = await retQuery;
      if (retData && retData.length > 0) {
        totalReturns = retData.length;
        retData.forEach((r: any) => {
          totalReturnQuantity += Number(r.quantity || 0);
          const reason = r.reason || 'Tidak dinyatakan';
          returnReasonMap[reason] = (returnReasonMap[reason] || 0) + 1;
          returnItemsList.push({
            product_name: r.product_name || '-',
            quantity: Number(r.quantity || 0),
            reason,
            created_at: r.created_at || '',
            salesman: r.submitted_by_name || r.submitted_by || '',
          });
        });
      }
    } catch (retErr) {
      console.error('Error fetching returns for report:', retErr);
    }

    const returnsByReason = Object.entries(returnReasonMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const report = {
      month: month || `${startDate} to ${endDate}`,
      branch,
      totalRevenue,
      totalTransactions,
      dailyData: dailyDataArray,
      branchSummaries,
      topProducts,
      totalReturns,
      totalReturnQuantity,
      returnsByReason,
      returnItemsList,
      isClosed: false,
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error in GET /api/reports/monthly:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}
