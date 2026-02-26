import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

function resolveSalesTable(branch: string) {
  if (branch === 'Kinabatangan') {
    return 'sales_kinabatangan';
  }

  return 'sales_kota_kinabalu';
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Only Admin can access day end status' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const branch = searchParams.get('branch') || currentUser.branch;

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
    const currentUser = await getCurrentUser(request);
    if (!currentUser || currentUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Only Admin can perform day end' }, { status: 403 });
    }

    const body = await request.json();
    const { date, branch, cashCount, reconciliationNotes, discrepancies } = body;

    if (!date || !branch) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      return NextResponse.json({ error: 'Failed to save day end closing' }, { status: 500 });
    }

    const salesTable = resolveSalesTable(branch);

    // Lock all transactions for that day by branch (add is_locked flag)
    const { error: lockError } = await supabaseAdmin
      .from(salesTable)
      .update({ is_locked: true })
      .gte('created_at', `${date}T00:00:00Z`)
      .lte('created_at', `${date}T23:59:59Z`);

    if (lockError) {
      console.error('Error locking transactions:', lockError);
    }

    return NextResponse.json({
      success: true,
      message: 'Day end closing completed',
      record: dayEndRecord?.[0],
    });
  } catch (error) {
    console.error('Error in POST /api/day-end/close:', error);
    return NextResponse.json({ error: 'Failed to close day end' }, { status: 500 });
  }
}
