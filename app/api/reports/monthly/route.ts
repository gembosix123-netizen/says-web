import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Helper: Get current user from session
async function getCurrentUser(request: Request) {
  try {
    const session = (request as any).cookies.get('session');
    if (!session) return null;
    const data = JSON.parse(session.value);
    return data;
  } catch (e) {
    return null;
  }
}

// Helper: Get sales table by branch
function getSalesTable(branch: string) {
  if (branch === 'Kinabatangan') return 'sales_kinabatangan';
  return 'sales_kota_kinabalu';
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM
    const startDate = searchParams.get('startDate'); // For date range
    const endDate = searchParams.get('endDate'); // For date range
    let branch = searchParams.get('branch') || 'all';

    // Admin can only see their own branch
    if (currentUser.role === 'Admin') {
      branch = currentUser.branch;
    }

    if (!month && !startDate) {
      return NextResponse.json({ error: 'Missing month or date range parameter' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Determine which tables to query
    const tables = [];
    if (branch === 'all') {
      tables.push('sales_kota_kinabalu', 'sales_kinabatangan');
    } else {
      tables.push(getSalesTable(branch));
    }

    // Determine date range
    let dateStart = `${month}-01T00:00:00Z`;
    let dateEnd = `${month}-31T23:59:59Z`;

    if (startDate && endDate) {
      dateStart = `${startDate}T00:00:00Z`;
      dateEnd = `${endDate}T23:59:59Z`;
    }

    // Fetch sales data for the month
    let allSales: any[] = [];
    for (const table of tables) {
      const { data: sales, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd);

      if (error) {
        console.error(`Error fetching from ${table}:`, error);
        continue;
      }

      allSales = allSales.concat(sales || []);
    }

    // Process data for report
    const dailyData: Record<string, any> = {};
    const branchData: Record<string, any> = {};
    const productData: Record<string, number> = {};

    allSales.forEach((sale) => {
      const date = sale.created_at?.split('T')[0] || 'unknown';
      const branchName = sale.branch || 'Unknown';
      const amount = parseFloat(sale.amount || sale.total_amount || 0);

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

      // Product data
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const productName = item.name || 'Unknown Product';
          productData[productName] = (productData[productName] || 0) + (item.quantity || 1);
        });
      } else if (sale.item_name) {
        productData[sale.item_name] = (productData[sale.item_name] || 0) + 1;
      }
    });

    // Calculate summary
    const totalRevenue = Object.values(dailyData).reduce((sum, d: any) => sum + d.amount, 0);
    const totalTransactions = allSales.length;

    // Branch summaries with avg
    const branchSummaries = Object.values(branchData).map((b: any) => ({
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
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .slice(0, 31);

    const report = {
      month: month || `${startDate} to ${endDate}`,
      totalRevenue,
      totalTransactions,
      dailyData: dailyDataArray,
      branchSummaries,
      topProducts,
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error in GET /api/reports/monthly:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}
