import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // Paths that require authentication
  const protectedPaths = ['/admin', '/sales'];
  
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtected) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const sessionData = JSON.parse(session.value);
      const { role } = sessionData;

      if (pathname.startsWith('/admin') && role !== 'Admin') {
         // Redirect unauthorized access to home or error
         return NextResponse.redirect(new URL('/', request.url));
      }
      
      // Allow Sales to access /sales (and maybe admin to access sales? usually separate)
      if (pathname.startsWith('/sales') && role !== 'Sales' && role !== 'Admin') {
         return NextResponse.redirect(new URL('/', request.url));
      }

    } catch (e) {
      // Invalid session
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/sales/:path*'],
};
