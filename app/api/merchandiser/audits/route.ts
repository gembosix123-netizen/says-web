import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeRole } from '@/lib/roles';
import { canAccessStoreVisits } from '@/lib/permissions';
import { getSessionUserFromRequest } from '@/lib/session';

interface AuditItemInput {
  product_id: string;
  product_name: string;
  balance_stock?: number;
  expired_stock?: number;
  damaged_stock?: number;
  condition_notes?: string;
  photo_url?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

// GET - Get audit items for a specific visit
export async function GET(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canAccessStoreVisits(role)) {
      return NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get('visit_id');

    if (!visitId) {
      return NextResponse.json({ error: 'visit_id is required' }, { status: 400 });
    }

    // Verify access to the visit
    const { data: visit } = await supabaseAdmin
      .from('store_visits')
      .select('merchandiser_id, branch')
      .eq('id', visitId)
      .single();

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    // Permission check
    if (role === 'Merchandiser' || role === 'Sales') {
      if (visit.merchandiser_id !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (role === 'Admin') {
      if (visit.branch !== currentUser.branch) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    // Main Admin can view any

    const { data, error } = await supabaseAdmin
      .from('store_audit_items')
      .select('*')
      .eq('visit_id', visitId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[API merchandiser/audits GET] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: unknown) {
    console.error('[API merchandiser/audits GET] Unexpected error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// POST - Create audit items for a visit
export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);

    // Only Merchandiser, Sales, and Admin can create audits
    if (!canAccessStoreVisits(role)) {
      return NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const body = await request.json();
    const { visit_id, items } = body;

    if (!visit_id) {
      return NextResponse.json({ error: 'visit_id is required' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required and must not be empty' }, { status: 400 });
    }

    // Verify the visit exists and belongs to the user
    const { data: visit } = await supabaseAdmin
      .from('store_visits')
      .select('merchandiser_id, branch')
      .eq('id', visit_id)
      .single();

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    // Permission check
    if (role === 'Merchandiser' || role === 'Sales') {
      if (visit.merchandiser_id !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden - you can only add audits to your own visits' }, { status: 403 });
      }
    } else if (role === 'Admin') {
      if (visit.branch !== currentUser.branch) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    // Main Admin can add to any visit

    // Prepare audit items for insertion
    const auditItems = (items as AuditItemInput[]).map((item) => ({
      visit_id,
      product_id: item.product_id,
      product_name: item.product_name,
      balance_stock: item.balance_stock || 0,
      expired_stock: item.expired_stock || 0,
      damaged_stock: item.damaged_stock || 0,
      condition_notes: item.condition_notes || null,
      photo_url: item.photo_url || null,
    }));

    // Insert all audit items
    const { data, error } = await supabaseAdmin
      .from('store_audit_items')
      .insert(auditItems)
      .select();

    if (error) {
      console.error('[API merchandiser/audits POST] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length || 0, data }, { status: 201 });
  } catch (error: unknown) {
    console.error('[API merchandiser/audits POST] Unexpected error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
