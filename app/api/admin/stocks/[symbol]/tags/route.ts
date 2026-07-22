/**
 * GET /api/admin/stocks/[symbol]/tags  — 取得標籤
 * PUT /api/admin/stocks/[symbol]/tags  — 更新標籤（需要 admin session）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { getTagsMap, setStockTags } from '@/lib/db/stockTags';

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();
  const tagsMap = await getTagsMap([symbol]);
  return NextResponse.json({ symbol, tags: tagsMap[symbol] ?? [] });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();

  const body = await req.json();
  const tags: string[] = Array.isArray(body.tags) ? body.tags : [];

  await setStockTags(symbol, tags);
  return NextResponse.json({ success: true, symbol, tags });
}
