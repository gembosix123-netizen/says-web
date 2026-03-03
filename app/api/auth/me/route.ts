import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeRole } from '@/lib/roles';
import { getSessionUserFromRequest } from '@/lib/session';

export async function GET(request: NextRequest) {
  const sessionData = getSessionUserFromRequest(request);
  if (!sessionData) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Verify user still exists
    const users = await db.users.getAll();
    const user = users.find(u => u.id === sessionData.id);
    
    if (!user) {
         return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    return NextResponse.json({ 
        id: user.id, 
        username: user.username, 
        role: normalizeRole(user.role) || user.role,
        name: user.name,
        branch: user.branch
    });
  } catch (error) {
    console.error('[AUTH/ME] Session parsing error:', error);

    // Clear the invalid cookie
    const response = NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    response.cookies.delete('session');
    return response;
  }
}
