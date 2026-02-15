import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

// Hash password using SHA-256
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const body = await request.json();
    const { username, password } = body;

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log('[LOGIN] Available users:', users?.map(u => ({ id: u.id, username: u.username })));
    
    // Try both plain text and hashed password for compatibility
    const hashedPassword = hashPassword(password);
    const user = users?.find((u) => u.username === username && (u.password === password || u.password === hashedPassword));

    console.log('[LOGIN] Login attempt:', { username, password, hashedPassword });
    console.log('[LOGIN] User found:', user ? { id: user.id, username: user.username } : 'None');

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create a simple session cookie
    const response = NextResponse.json({ success: true, role: user.role, name: user.name, id: user.id, branch: user.branch });
    
    // In a real app, use a secure token (JWT). For this prototype, we store user info in a cookie.
    const sessionData = JSON.stringify({ id: user.id, role: user.role, name: user.name, branch: user.branch });
    
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