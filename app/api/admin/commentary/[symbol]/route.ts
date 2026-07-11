/**
 * PR 8 — 後台點評管理 API（單支股票）
 * GET  /api/admin/commentary/[symbol] — 取得草稿 + 已發布內容
 * PATCH /api/admin/commentary/[symbol] — 儲存編輯
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { getCommentary, upsertCommentary } from '@/lib/db/commentary';

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();

  const doc = await getCommentary(symbol);
  if (!doc) {
    return NextResponse.json({ symbol, exists: false });
  }

  return NextResponse.json({
    symbol,
    exists: true,
    status: doc.status,
    draftTitle: doc.draftTitle ?? null,
    draftBody: doc.draftBody ?? null,
    draftGeneratedAt: doc.draftGeneratedAt?.toISOString() ?? null,
    draftModel: doc.draftModel ?? null,
    publishedTitle: doc.publishedTitle ?? null,
    publishedBody: doc.publishedBody ?? null,
    publishedAt: doc.publishedAt?.toISOString() ?? null,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
    keyPoints: doc.keyPoints ?? [],
    publishHistory: (doc.publishHistory ?? []).map((h) => ({
      publishedTitle: h.publishedTitle,
      publishedBody: h.publishedBody,
      publishedAt: h.publishedAt instanceof Date ? h.publishedAt.toISOString() : h.publishedAt,
    })).reverse(),
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();

  const body = await req.json();
  const { title, body: bodyText } = body as { title?: string; body?: string };

  if (!title && !bodyText) {
    return NextResponse.json({ error: 'title or body required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (title) updates.draftTitle = title;
  if (bodyText) updates.draftBody = bodyText;

  await upsertCommentary(symbol, updates as any);

  return NextResponse.json({ success: true, status: 'draft' });
}
