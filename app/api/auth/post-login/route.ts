import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logLogin, maskIp, parseDevice } from '@/lib/db/activityLogs';

export async function GET(req: NextRequest) {
  // Determine redirect target first — always redirect to /stocks
  // (even if token is unavailable due to Vercel cookie propagation timing)
  const { searchParams } = new URL(req.url);
  const callbackUrl = searchParams.get('callbackUrl') || '/stocks';
  let redirectTo = '/stocks';
  try {
    const parsed = new URL(callbackUrl, req.url);
    if (parsed.origin === new URL(req.url).origin) {
      redirectTo = parsed.pathname + parsed.search;
    }
  } catch {
    // ignore bad callbackUrl
  }

  // Try to log the login — but never block the redirect on token failure
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token?.email) {
      const email = (token.email as string).toLowerCase();
      const ua = req.headers.get('user-agent') || '';
      const xForwardedFor = req.headers.get('x-forwarded-for');
      const rawIp = xForwardedFor ? xForwardedFor.split(',')[0].trim() : '0.0.0.0';
      logLogin({
        email,
        ip: maskIp(rawIp),
        userAgent: ua,
        device: parseDevice(ua),
      }).catch(() => {});
    }
  } catch {
    // never block redirect on error
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}
