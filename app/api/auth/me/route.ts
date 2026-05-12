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
    const users = await db.users.getAll();
    const user = users.find((u) => u.id === sessionData.id);

    if (user) {
      return NextResponse.json({
        id: user.id,
        username: user.username,
        role: normalizeRole(user.role) || user.role,
        name: user.name,
        branch: user.branch,
        voidOtpRequired:
          process.env.VOID_OTP_REQUIRED === 'true' || process.env.VOID_OTP_REQUIRED === '1',
      });
    }

    /**
     * Log masuk melalui Supabase — pengguna wujud di DB awan tetapi baris yang sama mungkin
     * tiada dalam KV / users.json. Kuki sesi masih sah; jangan balas 401 atau jurujual tidak
     * boleh isi id pada borang / API yang bergantung pada /api/auth/me.
     */
    return NextResponse.json({
      id: sessionData.id,
      username: '',
      role: normalizeRole(sessionData.role) || sessionData.role,
      name: sessionData.name ?? 'User',
      branch: sessionData.branch ?? 'HQ',
      voidOtpRequired:
        process.env.VOID_OTP_REQUIRED === 'true' || process.env.VOID_OTP_REQUIRED === '1',
    });
  } catch (error) {
    console.error('[AUTH/ME] Session parsing error:', error);

    // Clear the invalid cookie
    const response = NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    response.cookies.delete('session');
    return response;
  }
}
