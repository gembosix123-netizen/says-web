import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    let branch = searchParams.get('branch') || currentUser.branch;

    // Determine sales table
    const salesTable = branch === 'Kinabatangan' ? 'sales_kinabatangan' : 'sales_kota_kinabalu';

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Fetch all transactions for the day
    const { data: sales, error } = await supabaseAdmin
      .from(salesTable)
      .select('*')
      .gte('created_at', `${date}T00:00:00Z`)
      .lte('created_at', `${date}T23:59:59Z`);

    if (error) {
      console.error('Error fetching sales:', error);
      return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 });
    }

    // Calculate day end summary
    const summary = {
      date,
      branch,
      totalTransactions: sales?.length || 0,
      totalRevenue: 0,
      paymentBreakdown: {
        cash: 0,
        card: 0,
        transfer: 0,
        other: 0,
      },
      salesmanPerformance: {} as Record<string, any>,
      topProducts: [] as Array<{ name: string; quantity: number; revenue: number }>,
      hourlyBreakdown: {} as Record<string, any>,
      discrepancies: [] as Array<any>,
    };

    const productMap: Record<string, { quantity: number; revenue: number }> = {};
    const hourlyMap: Record<string, any> = {};

    sales?.forEach((sale: any) => {
      const amount = parseFloat(sale.amount || sale.total_amount || 0);
      const paymentMethod = (sale.payment_method || 'cash').toLowerCase();

      // Total revenue
      summary.totalRevenue += amount;

      // Payment breakdown
      if (paymentMethod === 'cash') summary.paymentBreakdown.cash += amount;
      else if (paymentMethod === 'card') summary.paymentBreakdown.card += amount;
      else if (paymentMethod === 'transfer') summary.paymentBreakdown.transfer += amount;
      else summary.paymentBreakdown.other += amount;

      // Salesman performance
      const salesman = sale.salesman_name || 'Unknown';
      if (!summary.salesmanPerformance[salesman]) {
        summary.salesmanPerformance[salesman] = {
          name: salesman,
          transactions: 0,
          revenue: 0,
          commission: 0,
          commissionRate: sale.commission_rate || 0.05,
        };
      }
      summary.salesmanPerformance[salesman].transactions += 1;
      summary.salesmanPerformance[salesman].revenue += amount;
      summary.salesmanPerformance[salesman].commission =
        summary.salesmanPerformance[salesman].revenue * summary.salesmanPerformance[salesman].commissionRate;

      // Product tracking
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const productName = item.name || 'Unknown';
          if (!productMap[productName]) {
            productMap[productName] = { quantity: 0, revenue: 0 };
          }
          productMap[productName].quantity += item.quantity || 1;
          productMap[productName].revenue += (item.quantity || 1) * (item.unit_price || 0);
        });
      }

      // Hourly breakdown
      const hour = new Date(sale.created_at).getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      if (!hourlyMap[hourKey]) {
        hourlyMap[hourKey] = { hour: hourKey, transactions: 0, revenue: 0 };
      }
      hourlyMap[hourKey].transactions += 1;
      hourlyMap[hourKey].revenue += amount;
    });

    // Top products
    summary.topProducts = Object.entries(productMap)
      .map(([name, data]) => ({ name, quantity: data.quantity, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Hourly breakdown sorted
    summary.hourlyBreakdown = Object.values(hourlyMap).sort((a: any, b: any) => {
      return parseInt(a.hour) - parseInt(b.hour);
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error in GET /api/day-end/calculate:', error);
    return NextResponse.json({ error: 'Failed to calculate day end' }, { status: 500 });
  }
}
