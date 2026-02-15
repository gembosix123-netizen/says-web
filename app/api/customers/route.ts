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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateCustomerData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string') {
    errors.push('Customer name is required');
  }

  if (!data.branch || typeof data.branch !== 'string') {
    errors.push('Branch is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

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

    // Validate customer data
    const validation = validateCustomerData(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Create customer
    const customerId = await createCustomer({
      name: body.name,
      phone: body.phone || '',
      email: body.email || '',
      address: body.address || '',
      city: body.city || '',
      state: body.state || '',
      postalCode: body.postalCode || '',
      branch: body.branch,
      type: body.type || 'retail',
      status: body.status || 'active',
      totalPurchases: body.totalPurchases || 0,
      totalSpent: body.totalSpent || 0,
      creditLimit: body.creditLimit || 100000,
      credits: body.credits || 0,
      notes: body.notes || '',
    });

    return NextResponse.json(
      {
        message: 'Customer created successfully',
        customerId,
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

    // Check customer exists
    const customer = await getCustomer(customerId);
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Update customer
    await updateCustomer(customerId, body);

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

    // Check customer exists
    const customer = await getCustomer(customerId);
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Delete customer
    await deleteCustomer(customerId);

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
