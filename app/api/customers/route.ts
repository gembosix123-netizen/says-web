/**
 * Customers API Endpoint
 * ======================
 * 
 * GET  /api/customers     - Get all customers
 * POST /api/customers     - Create customer
 * PUT  /api/customers/:id - Update customer
 * DELETE /api/customers/:id - Delete customer
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createCustomerSchema, updateCustomerSchema } from '@/lib/validations';

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branch = searchParams.get('branch');
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Get single customer
    if (id) {
      const { data: customer, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(customer);
    }

    // Get all customers
    const { data: customers, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    return NextResponse.json(customers || []);

  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST HANDLER (Create)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement authentication check
    const body = await request.json();

    // Validate customer data with Zod
    const validation = createCustomerSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`);
      return NextResponse.json(
        { error: 'Ralat pengesahan', details: errors },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Create customer
    const { data: newCustomer, error: createError } = await supabaseAdmin
      .from('customers')
      .insert({
        name: validatedData.name,
        phone: validatedData.phone || '',
        email: validatedData.email || '',
        address: validatedData.address || '',
        city: validatedData.city || '',
        state: validatedData.state || '',
        postal_code: validatedData.postalCode || '',
        branch: validatedData.branch,
        type: validatedData.type,
        status: validatedData.status,
        total_purchases: 0,
        total_spent: 0,
        credit_limit: validatedData.creditLimit,
        credits: validatedData.credits,
        notes: validatedData.notes || '',
        is_active: validatedData.isActive,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating customer:', createError);
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Customer created successfully',
        customerId: newCustomer?.id,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT HANDLER (Update)
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    // TODO: Implement authentication check
    const body = await request.json();
    const customerId = body.id || body.customerId;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Check customer exists
    const { data: customer, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (fetchError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Update customer
    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address,
        city: body.city,
        state: body.state,
        postal_code: body.postalCode,
        branch: body.branch,
        type: body.type,
        status: body.status,
        notes: body.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating customer:', updateError);
      return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Customer updated successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE HANDLER
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // TODO: Implement authentication check
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('id');

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Check customer exists
    const { data: customer, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (fetchError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Soft delete customer (set is_active to false)
    const { error: deleteError } = await supabaseAdmin
      .from('customers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', customerId);

    if (deleteError) {
      console.error('Error deleting customer:', deleteError);
      return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Customer deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
