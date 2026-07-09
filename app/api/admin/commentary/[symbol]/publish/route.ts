/**
 * POST /api/admin/commentary/[symbol]/publish — 發布點評
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { publishCommentary } from '@/lib/db/commentary';

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();

  let title: string | undefined;
  let body: string | undefined;
  try {
    const bodyJson = await req.json();
    title = bodyJson.title;
    body = bodyJson.body;
  } catch {
    // No body is fine
  }

  const publishedAt = await publishCommentary(symbol, { title, body });

  return NextResponse.json({
    success: true,
    publishedAt: publishedAt.toISOString(),
  });
}
