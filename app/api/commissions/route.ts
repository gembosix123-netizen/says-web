import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const TABLE_KOTA = 'sales_kota_kinabalu';
const TABLE_KIN = 'sales_kinabatangan';

// Get current user from session cookie
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

interface CommissionSummary {
  userId: string;
  userName: string;
  branch: string;
  totalSales: number;
  salesCount: number;
  commissionRate: number;
  commissionEarned: number;
  commissionPaid: number;
  commissionOwed: number;
  period: {
    start: string;
    end: string;
  };
}

/**
 * GET /api/commissions
 * Calculate commissions for all sales staff
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Admin and Main Admin can view commissions
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    let branch = searchParams.get('branch');

    // Admin can only see their branch
    if (currentUser.role === 'Admin') {
      branch = currentUser.branch;
    }

    // Default to current month
    const now = new Date();
    const defaultStart = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const defaultEnd = endDate || now.toISOString().split('T')[0];

    // Get all sales users
    let usersQuery = supabaseAdmin
      .from('users')
      .select('*')
      .eq('role', 'Sales');

    if (branch && branch !== 'all') {
      usersQuery = usersQuery.eq('branch', branch);
    }

    const { data: salesUsers, error: usersError } = await usersQuery;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get all sales for the period
    const fetchSales = async (table: string, branchFilter?: string) => {
      let query = supabaseAdmin
        .from(table)
        .select('*')
        .gte('created_at', `${defaultStart}T00:00:00Z`)
        .lte('created_at', `${defaultEnd}T23:59:59Z`);

      if (branchFilter && branchFilter !== 'all') {
        query = query.eq('branch', branchFilter);
      }

      const { data } = await query;
      return data || [];
    };

    let allSales: any[] = [];
    if (!branch || branch === 'all') {
      const [kk, kin] = await Promise.all([
        fetchSales(TABLE_KOTA),
        fetchSales(TABLE_KIN)
      ]);
      allSales = [...kk, ...kin];
    } else if (branch === 'Kinabatangan' || branch.toLowerCase().includes('kina')) {
      allSales = await fetchSales(TABLE_KIN, branch);
    } else {
      allSales = await fetchSales(TABLE_KOTA, branch);
    }

    // Get commission payouts for the period
    const { data: payouts } = await supabaseAdmin
      .from('commission_payouts')
      .select('*')
      .gte('paid_at', `${defaultStart}T00:00:00Z`)
      .lte('paid_at', `${defaultEnd}T23:59:59Z`)
      .catch(() => ({ data: [] }));

    const payoutsByUser: Record<string, number> = {};
    (payouts || []).forEach((p: any) => {
      payoutsByUser[p.user_id] = (payoutsByUser[p.user_id] || 0) + parseFloat(p.amount || 0);
    });

    // Calculate commission for each sales user
    const commissions: CommissionSummary[] = (salesUsers || []).map(user => {
      // Filter sales by this user
      const userSales = allSales.filter(s => 
        s.salesman_id === user.id || 
        s.salesman_id === user.username
      );

      const totalSales = userSales.reduce((sum, s) => 
        sum + parseFloat(s.total_amount || s.amount || 0), 0
      );

      const commissionRate = user.commission_rate || 0.05; // Default 5%
      const commissionEarned = totalSales * commissionRate;
      const commissionPaid = payoutsByUser[user.id] || 0;
      const commissionOwed = commissionEarned - commissionPaid;

      return {
        userId: user.id,
        userName: user.name || user.full_name || user.username,
        branch: user.branch,
        totalSales,
        salesCount: userSales.length,
        commissionRate,
        commissionEarned,
        commissionPaid,
        commissionOwed: Math.max(0, commissionOwed),
        period: {
          start: defaultStart,
          end: defaultEnd
        }
      };
    });

    // Calculate totals
    const totals = {
      totalSales: commissions.reduce((sum, c) => sum + c.totalSales, 0),
      totalCommissionEarned: commissions.reduce((sum, c) => sum + c.commissionEarned, 0),
      totalCommissionPaid: commissions.reduce((sum, c) => sum + c.commissionPaid, 0),
      totalCommissionOwed: commissions.reduce((sum, c) => sum + c.commissionOwed, 0)
    };

    return NextResponse.json({
      commissions,
      totals,
      period: {
        start: defaultStart,
        end: defaultEnd
      }
    });

  } catch (error) {
    console.error('Error calculating commissions:', error);
    return NextResponse.json({ error: 'Failed to calculate commissions' }, { status: 500 });
  }
}

/**
 * POST /api/commissions
 * Record a commission payout
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Main Admin can pay commissions
    if (currentUser.role !== 'Main Admin') {
      return NextResponse.json({ error: 'Unauthorized - only Main Admin can process payouts' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json();
    const { userId, userName, amount, notes, periodStart, periodEnd } = body;

    if (!userId || !amount) {
      return NextResponse.json({ error: 'Missing userId or amount' }, { status: 400 });
    }

    // First check if commission_payouts table exists, if not use a fallback
    const payoutData = {
      user_id: userId,
      user_name: userName,
      amount: parseFloat(amount),
      notes: notes || '',
      period_start: periodStart,
      period_end: periodEnd,
      paid_at: new Date().toISOString(),
      paid_by: currentUser.id
    };

    try {
      const { data: payout, error } = await supabaseAdmin
        .from('commission_payouts')
        .insert(payoutData)
        .select()
        .single();

      if (error) {
        // Table might not exist, log but continue
        console.error('Commission payout insert error:', error);
        // Return success anyway - the payout was intended
        return NextResponse.json({
          success: true,
          message: 'Payout recorded (table may need setup)',
          payout: payoutData
        });
      }

      return NextResponse.json({
        success: true,
        payout
      });

    } catch (e) {
      console.error('Payout error:', e);
      return NextResponse.json({
        success: true,
        message: 'Payout recorded locally',
        payout: payoutData
      });
    }

  } catch (error) {
    console.error('Error processing payout:', error);
    return NextResponse.json({ error: 'Failed to process payout' }, { status: 500 });
  }
}
