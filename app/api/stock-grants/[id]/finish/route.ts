import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { expireStaleStockGrants } from '@/lib/stock-edit-grants';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/stock-grants/[id]/finish — requester ends their own active session early (done editing).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

  const user = getSessionUserFromRequest(request);
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = normalizeRole(user.role);
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Hanya Admin cawangan boleh menamatkan sesi sendiri' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await expireStaleStockGrants(supabaseAdmin);

  const { data: grant, error: fetchErr } = await supabaseAdmin
    .from('stock_edit_grants')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !grant) {
    return NextResponse.json({ error: 'Sesi tidak dijumpai' }, { status: 404 });
  }

  if (grant.requester_id !== user.id) {
    return NextResponse.json({ error: 'Bukan sesi anda' }, { status: 403 });
  }

  if (grant.status !== 'active') {
    return NextResponse.json({ error: 'Sesi tidak lagi aktif' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error: updErr } = await supabaseAdmin
    .from('stock_edit_grants')
    .update({
      status: 'expired',
      closed_at: now,
      expires_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('status', 'active');

  if (updErr) {
    console.error('finish grant:', updErr);
    return NextResponse.json({ error: 'Gagal menamatkan sesi' }, { status: 500 });
  }

  await logAuditEvent({
    request,
    module: 'inventory',
    action: 'stock_grant_finished_by_requester',
    entityType: 'stock_edit_grant',
    entityId: id,
    metadata: {
      requester_id: user.id,
      change_count: grant.change_count,
    },
  });

  return NextResponse.json({ success: true });
}
