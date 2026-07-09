import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const ADMIN_DISCORD_ID = process.env.ADMIN_DISCORD_ID || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jgdady@gmail.com';

function isAdmin(token: any): boolean {
  if (!token) return false;
  // Discord login
  if (token.provider === 'discord' && token.sub === ADMIN_DISCORD_ID) return true;
  // Google login with admin email
  if (token.provider === 'google' && token.email === ADMIN_EMAIL) return true;
  return false;
}

// Front-end member-only paths
const MEMBER_PATHS = ['/stocks', '/guide'];

// API member-only paths
const MEMBER_API_PATHS = ['/api/mentions', '/api/stocks'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /api/cron/** — skip (handled by CRON_SECRET)
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  // /verify — 綁定頁，已登入才能進，不需要 isYTMember
  if (pathname.startsWith('/verify')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.redirect(new URL('/login', req.url));
    return NextResponse.next();
  }
  if (false) {  // dead code placeholder
    return NextResponse.next();
  }

  // /not-member — 公開頁面，不擋
  if (pathname.startsWith('/not-member')) {
    return NextResponse.next();
  }

  // /api/admin/** — return JSON errors
  if (pathname.startsWith('/api/admin/')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(token)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.next();
  }

  // /admin/** — redirect
  if (pathname.startsWith('/admin/') || pathname === '/admin') {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL('/login/admin', req.url);
      loginUrl.searchParams.set('callbackUrl', req.url);
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdmin(token)) return NextResponse.redirect(new URL('/login/admin', req.url));
    return NextResponse.next();
  }

  // /api/mentions and /api/stocks/** — member-only data APIs
  if (MEMBER_API_PATHS.some((p) => pathname.startsWith(p))) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (isAdmin(token)) return NextResponse.next();
    // Member verification enforced
    if (!token.isYTMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.next();
  }

  // Member-only front-end paths
  if (MEMBER_PATHS.some((p) => pathname.startsWith(p))) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Admin → always allow (Discord or Google admin email)
    if (isAdmin(token)) return NextResponse.next();

    // Member verification enforced
    // Member verification enforced
    if (!token.isYTMember) {
      return NextResponse.redirect(new URL('/verify', req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/api/mentions',
    '/api/stocks/:path*',
    '/admin/:path*',
    '/admin',
    '/stocks/:path*',
    '/stocks',
    '/guide',
    '/guide/:path*',
    '/verify',
    '/verify/:path*',
    '/not-member',
    '/not-member/:path*',
  ],
};
