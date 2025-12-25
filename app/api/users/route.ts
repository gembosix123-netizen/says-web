import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const users = db.users.getAll();
    
    // Optional: Filter by role if query param exists
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    
    if (role) {
        const filtered = users
          .filter((u) => u.role === role)
          .map((u) => ({ id: u.id, username: u.username, role: u.role, name: u.name }));
        return NextResponse.json(filtered);
    }

    // Return all users (exclude passwords for security)
    const safeUsers = users.map((u) => ({ id: u.id, username: u.username, role: u.role, name: u.name }));
    return NextResponse.json(safeUsers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
