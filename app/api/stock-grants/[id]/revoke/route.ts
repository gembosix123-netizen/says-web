import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { expireStaleStockGrants } from '@/lib/stock-edit-grants';
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

  await expireStaleStockGrants(supabaseAdmin);

  const body = await request.json().catch(() => ({}));
  const reason =
    typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

  const now = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from('stock_edit_grants')
    .update({
      status: 'revoked',
      closed_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('status', 'active')
    .select('*')
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Sesi aktif tidak dijumpai' }, { status: 404 });
  }

  await logAuditEvent({
    request,
    module: 'inventory',
    action: 'stock_grant_revoked',
    entityType: 'stock_edit_grant',
    entityId: id,
    reason: reason || undefined,
    metadata: { requester_id: updated.requester_id },
  });

  return NextResponse.json({ grant: updated });
}
