/**
 * Authentication and Authorization Helper Functions
 * Used across API routes to validate user session and permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  name: string;
  branch: string;
}

/**
 * Check if user is authenticated
 * Extracts and validates session cookie
 */
export async function checkAuth(request: NextRequest): Promise<{ user: AuthUser | null; error: NextResponse | null }> {
  try {
    const sessionCookie = request.cookies.get('session');
    
    if (!sessionCookie) {
      const errorResponse = NextResponse.json(
        { error: 'Not authenticated. Please login.' },
        { status: 401 }
      );
      return { user: null, error: errorResponse };
    }

    let sessionValue = sessionCookie.value;
    try {
      sessionValue = decodeURIComponent(sessionValue);
    } catch (e) {
      // Session value is not URL-encoded, use as-is
    }

    const sessionData = JSON.parse(sessionValue) as { id: string };

    // Verify user still exists and get latest data
    const users = await db.users.getAll();
    const user = users.find(u => u.id === sessionData.id);

    if (!user) {
      const errorResponse = NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
      errorResponse.cookies.delete('session');
      return { user: null, error: errorResponse };
    }

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name || user.username,
      branch: user.branch || 'HQ',
    };

    return { user: authUser, error: null };
  } catch (error) {
    console.error('[AUTH] Session validation error:', error);
    const errorResponse = NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    );
    errorResponse.cookies.delete('session');
    return { user: null, error: errorResponse };
  }
}

/**
 * Check if user has required role
 * Role hierarchy: Main Admin > Admin > Sales > Merchandiser
 */
export function hasRole(userRole: string, requiredRoles: string | string[]): boolean {
  const roleHierarchy = {
    'Main Admin': 5,
    'Admin': 4,
    'Sales': 3,
    'Merchandiser': 2,
    'User': 1,
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
  const requiredRolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  const requiredLevel = Math.max(
    ...requiredRolesArray.map(role => roleHierarchy[role as keyof typeof roleHierarchy] || 0)
  );

  return userLevel >= requiredLevel;
}

/**
 * Middleware to check auth and role
 * Returns error response if not authorized
 */
export async function requireAuth(
  request: NextRequest,
  requiredRoles?: string | string[]
): Promise<{ user: AuthUser | null; error: NextResponse | null }> {
  const { user, error } = await checkAuth(request);

  if (error) {
    return { user: null, error };
  }

  if (user && requiredRoles && !hasRole(user.role, requiredRoles)) {
    const errorResponse = NextResponse.json(
      { error: 'Insufficient permissions. Required role: ' + (Array.isArray(requiredRoles) ? requiredRoles.join(' or ') : requiredRoles) },
      { status: 403 }
    );
    return { user: null, error: errorResponse };
  }

  return { user, error: null };
}

/**
 * Check if user can access specific branch
 * Main Admin can access all branches, others only their own
 */
export function canAccessBranch(userRole: string, userBranch: string, targetBranch?: string): boolean {
  if (userRole === 'Main Admin') return true;
  if (!targetBranch) return true; // No specific branch required
  return userBranch === targetBranch;
}
