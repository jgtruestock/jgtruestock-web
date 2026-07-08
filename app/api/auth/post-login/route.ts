import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logLogin, maskIp, parseDevice } from '@/lib/db/activityLogs';

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Determine redirect target
  const { searchParams } = new URL(req.url);
  const callbackUrl = searchParams.get('callbackUrl') || '/stocks';

  // If not logged in, send to login
  if (!token?.email) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const email = (token.email as string).toLowerCase();
  const ua = req.headers.get('user-agent') || '';

  // Get real IP (Vercel / proxy aware)
  const xForwardedFor = req.headers.get('x-forwarded-for');
  const rawIp = xForwardedFor ? xForwardedFor.split(',')[0].trim() : '0.0.0.0';

  // Fire-and-forget login log
  logLogin({
    email,
    ip: maskIp(rawIp),
    userAgent: ua,
    device: parseDevice(ua),
  }).catch(() => {}); // never block redirect

  // Redirect to stocks (or callbackUrl if safe)
  let redirectTo = '/stocks';
  try {
    const parsed = new URL(callbackUrl, req.url);
    // Only allow same-origin redirects
    if (parsed.origin === new URL(req.url).origin) {
      redirectTo = parsed.pathname + parsed.search;
    }
  } catch {
    // ignore bad callbackUrl
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}
