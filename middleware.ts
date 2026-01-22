import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
        JSON.parse(session.value);
        return NextResponse.redirect(new URL('/', request.url));
    } catch (e) {
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
      const sessionData = JSON.parse(session.value);
      const { role } = sessionData;

      if (pathname.startsWith('/admin') && role !== 'Admin') {
         return NextResponse.redirect(new URL('/', request.url));
      }
      
      if (pathname.startsWith('/sales') && role !== 'Sales' && role !== 'Admin') {
         return NextResponse.redirect(new URL('/', request.url));
      }

    } catch (e) {
      // Invalid session, force logout/login
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
