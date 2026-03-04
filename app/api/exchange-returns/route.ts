import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // exchange | return | disposal
    const status = searchParams.get('status'); // pending | approved | rejected | completed
    const branch = searchParams.get('branch');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const role = normalizeRole(user.role);

    let query = supabaseAdmin
      .from('exchange_returns')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    
    // Branch filtering - Admin can only see their branch
    if (role === 'Admin') {
      query = query.eq('branch', user.branch);
    } else if (branch && branch !== 'all') {
      query = query.eq('branch', branch);
    }

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59Z`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching exchange/returns:', error);
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/exchange-returns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json();
    const { 
      sale_id, 
      invoice,
      product_id, 
      product_name, 
      quantity, 
      type, 
      reason,
      reason_details,
      notes 
    } = body;

    // Validation
    if (!product_id || !product_name || !quantity || !type || !reason) {
      return NextResponse.json({ 
        error: 'Missing required fields: product_id, product_name, quantity, type, reason' 
      }, { status: 400 });
    }

    if (!['exchange', 'return', 'disposal'].includes(type)) {
      return NextResponse.json({ 
        error: 'Invalid type. Must be: exchange, return, or disposal' 
      }, { status: 400 });
    }

    // Create exchange/return record
    const newRecord = {
      sale_id: sale_id || null,
      invoice: invoice || null,
      product_id,
      product_name,
      quantity: Number(quantity),
      type,
      reason,
      reason_details: reason_details || null,
      status: 'pending',
      branch: user.branch || null,
      requested_by: user.id,
      requested_by_name: user.name || user.username,
      requested_at: new Date().toISOString(),
      notes: notes || null
    };

    const { data, error } = await supabaseAdmin
      .from('exchange_returns')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error('Error creating exchange/return:', error);
      return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
    }

    // Log audit event
    await logAuditEvent({
      actor: user,
      module: 'exchange_returns',
      action: 'create',
      entityType: type,
      entityId: data.id,
      branch: user.branch,
      status: 'success',
      referenceNo: invoice || undefined,
      metadata: { product_name, quantity, type, reason }
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/exchange-returns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(user.role);
    
    // Only Admin and Main Admin can approve/reject
    if (role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields: id, status' }, { status: 400 });
    }

    if (!['approved', 'rejected', 'completed'].includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Must be: approved, rejected, or completed' 
      }, { status: 400 });
    }

    const updateData: any = {
      status,
      notes: notes || null
    };

    if (status === 'approved') {
      updateData.approved_by = user.id;
      updateData.approved_by_name = user.name || user.username;
      updateData.approved_at = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.processed_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('exchange_returns')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating exchange/return:', error);
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }

    // Log audit event
    await logAuditEvent({
      actor: user,
      module: 'exchange_returns',
      action: 'update',
      entityType: data.type,
      entityId: id,
      branch: user.branch,
      status: 'success',
      referenceNo: data.invoice || undefined,
      metadata: { new_status: status, product_name: data.product_name }
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PATCH /api/exchange-returns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
