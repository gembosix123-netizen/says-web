import type { NextRequest } from 'next/server';

export type SessionUser = {
  id: string;
  role: string;
  branch?: string;
  name?: string;
  username?: string;
};

export function parseSessionCookieValue(sessionValue: string | null | undefined): SessionUser | null {
  if (!sessionValue) return null;

  let raw = sessionValue;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // keep original raw value when not URL encoded
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.role) return null;
    return parsed as SessionUser;
  } catch {
    return null;
  }
}

export function getSessionUserFromRequest(request: NextRequest): SessionUser | null {
  const session = request.cookies.get('session');
  return parseSessionCookieValue(session?.value);
}

export function getSessionUserFromCookieString(cookieString: string): SessionUser | null {
  if (!cookieString) return null;

  const sessionPair = cookieString
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('session='));

  if (!sessionPair) return null;

  const sessionValue = sessionPair.slice('session='.length);
  return parseSessionCookieValue(sessionValue);
}
