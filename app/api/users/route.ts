import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { createUserSchema } from '@/lib/validations';
import { buildAuditChanges, logAuditEvent } from '@/lib/audit';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest, type SessionUser } from '@/lib/session';
import { canManageUsers } from '@/lib/permissions';

const ALLOWED_ROLES = ['Main Admin', 'Admin', 'Sales'] as const;
const ALLOWED_BRANCHES = ['HQ', 'Kota Kinabalu', 'Kinabatangan'] as const;

// Bcrypt salt rounds - higher is more secure but slower
const SALT_ROUNDS = 10;

function mapUser(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    username: row.username as string,
    role: row.role as string,
    name: row.name as string,
    branch: row.branch as string,
    commissionRate: (row.commission_rate as number | undefined) ?? 0,
    created_at: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedCurrentRole = normalizeRole(currentUser.role);

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('id');
    const branch = searchParams.get('branch');
    const role = searchParams.get('role');

    let query = supabaseAdmin.from('users').select('*');

    if (userId) query = query.eq('id', userId);
    if (branch) query = query.eq('branch', branch);
    if (role) query = query.eq('role', role);

    if (normalizedCurrentRole === 'Admin') {
      query = query.eq('branch', currentUser.branch);
    } else if (normalizedCurrentRole === 'Sales') {
      query = query.eq('id', currentUser.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const users = (data || []).map(mapUser);
    if (userId) {
      const user = users[0];
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      return NextResponse.json(user);
    }

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actorRole = normalizeRole(currentUser.role);
    if (!canManageUsers(actorRole)) {
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'user_management',
        action: 'create_user',
        entityType: 'user',
        status: 'denied',
        sourceSystem: 'supabase',
      });
      return NextResponse.json({ error: 'Unauthorized - only admin can create users' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const rawBody = await request.json();
    const body = {
      name: rawBody.name ?? rawBody.full_name,
      username: rawBody.username,
      password: rawBody.password ?? rawBody.passwordHash,
      role: rawBody.role,
      branch: rawBody.branch,
      commissionRate: rawBody.commissionRate,
    };

    // Validate input with Zod
    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
      return NextResponse.json({ error: 'Ralat pengesahan', details: errors }, { status: 400 });
    }

    const validatedData = validation.data;

    if (actorRole === 'Admin' && validatedData.branch !== currentUser.branch) {
      return NextResponse.json({ error: 'Admin can only create users in their own branch' }, { status: 403 });
    }

    if (validatedData.role === 'Main Admin' && validatedData.branch !== 'HQ') {
      return NextResponse.json({ error: 'Main Admin must be assigned to HQ' }, { status: 400 });
    }

    if (validatedData.role !== 'Main Admin' && validatedData.branch === 'HQ') {
      return NextResponse.json({ error: 'Only Main Admin can be assigned to HQ' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', validatedData.username)
      .limit(1);

    if (existingError) {
      return NextResponse.json({ error: 'Failed to validate username' }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    // Hash password using bcrypt (async operation)
    const hashedPassword = await bcrypt.hash(validatedData.password, SALT_ROUNDS);
    const commissionRate = validatedData.role === 'Sales' ? Number(validatedData.commissionRate ?? 0.04) : 0;

    // Use correct column names matching Supabase schema
    const payload = {
      username: validatedData.username,
      name: validatedData.name,
      password: hashedPassword,
      role: validatedData.role,
      branch: validatedData.branch,
      commission_rate: commissionRate,
    };

    const { data: createdUser, error } = await supabaseAdmin
      .from('users')
      .insert(payload)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error creating user:', error);
      const message = `${error?.message || ''}`.toLowerCase().includes('duplicate')
        ? 'Username already exists'
        : 'Failed to create user';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (!createdUser) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'user_management',
      action: 'create_user',
      entityType: 'user',
      entityId: createdUser.id,
      branch: createdUser.branch,
      status: 'success',
      sourceSystem: 'supabase',
      metadata: {
        username: createdUser.username,
        role: createdUser.role,
      },
      changes: [
        { field: 'created', newValue: { id: createdUser.id, username: createdUser.username, role: createdUser.role, branch: createdUser.branch } },
      ],
    });

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: mapUser(createdUser),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json();
    const userId = body.id || request.nextUrl.searchParams.get('id');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canUpdate =
      normalizeRole(currentUser.role) === 'Main Admin' ||
      (normalizeRole(currentUser.role) === 'Admin' && currentUser.branch === targetUser.branch) ||
      currentUser.id === userId;

    if (!canUpdate) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    const normalizedCurrentRole = normalizeRole(currentUser.role);

    if (typeof body.name === 'string') {
      updates.name = body.name;
      updates.full_name = body.name;
    }

    if (typeof body.username === 'string') updates.username = body.username;

    if (typeof body.role === 'string' && ALLOWED_ROLES.includes(body.role)) {
      if (normalizedCurrentRole === 'Main Admin') {
        updates.role = body.role;
      } else if (normalizedCurrentRole === 'Admin') {
        // Admin cannot create/promote Main Admin
        if (body.role !== 'Main Admin') {
          updates.role = body.role;
        }
      }
    }

    if (typeof body.branch === 'string' && ALLOWED_BRANCHES.includes(body.branch)) {
      if (normalizedCurrentRole === 'Main Admin') {
        updates.branch = body.branch;
      } else if (normalizedCurrentRole === 'Admin') {
        // Admin can only assign within their own branch
        if (body.branch === currentUser.branch) {
          updates.branch = body.branch;
        }
      }
    }

    if (typeof body.password === 'string' && body.password.trim().length >= 6) {
      // Hash password using bcrypt (async operation)
      const hashed = await bcrypt.hash(body.password.trim(), SALT_ROUNDS);
      updates.password = hashed;
      updates.password_hash = hashed;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
    }

    const beforeData = {
      name: targetUser.name,
      username: targetUser.username,
      role: targetUser.role,
      branch: targetUser.branch,
    };

    const afterData = {
      ...beforeData,
      ...('name' in updates ? { name: updates.name } : {}),
      ...('username' in updates ? { username: updates.username } : {}),
      ...('role' in updates ? { role: updates.role } : {}),
      ...('branch' in updates ? { branch: updates.branch } : {}),
    };

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (updateError) {
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.name;
      delete fallbackUpdates.full_name;
      delete fallbackUpdates.password_hash;

      const { error: fallbackError } = await supabaseAdmin
        .from('users')
        .update(fallbackUpdates)
        .eq('id', userId);

      if (fallbackError) {
        console.error('Error updating user:', fallbackError);
        await logAuditEvent({
          request,
          actor: currentUser,
          module: 'user_management',
          action: 'update_user',
          entityType: 'user',
          entityId: userId,
          branch: targetUser.branch,
          status: 'failed',
          sourceSystem: 'supabase',
          metadata: {
            error: fallbackError.message,
          },
        });
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
      }
    }

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'user_management',
      action: 'update_user',
      entityType: 'user',
      entityId: userId,
      branch: String(afterData.branch || targetUser.branch || ''),
      status: 'success',
      sourceSystem: 'supabase',
      changes: buildAuditChanges(beforeData, afterData),
    });

    return NextResponse.json({ message: 'User updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actorRole = normalizeRole(currentUser.role);
    if (!canManageUsers(actorRole)) {
      return NextResponse.json({ error: 'Only admin can update branch assignments' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json();
    const userId = body.id;
    const branch = body.branch;

    if (!userId || !branch || !ALLOWED_BRANCHES.includes(branch)) {
      return NextResponse.json({ error: 'Valid user ID and branch are required' }, { status: 400 });
    }

    if (actorRole === 'Admin' && branch !== currentUser.branch) {
      return NextResponse.json({ error: 'Admin can only assign users to their own branch' }, { status: 403 });
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('id, role, branch')
      .eq('id', userId)
      .maybeSingle();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.role === 'Main Admin') {
      return NextResponse.json({ error: 'Main Admin branch cannot be changed' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ branch })
      .eq('id', userId);

    if (error) {
      console.error('Error updating branch:', error);
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'user_management',
        action: 'reassign_branch',
        entityType: 'user',
        entityId: userId,
        branch,
        status: 'failed',
        sourceSystem: 'supabase',
        metadata: {
          error: error.message,
        },
      });
      return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 });
    }

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'user_management',
      action: 'reassign_branch',
      entityType: 'user',
      entityId: userId,
      branch,
      status: 'success',
      sourceSystem: 'supabase',
      changes: [
        { field: 'branch', oldValue: targetUser.branch, newValue: branch },
      ],
    });

    return NextResponse.json({ message: 'User branch updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating branch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const actorRole = normalizeRole(currentUser.role);
    if (!canManageUsers(actorRole)) {
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'user_management',
        action: 'delete_user',
        entityType: 'user',
        status: 'denied',
        sourceSystem: 'supabase',
      });
      return NextResponse.json({ error: 'Unauthorized - only admin can delete users' }, { status: 403 });
    }

    const userId = request.nextUrl.searchParams.get('id');
    const reason = request.nextUrl.searchParams.get('reason');
    const referenceNo = request.nextUrl.searchParams.get('referenceNo');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Reason is required for delete action' }, { status: 400 });
    }

    if (currentUser.id === userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('id, role, branch')
      .eq('id', userId)
      .maybeSingle();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.role === 'Main Admin') {
      return NextResponse.json({ error: 'Cannot delete Main Admin account' }, { status: 400 });
    }

    if (actorRole === 'Admin' && targetUser.branch !== currentUser.branch) {
      return NextResponse.json({ error: 'Admin can only delete users from their own branch' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      await logAuditEvent({
        request,
        actor: currentUser,
        module: 'user_management',
        action: 'delete_user',
        entityType: 'user',
        entityId: userId,
        branch: targetUser.branch,
        status: 'failed',
        sourceSystem: 'supabase',
        metadata: {
          error: deleteError.message,
        },
      });
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'user_management',
      action: 'delete_user',
      entityType: 'user',
      entityId: userId,
      branch: targetUser.branch,
      status: 'success',
      reason,
      referenceNo: referenceNo || undefined,
      sourceSystem: 'supabase',
      changes: [
        {
          field: 'deleted_user',
          oldValue: {
            id: targetUser.id,
            role: targetUser.role,
            branch: targetUser.branch,
          },
          newValue: null,
        },
      ],
    });

    return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
