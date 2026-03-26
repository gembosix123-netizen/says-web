/**
 * Customers API Endpoint
 * ======================
 * 
 * GET    /api/customers          - Get all customers (returns [] if DB unavailable)
 * GET    /api/customers?id=xxx   - Get single customer by id
 * POST   /api/customers          - Create customer (body: { name, phone, address, branch })
 * PUT    /api/customers          - Update customer (body: { id, name, phone, address, branch })
 * DELETE /api/customers?id=xxx   - Delete customer by id
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createCustomerSchema } from '@/lib/validations';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { canAccessSalesRoutes } from '@/lib/permissions';
import { canAccessStoreVisits } from '@/lib/permissions';

const isMissingColumnError = (error: unknown, columnName: string) => {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && (
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  );
};

const isIdDefaultError = (error: unknown) => {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    message.includes('null value in column') &&
    message.includes('id') &&
    message.includes('violates not-null constraint')
  ) || (
    message.includes('id') &&
    message.includes('default')
  );
};

const getErrorDetails = (error: unknown): string => {
  if (!error || typeof error !== 'object') return 'Unknown database error';

  const maybeError = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  const firstDetail = [maybeError.message, maybeError.details, maybeError.hint]
    .find((value) => typeof value === 'string' && value.trim().length > 0);

  return typeof firstDetail === 'string' ? firstDetail : 'Unknown database error';
};

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!supabaseAdmin) {
      if (id) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
      return NextResponse.json([]);
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

    // Get all customers (support schemas with/without is_active)
    const activeQuery = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('is_active', true);

    if (activeQuery.error && isMissingColumnError(activeQuery.error, 'is_active')) {
      const fallbackQuery = await supabaseAdmin
        .from('customers')
        .select('*');

      if (fallbackQuery.error) throw fallbackQuery.error;
      return NextResponse.json(fallbackQuery.data || []);
    }

    if (activeQuery.error) throw activeQuery.error;
    return NextResponse.json(activeQuery.data || []);

  } catch (error) {
    console.error('Error fetching customers:', error);
    // Keep admin UI functional even when upstream DB is temporarily unavailable.
    return NextResponse.json([]);
  }
}

// ============================================================================
// POST HANDLER (Create)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canAccessStoreVisits(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Validate customer data with Zod
    const validation = createCustomerSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
      return NextResponse.json(
        { error: 'Ralat pengesahan', details: errors },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const payloadWithTimestamps = {
      name: validatedData.name,
      phone: validatedData.phone || '',
      address: validatedData.address || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const payloadWithoutTimestamps = {
      name: validatedData.name,
      phone: validatedData.phone || '',
      address: validatedData.address || '',
    };

    const insertPayloads: Record<string, unknown>[] = [
      { ...payloadWithTimestamps, branch: validatedData.branch },
      { ...payloadWithTimestamps, town: validatedData.branch },
      { ...payloadWithoutTimestamps, branch: validatedData.branch },
      { ...payloadWithoutTimestamps, town: validatedData.branch },
    ];

    let newCustomer: Record<string, unknown> | null = null;
    let createError: unknown = null;

    for (const payload of insertPayloads) {
      const createResult = await supabaseAdmin
        .from('customers')
        .insert(payload)
        .select()
        .single();

      if (!createResult.error) {
        newCustomer = createResult.data;
        createError = null;
        break;
      }

      createError = createResult.error;

      if (isIdDefaultError(createResult.error)) {
        const retryWithId = await supabaseAdmin
          .from('customers')
          .insert({
            ...payload,
            id: crypto.randomUUID(),
          })
          .select()
          .single();

        if (!retryWithId.error) {
          newCustomer = retryWithId.data;
          createError = null;
          break;
        }

        createError = retryWithId.error;
      }
    }

    if (createError) {
      console.error('Error creating customer:', createError);
      return NextResponse.json(
        {
          error: 'Failed to create customer',
          details: getErrorDetails(createError),
        },
        { status: 500 }
      );
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
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canAccessSalesRoutes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const updatePayloads: Record<string, unknown>[] = [
      {
        name: body.name,
        phone: body.phone,
        address: body.address,
        branch: body.branch,
        updated_at: new Date().toISOString(),
      },
      {
        name: body.name,
        phone: body.phone,
        address: body.address,
        branch: body.branch,
      },
      {
        name: body.name,
        phone: body.phone,
        address: body.address,
        town: body.branch,
        updated_at: new Date().toISOString(),
      },
      {
        name: body.name,
        phone: body.phone,
        address: body.address,
        town: body.branch,
      },
    ];

    let updateError: unknown = null;

    for (const payload of updatePayloads) {
      const updateResult = await supabaseAdmin
        .from('customers')
        .update(payload)
        .eq('id', customerId);

      if (!updateResult.error) {
        updateError = null;
        break;
      }

      updateError = updateResult.error;
    }

    if (updateError) {
      console.error('Error updating customer:', updateError);
      return NextResponse.json(
        {
          error: 'Failed to update customer',
          details: (updateError as { message?: string })?.message || 'Unknown database error',
        },
        { status: 500 }
      );
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
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (!canAccessSalesRoutes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    // Delete customer (soft-delete if is_active exists, fallback to hard delete)
    let softDeleteResult = await supabaseAdmin
      .from('customers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', customerId);

    if (softDeleteResult.error && isMissingColumnError(softDeleteResult.error, 'updated_at')) {
      softDeleteResult = await supabaseAdmin
        .from('customers')
        .update({ is_active: false })
        .eq('id', customerId);
    }

    if (softDeleteResult.error && isMissingColumnError(softDeleteResult.error, 'is_active')) {
      const hardDeleteResult = await supabaseAdmin
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (hardDeleteResult.error) {
        console.error('Error deleting customer:', hardDeleteResult.error);
        return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
      }
    } else if (softDeleteResult.error) {
      console.error('Error deleting customer:', softDeleteResult.error);
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
