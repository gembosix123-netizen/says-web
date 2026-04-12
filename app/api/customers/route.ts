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
import { getCustomersTableByBranch } from '@/lib/branchPermissions';

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

type CustomerTableName = 'customers_kb' | 'customers_kk';

const getBranchLabelForTable = (table: CustomerTableName) => (
  table === 'customers_kb' ? 'Kinabatangan' : 'Kota Kinabalu'
);

const resolveCustomerTables = (
  branch: string | null | undefined,
  includeAll = false
): CustomerTableName[] => {
  const normalized = (branch || '').trim().toLowerCase();

  if (includeAll || normalized === 'hq' || normalized === 'all') {
    return ['customers_kb', 'customers_kk'];
  }

  return [getCustomersTableByBranch(branch)];
};

const fetchCustomersFromTable = async ({
  table,
  role,
  currentUserId,
}: {
  table: CustomerTableName;
  role: ReturnType<typeof normalizeRole>;
  currentUserId: string;
}) => {
  let baseQuery = supabaseAdmin!.from(table).select('*');

  if (role === 'Sales') {
    baseQuery = baseQuery.or(`assigned_to.is.null,assigned_to.eq.${currentUserId}`);
  }

  const activeQuery = await baseQuery.eq('is_active', true);

  if (activeQuery.error && isMissingColumnError(activeQuery.error, 'is_active')) {
    let fallbackBase = supabaseAdmin!.from(table).select('*');

    if (role === 'Sales') {
      fallbackBase = fallbackBase.or(`assigned_to.is.null,assigned_to.eq.${currentUserId}`);
    }

    const fallbackQuery = await fallbackBase;
    if (fallbackQuery.error) throw fallbackQuery.error;

    return (fallbackQuery.data || []).map((customer) => ({
      ...customer,
      branch: customer.branch || customer.town || getBranchLabelForTable(table),
      customer_table: table,
    }));
  }

  if (activeQuery.error) throw activeQuery.error;

  return (activeQuery.data || []).map((customer) => ({
    ...customer,
    branch: customer.branch || customer.town || getBranchLabelForTable(table),
    customer_table: table,
  }));
};

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      if (id) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
      return NextResponse.json([]);
    }

    const requestedBranch = searchParams.get('branch');
    const includeAll = searchParams.get('all') === 'true';
    const role = normalizeRole(currentUser.role);
    const canViewAllBranches = role === 'Main Admin' || (currentUser.branch || '').trim().toLowerCase() === 'hq';
    const effectiveBranch = canViewAllBranches ? (requestedBranch || currentUser.branch) : currentUser.branch;
    const tablesToQuery = resolveCustomerTables(
      effectiveBranch,
      canViewAllBranches && (includeAll || !requestedBranch)
    );

    // Get single customer
    if (id) {
      for (const table of tablesToQuery) {
        const { data: customer, error } = await supabaseAdmin
          .from(table)
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        if (!customer) continue;

        if (
          role === 'Sales' &&
          customer.assigned_to &&
          customer.assigned_to !== currentUser.id
        ) {
          return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        return NextResponse.json({
          ...customer,
          branch: customer.branch || customer.town || getBranchLabelForTable(table),
          customer_table: table,
        });
      }

      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const customerGroups = await Promise.all(
      tablesToQuery.map((table) => fetchCustomersFromTable({
        table,
        role,
        currentUserId: currentUser.id,
      }))
    );

    const customers = customerGroups
      .flat()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    return NextResponse.json(customers);

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

    // Get the correct customers table based on user's branch
    const customersTable = getCustomersTableByBranch(currentUser.branch);

    // ── Duplicate detection ──
    // Check if a customer with the same name OR phone already exists
    const nameOrPhoneFilter = validatedData.phone
      ? `name.ilike.${validatedData.name},phone.eq.${validatedData.phone}`
      : `name.ilike.${validatedData.name}`;

    const { data: existingRows } = await supabaseAdmin
      .from(customersTable)
      .select('id, name, phone, assigned_to, assigned_to_name')
      .or(nameOrPhoneFilter);

    if (existingRows && existingRows.length > 0) {
      const owned = existingRows.find((c) => c.assigned_to);
      if (owned) {
        return NextResponse.json(
          {
            error: 'Pelanggan sudah wujud',
            duplicate: true,
            owner: owned.assigned_to_name || 'Salesman lain',
            existingId: owned.id,
            existingName: owned.name,
          },
          { status: 409 }
        );
      }
      // Unassigned duplicate — warn but allow Admin; block Sales
      const roleCheck = normalizeRole(currentUser.role);
      if (roleCheck === 'Sales') {
        const unowned = existingRows[0];
        return NextResponse.json(
          {
            error: 'Pelanggan sudah wujud (tiada pemilik)',
            duplicate: true,
            owner: null,
            existingId: unowned.id,
            existingName: unowned.name,
          },
          { status: 409 }
        );
      }
    }

    // ── Ownership: salesman who creates a customer becomes the owner ──
    const nowIso = new Date().toISOString();
    const roleForOwner = normalizeRole(currentUser.role);
    const ownership =
      roleForOwner === 'Sales'
        ? {
            assigned_to: currentUser.id,
            assigned_to_name: currentUser.name || null,
            assigned_at: nowIso,
          }
        : {};

    const payloadWithTimestamps = {
      name: validatedData.name,
      phone: validatedData.phone || '',
      address: validatedData.address || '',
      area: body.area?.trim() || null,
      created_at: nowIso,
      updated_at: nowIso,
      ...ownership,
    };

    const payloadWithoutTimestamps = {
      name: validatedData.name,
      phone: validatedData.phone || '',
      address: validatedData.address || '',
      area: body.area?.trim() || null,
      ...ownership,
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
        .from(customersTable)
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
          .from(customersTable)
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

    // Audit log — record self-add ownership
    if (roleForOwner === 'Sales' && newCustomer?.id) {
      await supabaseAdmin.from('customer_ownership_log').insert({
        customer_id: String(newCustomer.id),
        customer_name: validatedData.name,
        customer_table: customersTable,
        to_salesman_id: currentUser.id,
        to_salesman_name: currentUser.name || null,
        action: 'self_add',
        done_by: currentUser.id,
        done_by_name: currentUser.name || null,
        branch: currentUser.branch || null,
      });
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

    // Get the correct customers table based on user's branch
    const customersTable = getCustomersTableByBranch(currentUser.branch);

    // Check customer exists
    const { data: customer, error: fetchError } = await supabaseAdmin
      .from(customersTable)
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
        area: body.area?.trim() || null,
        branch: body.branch,
        updated_at: new Date().toISOString(),
      },
      {
        name: body.name,
        phone: body.phone,
        address: body.address,
        area: body.area?.trim() || null,
        branch: body.branch,
      },
      {
        name: body.name,
        phone: body.phone,
        address: body.address,
        area: body.area?.trim() || null,
        town: body.branch,
        updated_at: new Date().toISOString(),
      },
      {
        name: body.name,
        phone: body.phone,
        address: body.address,
        area: body.area?.trim() || null,
        town: body.branch,
      },
    ];

    let updateError: unknown = null;

    for (const payload of updatePayloads) {
      const updateResult = await supabaseAdmin
        .from(customersTable)
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
// PATCH HANDLER (Assign / Handover / Release ownership)
// Only Admin and Main Admin can call this.
// Body: { id, action: 'assign'|'handover'|'release', to_salesman_id?, to_salesman_name?, reason? }
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Hanya Admin yang boleh urus pemilikan pelanggan' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json();
    const { id: customerId, action, to_salesman_id, to_salesman_name, reason } = body;

    if (!customerId || !action) {
      return NextResponse.json({ error: 'id dan action diperlukan' }, { status: 400 });
    }

    if (!['assign', 'handover', 'release'].includes(action)) {
      return NextResponse.json({ error: 'action mesti assign, handover, atau release' }, { status: 400 });
    }

    if ((action === 'assign' || action === 'handover') && !to_salesman_id) {
      return NextResponse.json({ error: 'to_salesman_id diperlukan untuk assign/handover' }, { status: 400 });
    }

    const primaryCustomersTable = getCustomersTableByBranch(currentUser.branch);
    const fallbackCustomersTable = primaryCustomersTable === 'customers_kb' ? 'customers_kk' : 'customers_kb';

    let customersTable = primaryCustomersTable;

    // Fetch current customer from expected table first.
    let { data: customer, error: fetchErr } = await supabaseAdmin
      .from(customersTable)
      .select('id, name, assigned_to, assigned_to_name')
      .eq('id', customerId)
      .maybeSingle();

    // Migration-safety fallback: if not found in expected table, try the other table.
    if ((!customer || fetchErr) && !fetchErr) {
      const fallbackFetch = await supabaseAdmin
        .from(fallbackCustomersTable)
        .select('id, name, assigned_to, assigned_to_name')
        .eq('id', customerId)
        .maybeSingle();

      if (fallbackFetch.data) {
        customer = fallbackFetch.data;
        customersTable = fallbackCustomersTable;
        fetchErr = null;
      }
    }

    if (fetchErr || !customer) {
      return NextResponse.json({ error: 'Pelanggan tidak dijumpai' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const updateData =
      action === 'release'
        ? { assigned_to: null, assigned_to_name: null, assigned_at: null }
        : {
            assigned_to: to_salesman_id,
            assigned_to_name: to_salesman_name || null,
            assigned_at: nowIso,
          };

    const { error: updateErr } = await supabaseAdmin
      .from(customersTable)
      .update(updateData)
      .eq('id', customerId);

    if (updateErr) {
      console.error('Error updating customer ownership:', updateErr);
      return NextResponse.json({ error: 'Gagal kemaskini pemilikan' }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from('customer_ownership_log').insert({
      customer_id: customerId,
      customer_name: customer.name,
      customer_table: customersTable,
      from_salesman_id: customer.assigned_to || null,
      from_salesman_name: customer.assigned_to_name || null,
      to_salesman_id: action === 'release' ? null : to_salesman_id,
      to_salesman_name: action === 'release' ? null : (to_salesman_name || null),
      action,
      reason: reason || null,
      done_by: currentUser.id,
      done_by_name: currentUser.name || null,
      branch: currentUser.branch || null,
    });

    return NextResponse.json({ message: 'Pemilikan pelanggan dikemaskini' });

  } catch (error) {
    console.error('Error in PATCH /api/customers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    // Get the correct customers table based on user's branch
    const customersTable = getCustomersTableByBranch(currentUser.branch);

    // Check customer exists
    const { data: customer, error: fetchError } = await supabaseAdmin
      .from(customersTable)
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
      .from(customersTable)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', customerId);

    if (softDeleteResult.error && isMissingColumnError(softDeleteResult.error, 'updated_at')) {
      softDeleteResult = await supabaseAdmin
        .from(customersTable)
        .update({ is_active: false })
        .eq('id', customerId);
    }

    if (softDeleteResult.error && isMissingColumnError(softDeleteResult.error, 'is_active')) {
      const hardDeleteResult = await supabaseAdmin
        .from(customersTable)
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
