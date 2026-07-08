import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logActivity } from '@/lib/db/memberActivity';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { page?: string; symbol?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { page, symbol } = body;
  if (!page || typeof page !== 'string') {
    return NextResponse.json({ error: 'page is required' }, { status: 400 });
  }

  const userEmail = session.user.email;
  // Use email as userId (sub not exposed in session by default)
  const userId = userEmail;

  await logActivity({
    userId,
    userEmail,
    type: 'page_view',
    page,
    ...(symbol ? { symbol: symbol.toUpperCase() } : {}),
  });

  return NextResponse.json({ ok: true });
}
