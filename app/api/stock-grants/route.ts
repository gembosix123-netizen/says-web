import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
type BranchName = 'Kota Kinabalu' | 'Kinabatangan' | 'HQ';

function normalizeBranch(value: unknown): BranchName | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'kota kinabalu' || raw === 'kota-kinabalu' || raw === 'kk') return 'Kota Kinabalu';
  if (raw === 'kinabatangan' || raw === 'kb') return 'Kinabatangan';
  if (raw === 'hq') return 'HQ';
  return null;
}
import {
  expireStaleStockGrants,
  STOCK_GRANT_MAX_DURATION_MINUTES,
  STOCK_GRANT_MIN_REASON_LENGTH,
} from '@/lib/stock-edit-grants';
import { logAuditEvent } from '@/lib/audit';

async function requireSupabase() {
  if (!supabaseAdmin) return null;
  return supabaseAdmin;
}

/**
 * GET /api/stock-grants?view=active — active grant for current user (Admin)
 * GET /api/stock-grants?status=pending|active — Main Admin queue
 * GET /api/stock-grants?view=history&page=1&pageSize=50 — Main Admin history
 */
export async function GET(request: NextRequest) {
  const db = await requireSupabase();
  if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

  const user = getSessionUserFromRequest(request);
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = normalizeRole(user.role);
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view');
  const status = searchParams.get('status');

  await expireStaleStockGrants(db);

  if (view === 'active') {
    if (role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const now = new Date().toISOString();
    const { data, error } = await db
      .from('stock_edit_grants')
      .select('*')
      .eq('requester_id', user.id)
      .eq('status', 'active')
      .gt('expires_at', now)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('stock-grants active:', error);
      return NextResponse.json({ error: 'Failed to fetch grant' }, { status: 500 });
    }
    return NextResponse.json({ grant: data || null });
  }

  if (view === 'history') {
    if (role !== 'Main Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await expireStaleStockGrants(db);
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '50')));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const countQuery = db.from('stock_edit_grants').select('id', { count: 'exact', head: true });
    const { count } = await countQuery;

    const { data, error } = await db
      .from('stock_edit_grants')
      .select('*')
      .order('requested_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('stock-grants history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({
      items: data || [],
      page,
      pageSize,
      total: count ?? 0,
      totalPages: count ? Math.ceil(count / pageSize) : 0,
    });
  }

  if (status === 'pending' || status === 'active') {
    if (role !== 'Main Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await expireStaleStockGrants(db);
    const now = new Date().toISOString();
    let query = db.from('stock_edit_grants').select('*').order('requested_at', { ascending: false });

    if (status === 'pending') {
      query = query.eq('status', 'pending');
    } else {
      query = query.eq('status', 'active').gt('expires_at', now);
    }

    const { data, error } = await query;
    if (error) {
      console.error('stock-grants list:', error);
      return NextResponse.json({ error: 'Failed to fetch grants' }, { status: 500 });
    }
    return NextResponse.json({ items: data || [] });
  }

  return NextResponse.json(
    { error: 'Specify view=active, view=history, or status=pending|active' },
    { status: 400 }
  );
}

/**
 * POST /api/stock-grants — Branch Admin requests a grant
 */
export async function POST(request: NextRequest) {
  const db = await requireSupabase();
  if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

  const user = getSessionUserFromRequest(request);
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = normalizeRole(user.role);
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Only branch Admin can request stock edit access' }, { status: 403 });
  }

  const branch = normalizeBranch(user.branch);
  if (!branch) {
    return NextResponse.json({ error: 'Branch assignment required' }, { status: 403 });
  }

  await expireStaleStockGrants(db);

  const body = await request.json().catch(() => ({}));
  const reasonRequest = typeof body.reason_request === 'string' ? body.reason_request.trim() : '';
  const requestedDuration = Math.min(
    STOCK_GRANT_MAX_DURATION_MINUTES,
    Math.max(1, Number(body.requested_duration_minutes) || 15)
  );

  if (reasonRequest.length < STOCK_GRANT_MIN_REASON_LENGTH) {
    return NextResponse.json(
      { error: `Sebab permintaan wajib (min ${STOCK_GRANT_MIN_REASON_LENGTH} aksara)` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  const { data: pending } = await db
    .from('stock_edit_grants')
    .select('id')
    .eq('requester_id', user.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (pending) {
    return NextResponse.json({ error: 'Permintaan sedang menunggu kelulusan' }, { status: 409 });
  }

  const { data: active } = await db
    .from('stock_edit_grants')
    .select('id')
    .eq('requester_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', now)
    .limit(1)
    .maybeSingle();

  if (active) {
    return NextResponse.json({ error: 'Sesi edit stok masih aktif' }, { status: 409 });
  }

  const insertRow = {
    requester_id: user.id,
    requester_name: user.name || user.username || null,
    requester_branch: branch,
    status: 'pending' as const,
    duration_minutes: requestedDuration,
    requested_duration_minutes: requestedDuration,
    reason_request: reasonRequest,
    updated_at: now,
  };

  const { data: created, error } = await db
    .from('stock_edit_grants')
    .insert(insertRow)
    .select('*')
    .single();

  if (error || !created) {
    console.error('stock-grants POST:', error);
    return NextResponse.json({ error: 'Gagal mencipta permintaan' }, { status: 500 });
  }

  await logAuditEvent({
    request,
    module: 'inventory',
    action: 'stock_grant_requested',
    entityType: 'stock_edit_grant',
    entityId: created.id,
    branch,
    metadata: {
      requester_id: user.id,
      requested_duration_minutes: requestedDuration,
    },
  });

  return NextResponse.json({ grant: created }, { status: 201 });
}
