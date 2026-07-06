import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const ADMIN_DISCORD_ID = process.env.ADMIN_DISCORD_ID || '';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /api/cron/** — skip (handled by CRON_SECRET)
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  // /api/admin/** — return JSON errors
  if (pathname.startsWith('/api/admin/')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const discordId = token.sub as string | undefined;
    if (!discordId || !ADMIN_DISCORD_ID || discordId !== ADMIN_DISCORD_ID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // /admin/** — redirect
  if (pathname.startsWith('/admin/') || pathname === '/admin') {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', req.url);
      return NextResponse.redirect(loginUrl);
    }
    const discordId = token.sub as string | undefined;
    if (!discordId || !ADMIN_DISCORD_ID || discordId !== ADMIN_DISCORD_ID) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*', '/admin/:path*', '/admin'],
};
