import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { canManageProducts } from '@/lib/permissions';

/**
 * GET /api/products/prices?product_id=X&branch=Y&salesman_id=Z
 * Returns price overrides. If product_id given, returns all overrides for that product.
 *
 * POST /api/products/prices
 * Body: { product_id, branch?, salesman_id?, price, notes? }
 * Upserts a price override.
 *
 * DELETE /api/products/prices?id=X
 * Removes a price override (revert to default).
 */

export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'DB not available' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');
  const branch = searchParams.get('branch');
  const salesmanId = searchParams.get('salesman_id');

  let query = supabaseAdmin.from('product_prices').select('*').order('created_at');

  if (productId) query = query.eq('product_id', productId);
  if (branch) query = query.eq('branch', branch);
  if (salesmanId) query = query.eq('salesman_id', salesmanId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = normalizeRole(user.role);
  if (!canManageProducts(role)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  if (!supabaseAdmin) return NextResponse.json({ error: 'DB not available' }, { status: 500 });

  const body = await request.json();
  const { product_id, branch, salesman_id, price, notes } = body;

  if (!product_id || price == null) {
    return NextResponse.json({ error: 'product_id and price required' }, { status: 400 });
  }

  if (Number(price) < 0) {
    return NextResponse.json({ error: 'Harga tidak boleh negatif' }, { status: 400 });
  }

  const record = {
    product_id,
    branch: branch || null,
    salesman_id: salesman_id || null,
    price: Number(price),
    notes: notes || null,
    created_by: user.id,
  };

  const { data, error } = await supabaseAdmin
    .from('product_prices')
    .upsert(record, { onConflict: 'product_id,branch,salesman_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to save price' }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = normalizeRole(user.role);
  if (!canManageProducts(role)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  if (!supabaseAdmin) return NextResponse.json({ error: 'DB not available' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('product_prices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });

  return NextResponse.json({ success: true });
}
