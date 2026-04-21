import { NextRequest } from 'next/server';

type SessionUser = {
  id: string;
  username?: string;
  name?: string;
  role: string;
  branch?: string;
};

export function getSessionUserFromRequest(request: Request | NextRequest): SessionUser | null {
  try {
    const cookieStore = (request as NextRequest).cookies;
    const raw = cookieStore?.get('session')?.value;
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}
