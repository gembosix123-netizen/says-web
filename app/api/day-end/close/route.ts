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

    // Lock all transactions for that day (add is_locked flag)
    const { error: lockError } = await supabaseAdmin
      .from('sales_kota_kinabalu')
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
