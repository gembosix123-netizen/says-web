import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const session = (request as any).cookies.get('session');
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Log the raw session value for debugging
    console.log('[AUTH/ME] Raw session value:', session.value);
    
    // Try to decode if it's URL-encoded
    let sessionValue = session.value;
    try {
      sessionValue = decodeURIComponent(session.value);
      console.log('[AUTH/ME] Decoded session value:', sessionValue);
    } catch (decodeError) {
      console.log('[AUTH/ME] Session value is not URL-encoded');
    }
    
    const sessionData = JSON.parse(sessionValue);
    console.log('[AUTH/ME] Parsed session data:', sessionData);
    
    // Verify user still exists
    const users = await db.users.getAll();
    const user = users.find(u => u.id === sessionData.id);
    
    if (!user) {
         return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    return NextResponse.json({ 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        name: user.name,
        branch: user.branch
    });
  } catch (error) {
    console.error('[AUTH/ME] Session parsing error:', error);
    console.error('[AUTH/ME] Session value that failed:', session.value);
    
    // Clear the invalid cookie
    const response = NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    response.cookies.delete('session');
    return response;
  }
}
