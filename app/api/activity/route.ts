import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logEvent, checkRateLimit, isValidEventType } from '@/lib/db/activityLogs';

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { type?: string; page?: string; symbol?: string; meta?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, page, symbol, meta } = body;

  // Validate type (allowlist)
  if (!type || !isValidEventType(type)) {
    return NextResponse.json(
      { error: 'Invalid type. Must be one of: page_view, stock_view, btn_click' },
      { status: 400 }
    );
  }

  // Validate page
  if (!page || typeof page !== 'string' || page.length > 200) {
    return NextResponse.json({ error: 'page is required and must be ≤ 200 chars' }, { status: 400 });
  }

  // Validate symbol
  const cleanSymbol = symbol ? symbol.toUpperCase().slice(0, 10) : undefined;

  const email = (token.email as string).toLowerCase();

  // Rate limit: max 30 events/minute per email
  const allowed = await checkRateLimit(email);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Fire-and-forget — do NOT await
  logEvent({
    email,
    type,
    page,
    ...(cleanSymbol ? { symbol: cleanSymbol } : {}),
    ...(meta ? { meta } : {}),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
