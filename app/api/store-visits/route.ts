import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function normalizeAllowedStoreIds(rawAllowedStores: unknown): string[] {
  if (!Array.isArray(rawAllowedStores)) return [];

  return rawAllowedStores
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return String(item);
      }

      if (item && typeof item === 'object') {
        const maybeId =
          (item as { id?: unknown }).id ??
          (item as { customer_id?: unknown }).customer_id ??
          (item as { value?: unknown }).value;

        if (typeof maybeId === 'string' || typeof maybeId === 'number') {
          return String(maybeId);
        }
      }

      return null;
    })
    .filter((id): id is string => Boolean(id));
}

// Get current user from session cookie
async function getCurrentUser(request: Request) {
  try {
    const session = (request as any).cookies.get('session');
    if (!session) return null;
    const data = JSON.parse(session.value);
    return data;
  } catch (e) {
    return null;
  }
}

// GET - List store visits with filtering
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      .select(`
        *,
        customer:customers(id, name, address, branch)
      `);

    // Role-based filtering
    if (currentUser.role === 'Merchandiser' || currentUser.role === 'Sales') {
      // Merchandiser/Sales sees only their own visits
      query = query.eq('merchandiser_id', currentUser.id);
    } else if (currentUser.role === 'Admin') {
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

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('[API store-visits GET] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new store visit (check-in)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Merchandiser, Sales, and Admin can create visits
    if (currentUser.role !== 'Merchandiser' && currentUser.role !== 'Sales' && currentUser.role !== 'Admin' && currentUser.role !== 'Main Admin') {
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

    if (!customer || customer.is_active === false) {
      return NextResponse.json(
        { error: 'Store record not synced. Please refresh store list or contact admin.' },
        { status: 409 }
      );
    }

    // For merchandisers, check if they're allowed to visit this store
    if (currentUser.role === 'Merchandiser') {
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

    const visitData = {
      merchandiser_id: currentUser.id,
      customer_id: normalizedCustomerId,
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
      .select(`
        *,
        customer:customers(id, name, address, branch)
      `)
      .single();

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

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('[API store-visits POST] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update store visit (typically for check-out)
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    if (currentUser.role === 'Merchandiser' || currentUser.role === 'Sales') {
      if (existingVisit.merchandiser_id !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden - you can only update your own visits' }, { status: 403 });
      }
    } else if (currentUser.role === 'Admin') {
      if (existingVisit.branch !== currentUser.branch) {
        return NextResponse.json({ error: 'Forbidden - you can only update visits in your branch' }, { status: 403 });
      }
    }
    // Main Admin can update any visit

    const updateData: any = {};
    
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
      .select(`
        *,
        customer:customers(id, name, address, branch)
      `)
      .single();

    if (error) {
      console.error('[API store-visits PUT] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API store-visits PUT] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
