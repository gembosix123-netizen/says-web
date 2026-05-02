import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import {
  expireStaleStockGrants,
  STOCK_GRANT_MAX_DURATION_MINUTES,
} from '@/lib/stock-edit-grants';
import { logAuditEvent } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

  const user = getSessionUserFromRequest(request);
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = normalizeRole(user.role);
  if (role !== 'Main Admin') {
    return NextResponse.json({ error: 'Hanya Main Admin boleh meluluskan' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await expireStaleStockGrants(supabaseAdmin);

  const body = await request.json().catch(() => ({}));
  const durationMinutes = Math.min(
    STOCK_GRANT_MAX_DURATION_MINUTES,
    Math.max(1, Number(body.duration_minutes) || 15)
  );
  const reasonApprove =
    typeof body.reason_approve === 'string' ? body.reason_approve.trim().slice(0, 500) : '';

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('stock_edit_grants')
    .select('*')
    .eq('id', id)
    .eq('status', 'pending')
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Permintaan tidak dijumpai atau bukan pending' }, { status: 404 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const isoNow = now.toISOString();
  const isoExpires = expiresAt.toISOString();

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('stock_edit_grants')
    .update({
      status: 'active',
      duration_minutes: durationMinutes,
      approved_at: isoNow,
      expires_at: isoExpires,
      approver_id: user.id,
      approver_name: user.name || user.username || null,
      reason_approve: reasonApprove || null,
      updated_at: isoNow,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (updErr || !updated) {
    console.error('approve grant:', updErr);
    return NextResponse.json({ error: 'Gagal meluluskan' }, { status: 500 });
  }

  await logAuditEvent({
    request,
    module: 'inventory',
    action: 'stock_grant_approved',
    entityType: 'stock_edit_grant',
    entityId: id,
    metadata: {
      requester_id: row.requester_id,
      duration_minutes: durationMinutes,
      expires_at: isoExpires,
    },
  });

  return NextResponse.json({ grant: updated });
}
