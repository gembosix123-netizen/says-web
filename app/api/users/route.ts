import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcrypt';
import { createUserSchema, updateUserSchema } from '@/lib/validations';

type SessionUser = {
  id: string;
  role: 'Main Admin' | 'Admin' | 'Sales' | string;
  branch: string;
  name?: string;
};

const ALLOWED_ROLES = ['Main Admin', 'Admin', 'Sales'] as const;
const ALLOWED_BRANCHES = ['HQ', 'Kota Kinabalu', 'Kinabatangan'] as const;

// Bcrypt salt rounds - higher is more secure but slower
const SALT_ROUNDS = 10;

function isColumnError(error: any): boolean {
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return msg.includes('column') || msg.includes('schema cache');
}

function mapUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    name: row.name ?? row.full_name ?? '',
    branch: row.branch,
    commissionRate: row.commission_rate ?? row.commissionRate,
    created_at: row.created_at,
  };
}

async function getCurrentUser(request: NextRequest): Promise<SessionUser | null> {
  try {
    const session = request.cookies.get('session');
    if (!session?.value) return null;
    const decoded = decodeURIComponent(session.value);
    const data = JSON.parse(decoded);
    if (!data?.id || !data?.role) return null;
    return data as SessionUser;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    if (currentUser.role === 'Admin') {
      query = query.eq('branch', currentUser.branch);
    } else if (currentUser.role === 'Sales') {
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
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (currentUser.role !== 'Main Admin' && currentUser.role !== 'Admin') {
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
      const errors = validation.error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`);
      return NextResponse.json({ error: 'Ralat pengesahan', details: errors }, { status: 400 });
    }

    const validatedData = validation.data;

    if (currentUser.role === 'Admin' && validatedData.branch !== currentUser.branch) {
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
    const commissionRate = validatedData.role === 'Sales' ? Number(validatedData.commissionRate ?? 0.04) : null;

    const payloadCandidates = [
      {
        username: validatedData.username,
        full_name: validatedData.name,
        password: hashedPassword,
        role: validatedData.role,
        branch: validatedData.branch,
        commission_rate: commissionRate,
      },
      {
        username: validatedData.username,
        name: validatedData.name,
        password: hashedPassword,
        role: validatedData.role,
        branch: validatedData.branch,
        commissionRate,
      },
      {
        username: validatedData.username,
        full_name: validatedData.name,
        password_hash: hashedPassword,
        role: validatedData.role,
        branch: validatedData.branch,
      },
    ];

    let createdUser: any = null;
    let lastError: any = null;

    for (const payload of payloadCandidates) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert(payload)
        .select('*')
        .maybeSingle();

      if (!error) {
        createdUser = data;
        break;
      }

      lastError = error;
      if (!isColumnError(error)) break;
    }

    if (!createdUser) {
      console.error('Error creating user:', lastError);
      const message = `${lastError?.message || ''}`.toLowerCase().includes('duplicate')
        ? 'Username already exists'
        : 'Failed to create user';
      return NextResponse.json({ error: message }, { status: 500 });
    }

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
    const currentUser = await getCurrentUser(request);
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
      currentUser.role === 'Main Admin' ||
      (currentUser.role === 'Admin' && currentUser.branch === targetUser.branch) ||
      currentUser.id === userId;

    if (!canUpdate) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updates: any = {};

    if (typeof body.name === 'string') {
      updates.name = body.name;
      updates.full_name = body.name;
    }
    if (typeof body.username === 'string') updates.username = body.username;
    if (typeof body.role === 'string' && ALLOWED_ROLES.includes(body.role)) updates.role = body.role;
    if (typeof body.branch === 'string' && ALLOWED_BRANCHES.includes(body.branch)) updates.branch = body.branch;

    if (typeof body.password === 'string' && body.password.trim().length >= 6) {
      // Hash password using bcrypt (async operation)
      const hashed = await bcrypt.hash(body.password.trim(), SALT_ROUNDS);
      updates.password = hashed;
      updates.password_hash = hashed;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
    }

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
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
      }
    }

    return NextResponse.json({ message: 'User updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (currentUser.role !== 'Main Admin' && currentUser.role !== 'Admin') {
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

    if (currentUser.role === 'Admin' && branch !== currentUser.branch) {
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
      return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 });
    }

    return NextResponse.json({ message: 'User branch updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating branch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    if (currentUser.role !== 'Main Admin' && currentUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized - only admin can delete users' }, { status: 403 });
    }

    const userId = request.nextUrl.searchParams.get('id');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
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

    if (currentUser.role === 'Admin' && targetUser.branch !== currentUser.branch) {
      return NextResponse.json({ error: 'Admin can only delete users from their own branch' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }

    return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
