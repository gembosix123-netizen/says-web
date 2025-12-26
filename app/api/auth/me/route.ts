import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const session = (request as any).cookies.get('session');
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const sessionData = JSON.parse(session.value);
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
        name: user.name 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
}
