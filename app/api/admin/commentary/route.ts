/**
 * GET /api/admin/commentary — 列出所有股票的點評狀態（後台管理列表用）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdmin } from '@/lib/auth';
import { get13fDb, getJgtDb } from '@/lib/mongodb';
import type { JGCommentary } from '@/types/commentary';

interface PickRecord {
  symbol: string;
  companyName?: string;
  mentionDate?: string;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin((session.user as any)?.discordId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    // 1. Get all active symbols from 13f-tracker DB
    const db13f = await get13fDb();
    const [cached, manual] = await Promise.all([
      db13f.collection<PickRecord>('jg_picks_cache').find({}, { projection: { symbol: 1, companyName: 1, mentionDate: 1 } }).toArray(),
      db13f.collection<PickRecord>('jg_picks_manual').find({}, { projection: { symbol: 1, companyName: 1, mentionDate: 1 } }).toArray(),
    ]);

    // Deduplicate by symbol, prefer cache
    const symbolMap = new Map<string, PickRecord>();
    for (const r of [...manual, ...cached]) {
      symbolMap.set(r.symbol, r);
    }
    const picks = Array.from(symbolMap.values());

    // 2. Get all commentary records
    const jgtDb = await getJgtDb();
    const commentaryDocs = await jgtDb
      .collection<JGCommentary>('jg_commentary')
      .find({})
      .toArray();
    const commentaryMap = new Map(commentaryDocs.map((d) => [d.symbol, d]));

    // 3. Build response
    const records = picks.map((pick) => {
      const c = commentaryMap.get(pick.symbol);
      return {
        symbol: pick.symbol,
        companyName: pick.companyName ?? pick.symbol,
        mentionDate: pick.mentionDate ?? null,
        status: c?.status ?? null,
        draftGeneratedAt: c?.draftGeneratedAt?.toISOString() ?? null,
        publishedAt: c?.publishedAt?.toISOString() ?? null,
        draftTitle: c?.draftTitle ?? null,
        publishedTitle: c?.publishedTitle ?? null,
        updatedAt: c?.updatedAt?.toISOString() ?? null,
      };
    });

    // Sort: stale > draft > published > null
    const statusOrder: Record<string, number> = { stale: 0, draft: 1, published: 2 };
    records.sort((a, b) => {
      const ao = statusOrder[a.status ?? ''] ?? 3;
      const bo = statusOrder[b.status ?? ''] ?? 3;
      return ao - bo;
    });

    const stats = {
      total: records.length,
      published: records.filter((r) => r.status === 'published').length,
      draft: records.filter((r) => r.status === 'draft').length,
      stale: records.filter((r) => r.status === 'stale').length,
      none: records.filter((r) => !r.status).length,
    };

    return NextResponse.json({ records, stats });
  } catch (err: any) {
    console.error('[admin/commentary] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
