import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Exclude static assets, api, and _next folders from middleware logic
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') || // Exclude files with extensions (images, etc.)
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('session');
  const isLoginPage = pathname === '/login';

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
