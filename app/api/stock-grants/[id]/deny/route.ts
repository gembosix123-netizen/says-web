import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const reason =
    typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

  const now = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from('stock_edit_grants')
    .update({
      status: 'denied',
      closed_at: now,
      approver_id: user.id,
      approver_name: user.name || user.username || null,
      reason_approve: reason || null,
      updated_at: now,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Permintaan tidak dijumpai atau bukan pending' }, { status: 404 });
  }

  await logAuditEvent({
    request,
    module: 'inventory',
    action: 'stock_grant_denied',
    entityType: 'stock_edit_grant',
    entityId: id,
    metadata: { requester_id: updated.requester_id },
  });

  return NextResponse.json({ grant: updated });
}
