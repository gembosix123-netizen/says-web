import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { normalizeRole, type NormalizedRole } from '@/lib/roles';
import { canAccessAdminPath, canAccessMerchandiserRoutes, canAccessSalesRoutes } from '@/lib/permissions';

// Standard Next.js Middleware
// Note: Do not rename to proxy.ts unless strictly required by specific custom server configs.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Exclude static assets and _next folders from middleware logic
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    /\.(png|jpg|jpeg|gif|svg|ico|css|js)$/.test(pathname) // Better static file check
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('session');
  const isLoginPage = pathname === '/login';

  // 2. API Protection
  if (pathname.startsWith('/api')) {
    // Public API routes
    if (
      pathname.startsWith('/api/auth/login') ||
      pathname.startsWith('/api/auth/logout')
    ) {
        return NextResponse.next();
    }

    // Protect other API routes
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Allow request to proceed if session exists
    return NextResponse.next();
  }

  // 2. Auth Logic
  
  // If user is logged in and visits login page, redirect to home
  if (isLoginPage && session) {
    // Verify session validity before redirecting
    try {
        // Try to decode if URL-encoded
        let sessionValue = session.value;
        try {
          sessionValue = decodeURIComponent(session.value);
        } catch (decodeError) {
          // Not URL-encoded, use as is
        }
        
        const sessionData = JSON.parse(sessionValue);
        // Redirect founder (Main Admin) to /admin  
        if (sessionData.role === 'Main Admin') {
          return NextResponse.redirect(new URL('/admin', request.url));
        }
        return NextResponse.redirect(new URL('/', request.url));
    } catch (e) {
        console.error('[MIDDLEWARE] Invalid session on login page:', e);
        // Invalid session, let them stay on login page and maybe clear cookie
        const response = NextResponse.next();
        response.cookies.delete('session');
        return response;
    }
  }

  // If user is NOT logged in and tries to access protected pages (anything other than login)
  if (!isLoginPage && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. Role-based access control for protected paths
  if (session) {
    try {
      // Try to decode if URL-encoded
      let sessionValue = session.value;
      try {
        sessionValue = decodeURIComponent(session.value);
      } catch (decodeError) {
        // Not URL-encoded, use as is
      }
      
      const sessionData = JSON.parse(sessionValue);
      const role = normalizeRole(sessionData.role);
      const { branch } = sessionData;

      // Redirect Main Admin (founder) to /admin
      if (role === 'Main Admin' && (pathname === '/' || pathname === '/dashboard')) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      
      // Redirect Merchandiser to their dashboard
      if (role === 'Merchandiser' && (pathname === '/' || pathname === '/dashboard')) {
        return NextResponse.redirect(new URL('/merchandiser', request.url));
      }
      
      // Redirect Sales to sales dashboard (choice between sales and merchandiser)
      if (role === 'Sales' && pathname === '/') {
        return NextResponse.redirect(new URL('/sales-dashboard', request.url));
      }

      if (pathname.startsWith('/admin')) {
        if (!canAccessAdminPath(role, pathname)) {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }

        // Branch restrictions for Admins
        if (role === 'Admin' && branch === 'Kinabatangan' && pathname.startsWith('/admin/kota-kinabalu')) {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
        if (role === 'Admin' && branch === 'Kota Kinabalu' && pathname.startsWith('/admin/kinabatangan')) {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }

        // Global monitor only for Main Admin
        if (pathname.startsWith('/admin/global-monitor') && role !== 'Main Admin') {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
      }
      
      // Sales routes - only Sales role can create sales (not Merchandiser)
      if (pathname.startsWith('/sales') && !canAccessSalesRoutes(role)) {
         return NextResponse.redirect(new URL('/', request.url));
      }
      
      // Merchandiser routes - both Merchandiser and Sales can access (Sales can do merchandiser work)
      if (pathname.startsWith('/merchandiser')) {
        if (!canAccessMerchandiserRoutes(role)) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      }

    } catch (e) {
      // Invalid session, force logout/login
      console.error('[MIDDLEWARE] Invalid session error:', e);
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  // Matcher to run middleware on all paths except static assets
  // This ensures our auth logic runs globally
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
