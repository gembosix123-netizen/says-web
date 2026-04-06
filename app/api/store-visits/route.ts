import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest } from '@/lib/session';
import { canAccessStoreVisits } from '@/lib/permissions';
import { getCustomersTableByBranch } from '@/lib/branchPermissions';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

type StoreVisitRow = Record<string, any>;

async function attachCustomerToVisit(visit: StoreVisitRow | null) {
  if (!visit?.customer_id || !supabaseAdmin) return visit;

  const customersTable = getCustomersTableByBranch(visit.branch);
  const { data: customer } = await supabaseAdmin
    .from(customersTable)
    .select('id, name, address, branch, area')
    .eq('id', visit.customer_id)
    .maybeSingle();

  return {
    ...visit,
    customer: customer || null,
  };
}

async function attachCustomersToVisits(visits: StoreVisitRow[] | null) {
  if (!Array.isArray(visits) || visits.length === 0) return [];

  return Promise.all(visits.map((visit) => attachCustomerToVisit(visit)));
}

// GET - List store visits with filtering
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
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const customerId = searchParams.get('customer_id');

    let query = supabaseAdmin
      .from('store_visits')
      .select('*');

    // Role-based filtering
    if (role === 'Merchandiser' || role === 'Sales') {
      // Merchandiser/Sales sees only their own visits
      query = query.eq('merchandiser_id', currentUser.id);
    } else if (role === 'Admin') {
      // Admin sees visits in their branch only
      query = query.eq('branch', currentUser.branch);
    }
    // Main Admin sees all (no filter)

    // Apply optional filters
    if (status) {
      query = query.eq('status', status);
    }

    if (date) {
      // Filter by date (check_in_time on or after the specified date)
      query = query.gte('check_in_time', date);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query.order('check_in_time', { ascending: false });

    if (error) {
      console.error('[API store-visits GET] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(await attachCustomersToVisits(data || []));
  } catch (error: unknown) {
    console.error('[API store-visits GET] Unexpected error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// POST - Create new store visit (check-in)
export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);

    // Only allowed roles can create visits
    if (!canAccessStoreVisits(role)) {
      return NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const body = await request.json();
    const { customer_id, gps_lat, gps_long, staff_name, staff_contact, visit_type } = body;

    // Validate required fields
    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
    }

    // For merchandisers, check if they're allowed to visit this store
    if (role === 'Merchandiser') {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('allowed_stores')
        .eq('id', currentUser.id)
        .single();

      const allowedStores = userData?.allowed_stores || [];
      if (allowedStores.length > 0 && !allowedStores.includes(customer_id)) {
        return NextResponse.json({ error: 'You are not allowed to visit this store' }, { status: 403 });
      }
    }

    const visitData = {
      merchandiser_id: currentUser.id,
      customer_id,
      branch: currentUser.branch,
      check_in_time: new Date().toISOString(),
      gps_lat: gps_lat || null,
      gps_long: gps_long || null,
      staff_name: staff_name || null,
      staff_contact: staff_contact || null,
      visit_type: visit_type || 'audit',
      status: 'in-progress',
    };

    const { data, error } = await supabaseAdmin
      .from('store_visits')
      .insert(visitData)
      .select('*')
      .single();

    if (error) {
      console.error('[API store-visits POST] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(await attachCustomerToVisit(data), { status: 201 });
  } catch (error: unknown) {
    console.error('[API store-visits POST] Unexpected error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// PUT - Update store visit (typically for check-out)
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { visit_id, status, notes, photo_urls, check_out_time } = body;

    if (!visit_id) {
      return NextResponse.json({ error: 'visit_id is required' }, { status: 400 });
    }

    // Verify the visit belongs to the user (unless admin)
    const { data: existingVisit } = await supabaseAdmin
      .from('store_visits')
      .select('merchandiser_id, branch')
      .eq('id', visit_id)
      .single();

    if (!existingVisit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    // Permission check
    if (role === 'Merchandiser' || role === 'Sales') {
      if (existingVisit.merchandiser_id !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden - you can only update your own visits' }, { status: 403 });
      }
    } else if (role === 'Admin') {
      if (existingVisit.branch !== currentUser.branch) {
        return NextResponse.json({ error: 'Forbidden - you can only update visits in your branch' }, { status: 403 });
      }
    }
    // Main Admin can update any visit

    const updateData: Record<string, unknown> = {};
    
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (photo_urls !== undefined) updateData.photo_urls = photo_urls;
    if (check_out_time !== undefined) updateData.check_out_time = check_out_time;
    
    // Auto-set check_out_time if status is completed and not provided
    if (status === 'completed' && !check_out_time) {
      updateData.check_out_time = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('store_visits')
      .update(updateData)
      .eq('id', visit_id)
      .select('*')
      .single();

    if (error) {
      console.error('[API store-visits PUT] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(await attachCustomerToVisit(data));
  } catch (error: unknown) {
    console.error('[API store-visits PUT] Unexpected error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
