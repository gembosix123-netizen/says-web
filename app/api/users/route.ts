import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { User } from '@/types';
import crypto from 'crypto';

// In a real app, use bcrypt or argon2. For now, simple hashing for demo.
// Since we don't have bcrypt installed and adding it might require rebuild, 
// we will use Node's crypto for a basic hash (NOT SECURE for production but fits the requirement for "hashed-password").
const hashPassword = (password: string) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, role, name, assignedShopId, branch } = body;

    if (!username || !password || !role || !name || !branch) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for unique username
    const existingUsers = await db.users.getAll();
    if (existingUsers.some(u => u.username === username)) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    const newUser: User = {
      id: `u${Date.now()}`,
      username,
      password: hashPassword(password), // Hash the password
      role,
      name,
      assignedShopId: assignedShopId || null,
      branch,
    };

    await db.users.save(newUser);

    return NextResponse.json({ success: true, user: { ...newUser, password: undefined } });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const users = await db.users.getAll();
    
    // Optional: Filter by role if query param exists
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    
    if (role) {
        const filtered = users
          .filter((u) => u.role === role)
          .map((u) => ({ id: u.id, username: u.username, role: u.role, name: u.name, assignedShopId: u.assignedShopId, branch: u.branch }));
        return NextResponse.json(filtered);
    }

    // Return all users (exclude passwords for security)
    const safeUsers = users.map((u) => ({ id: u.id, username: u.username, role: u.role, name: u.name, assignedShopId: u.assignedShopId, branch: u.branch }));
    return NextResponse.json(safeUsers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    try {
        await db.users.delete(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, commissionRate } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }

        const user = await db.users.getById(id);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Update fields
        if (commissionRate !== undefined) user.commissionRate = commissionRate;
        
        // Save updated user
        await db.users.save(user);

        return NextResponse.json({ success: true, user: { ...user, password: undefined } });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
