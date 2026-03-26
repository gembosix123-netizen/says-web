import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { MonthlyReportHistory, MonthlyReportSnapshot } from '@/types';

const HISTORY_TABLE = 'monthly_report_history';

function buildHistoryId(month: string, branch: string) {
  const branchKey = branch.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${month}-${branchKey}`;
}

function canManageMonthlyClose(role: string) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'Admin' || normalizedRole === 'Main Admin';
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    let branch = searchParams.get('branch') || 'all';

    if (role === 'Admin') {
      branch = currentUser.branch || branch;
    }

    if (supabaseAdmin) {
      let query = supabaseAdmin
        .from(HISTORY_TABLE)
        .select('*')
        .order('submitted_at', { ascending: false });

      if (month) {
        query = query.eq('month', month);
      }

      if (branch !== 'all') {
        query = query.eq('branch', branch);
      }

      const { data, error } = await query;

      if (!error) {
        return NextResponse.json(data || []);
      }
    }

    const allHistory = await db.monthlyReportHistory.getAll();
    const filteredHistory = allHistory
      .filter((entry) => !month || entry.month === month)
      .filter((entry) => branch === 'all' || entry.branch === branch)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

    return NextResponse.json(filteredHistory);
  } catch (error) {
    console.error('Error fetching monthly close history:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly close history' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManageMonthlyClose(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const month = String(body.month || '').trim();
    let branch = String(body.branch || '').trim() || 'all';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const snapshot = body.snapshot as MonthlyReportSnapshot | undefined;

    if (!month || !snapshot) {
      return NextResponse.json({ error: 'Month and snapshot are required' }, { status: 400 });
    }

    if (normalizeRole(currentUser.role) === 'Admin') {
      branch = currentUser.branch || branch;
    }

    const now = new Date().toISOString();
    const record: MonthlyReportHistory = {
      id: buildHistoryId(month, branch),
      month,
      branch,
      status: 'closed',
      submittedAt: now,
      submittedBy: currentUser.name || currentUser.username || 'Admin',
      submittedById: currentUser.id,
      notes,
      snapshot,
    };

    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from(HISTORY_TABLE)
        .upsert({
          id: record.id,
          month: record.month,
          branch: record.branch,
          status: record.status,
          submitted_at: record.submittedAt,
          submitted_by: record.submittedBy,
          submitted_by_id: record.submittedById,
          notes: record.notes,
          snapshot: record.snapshot,
        }, { onConflict: 'id' });

      if (!error) {
        return NextResponse.json(record);
      }

      console.error('Failed to save monthly close to Supabase:', error);
    }

    await db.monthlyReportHistory.save(record);
    return NextResponse.json(record);
  } catch (error) {
    console.error('Error closing monthly report:', error);
    return NextResponse.json({ error: 'Failed to close monthly report' }, { status: 500 });
  }
}