import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { normalizeRole } from '@/lib/roles';
import { canCloseDayEnd, canViewDayEnd } from '@/lib/permissions';
import { getSessionUserFromRequest } from '@/lib/session';

function resolveSalesTable(branch: string) {
  if (branch === 'Kinabatangan') {
    return 'sales_kinabatangan';
  }

  return 'sales_kota_kinabalu';
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
    const { date, branch, cashCount, reconciliationNotes, discrepancies, referenceNo } = body;

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

    // Lock all transactions for that day by branch (add is_locked flag)
    const { error: lockError } = await supabaseAdmin
      .from(salesTable)
      .update({ is_locked: true })
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
