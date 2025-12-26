import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const users = await db.users.getAll();
    const user = users.find((u) => u.username === username && u.password === password);

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create a simple session cookie
    const response = NextResponse.json({ success: true, role: user.role, name: user.name });
    
    // In a real app, use a secure token (JWT). For this prototype, we store user info in a cookie.
    const sessionData = JSON.stringify({ id: user.id, role: user.role, name: user.name });
    
    response.cookies.set('session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
