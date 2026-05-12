import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';

/**
 * GET  /api/inventory/movements?branch=X&type=Y&product_id=Z&actor_id=A&limit=50
 * POST /api/inventory/movements  — log satu pergerakan stok
 */

export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'DB not available' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const role = normalizeRole(user.role);
  const branch = searchParams.get('branch');
  const type = searchParams.get('type');
  const productId = searchParams.get('product_id');
  const actorId = searchParams.get('actor_id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  let query = supabaseAdmin
    .from('inventory_movements')
    .select('*')
    .order('movement_date', { ascending: false })
    .limit(limit);

  // Admins hanya boleh tengok cawangan sendiri
  if (role === 'Admin') {
    query = query.eq('branch', user.branch);
  } else if (branch && branch !== 'all') {
    query = query.eq('branch', branch);
  }

  if (type) query = query.eq('movement_type', type);
  if (productId) query = query.eq('product_id', productId);
  if (actorId) query = query.eq('actor_id', actorId);
  if (dateFrom) query = query.gte('movement_date', `${dateFrom}T00:00:00Z`);
  if (dateTo) query = query.lte('movement_date', `${dateTo}T23:59:59Z`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch movements' }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'DB not available' }, { status: 500 });

  const role = normalizeRole(user.role);
  if (!['Main Admin', 'Admin', 'Sales'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    movement_type,
    product_id,
    product_name,
    qty,
    from_bucket,
    to_bucket,
    source_ref,
    notes,
    actor_id,
    actor_name,
    branch,
    movement_date,
  } = body;

  if (!movement_type || !product_id || qty == null) {
    return NextResponse.json({ error: 'movement_type, product_id, qty diperlukan' }, { status: 400 });
  }

  if (Number(qty) <= 0) {
    return NextResponse.json({ error: 'Kuantiti mesti lebih dari 0' }, { status: 400 });
  }

  const VALID_TYPES = [
    'sale_deduct', 'return_approved', 'carry_forward',
    'freezer_in', 'freezer_to_van', 'van_to_freezer',
    'damage_write_off', 'adjustment', 'void_sale_return',
  ];
  if (!VALID_TYPES.includes(movement_type)) {
    return NextResponse.json({ error: 'movement_type tidak sah' }, { status: 400 });
  }

  // Admins hanya boleh log untuk cawangan sendiri kecuali Main Admin
  const resolvedBranch = role === 'Admin' ? user.branch : (branch || user.branch);

  const record = {
    branch: resolvedBranch,
    actor_id: actor_id || user.id,
    actor_name: actor_name || user.name || user.username,
    movement_type,
    product_id,
    product_name: product_name || null,
    qty: Number(qty),
    from_bucket: from_bucket || null,
    to_bucket: to_bucket || null,
    source_ref: source_ref || null,
    notes: notes || null,
    movement_date: movement_date || new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('inventory_movements')
    .insert(record)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Gagal rekod pergerakan stok' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
