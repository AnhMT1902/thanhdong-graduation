import { NextResponse } from 'next/server';

export function proxy(request) {
  if (!request.cookies.get('quizify_session')?.value) {
    return NextResponse.redirect(new URL(request.nextUrl.pathname.startsWith('/admin') ? '/admin-login' : '/user-login', request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/admin/:path*', '/user/:path*'] };
