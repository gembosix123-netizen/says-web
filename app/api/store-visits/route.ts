import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest } from '@/lib/session';
import { canAccessStoreVisits } from '@/lib/permissions';
import { getCustomersTableByBranch } from '@/lib/branchPermissions';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

function isCustomerFkError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes('store_visits_customer_id_fkey') || message.includes('foreign key');
}

/** Supabase/json may return uuid[] JSON, JSON string, or comma-separated ids */
function normalizeAllowedStoreIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((id) => String(id).trim()).filter(Boolean);
      }
    } catch {
      return s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

type StoreVisitRow = Record<string, any>;

async function resolveCanonicalCustomerId(customerId: string, branch?: string | null): Promise<string | null> {
  if (!customerId || !supabaseAdmin) return null;

  const canonicalRead = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .maybeSingle();

  if (!canonicalRead.error && canonicalRead.data?.id) {
    return String(canonicalRead.data.id);
  }

  const customersTable = getCustomersTableByBranch(branch || undefined);
  const branchCustomerRead = await supabaseAdmin
    .from(customersTable)
    .select('id, name, address, branch')
    .eq('id', customerId)
    .maybeSingle();

  if (branchCustomerRead.error || !branchCustomerRead.data?.id) {
    return null;
  }

  const branchCustomer = branchCustomerRead.data;
  const payload = {
    id: String(branchCustomer.id),
    name: String(branchCustomer.name || 'Unknown Store'),
    address: branchCustomer.address || null,
    branch: branchCustomer.branch || branch || null,
  };

  const canonicalUpsert = await supabaseAdmin
    .from('customers')
    .upsert(payload, { onConflict: 'id' })
    .select('id')
    .maybeSingle();

  if (canonicalUpsert.error) {
    console.error('[API store-visits] Failed to sync canonical customer:', canonicalUpsert.error);
    return null;
  }

  return String(canonicalUpsert.data?.id || payload.id);
}

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
    const normalizedCustomerId = typeof customer_id === 'string' ? customer_id.trim() : String(customer_id || '').trim();

    // Validate required fields
    if (!normalizedCustomerId) {
      return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
    }

    // Validate selected customer exists and is active before creating visit.
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, branch, is_active')
      .eq('id', normalizedCustomerId)
      .maybeSingle();

    if (customerError) {
      console.error('[API store-visits POST] Customer lookup error:', customerError);
      return NextResponse.json({ error: 'Failed to validate store record' }, { status: 500 });
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Store record not synced. Please refresh store list or contact admin.' },
        { status: 409 }
      );
    }

    // For merchandisers, check if they're allowed to visit this store
    if (role === 'Merchandiser') {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('allowed_stores')
        .eq('id', currentUser.id)
        .single();

      const allowedStores = normalizeAllowedStoreIds(userData?.allowed_stores);
      if (allowedStores.length > 0 && !allowedStores.includes(normalizedCustomerId)) {
        return NextResponse.json({ error: 'You are not allowed to visit this store' }, { status: 403 });
      }
    }

    const resolvedCustomerId = await resolveCanonicalCustomerId(customer_id, currentUser.branch);
    if (!resolvedCustomerId) {
      return NextResponse.json(
        { error: 'Store record not synced. Please refresh store list or contact admin.' },
        { status: 400 }
      );
    }

    const visitData = {
      merchandiser_id: currentUser.id,
      customer_id: resolvedCustomerId,
      branch: currentUser.branch,
      check_in_time: new Date().toISOString(),
      gps_lat: gps_lat || null,
      gps_long: gps_long || null,
      staff_name: staff_name || null,
      staff_contact: staff_contact || null,
      visit_type: visit_type || 'audit',
      status: 'in-progress',
    };

    let { data, error } = await supabaseAdmin
      .from('store_visits')
      .insert(visitData)
      .select('*')
      .single();

    if (error && isCustomerFkError(error)) {
      const retriedCustomerId = await resolveCanonicalCustomerId(customer_id, currentUser.branch);
      if (retriedCustomerId) {
        ({ data, error } = await supabaseAdmin
          .from('store_visits')
          .insert({ ...visitData, customer_id: retriedCustomerId })
          .select('*')
          .single());
      }
    }

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Store record not synced. Please refresh store list or contact admin.' },
          { status: 409 }
        );
      }

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
