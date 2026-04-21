import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest } from '@/lib/session';
import { canViewAudit } from '@/lib/permissions';

function escapeCsvValue(value: unknown): string {
  const safe = value === null || value === undefined ? '' : String(value);
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

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
    const maxRows = Math.min(Math.max(Number(searchParams.get('maxRows') || '5000'), 1), 10000);

    let query = supabaseAdmin
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(maxRows);

    if (moduleFilter) query = query.eq('module', moduleFilter);
    if (actionFilter) query = query.eq('action', actionFilter);
    if (actorIdFilter) query = query.eq('actor_id', actorIdFilter);
    if (statusFilter) query = query.eq('status', statusFilter);
    if (referenceNoFilter) query = query.eq('reference_no', referenceNoFilter);

    if (role === 'Admin') {
      query = query.eq('branch', user.branch);
    } else if (branchFilter) {
      query = query.eq('branch', branchFilter);
    }

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00Z`);
    }

    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59Z`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error exporting audit events:', error);
      return NextResponse.json({ error: 'Failed to export audit events' }, { status: 500 });
    }

    const rows = data || [];
    const headers = [
      'created_at',
      'module',
      'action',
      'entity_type',
      'entity_id',
      'actor_id',
      'actor_username',
      'actor_name',
      'actor_role',
      'actor_branch',
      'branch',
      'status',
      'reason',
      'reference_no',
      'source_system',
      'metadata',
    ];

    const csvLines = [headers.join(',')];

    for (const row of rows) {
      const line = headers
        .map((header) => {
          const rawValue = header === 'metadata'
            ? JSON.stringify(row[header] || {})
            : row[header];
          return escapeCsvValue(rawValue);
        })
        .join(',');
      csvLines.push(line);
    }

    const csvContent = csvLines.join('\n');
    const filename = `audit_export_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/audit/export:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
