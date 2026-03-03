import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest } from '@/lib/session';
import { canViewAudit } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(user.role);

    if (!canViewAudit(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const moduleFilter = searchParams.get('module');
    const actionFilter = searchParams.get('action');
    const actorIdFilter = searchParams.get('actorId');
    const branchFilter = searchParams.get('branch');
    const statusFilter = searchParams.get('status');
    const referenceNoFilter = searchParams.get('referenceNo');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(Number(searchParams.get('page') || '1'), 1);
    const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') || '50'), 1), 200);
    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    const applyFilters = <T extends { eq: (column: string, value: unknown) => T; gte: (column: string, value: string) => T; lte: (column: string, value: string) => T }>(query: T): T => {
      let q = query;

      if (moduleFilter) q = q.eq('module', moduleFilter);
      if (actionFilter) q = q.eq('action', actionFilter);
      if (actorIdFilter) q = q.eq('actor_id', actorIdFilter);
      if (statusFilter) q = q.eq('status', statusFilter);
      if (referenceNoFilter) q = q.eq('reference_no', referenceNoFilter);

      if (role === 'Admin') {
        q = q.eq('branch', user.branch);
      } else if (branchFilter) {
        q = q.eq('branch', branchFilter);
      }

      if (startDate) {
        q = q.gte('created_at', `${startDate}T00:00:00Z`);
      }

      if (endDate) {
        q = q.lte('created_at', `${endDate}T23:59:59Z`);
      }

      return q;
    };

    const countQueryBase = supabaseAdmin
      .from('audit_events')
      .select('id', { count: 'exact', head: true });
    const countQuery = applyFilters(countQueryBase);
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting audit events:', countError);
      return NextResponse.json({ error: 'Failed to count audit events' }, { status: 500 });
    }

    const listQueryBase = supabaseAdmin
      .from('audit_events')
      .select(`
        *,
        audit_event_changes (*)
      `)
      .order('created_at', { ascending: false })
      .range(rangeFrom, rangeTo);
    const listQuery = applyFilters(listQueryBase);

    const { data, error } = await listQuery;

    if (error) {
      console.error('Error fetching audit events:', error);
      return NextResponse.json({ error: 'Failed to fetch audit events' }, { status: 500 });
    }

    return NextResponse.json({
      items: data || [],
      count: (data || []).length,
      total: count || 0,
      page,
      pageSize,
      totalPages: count ? Math.ceil(count / pageSize) : 0,
    });
  } catch (error) {
    console.error('Error in GET /api/audit/events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
