/**
 * PR 6 — 統一時間軸 API
 * 合併 guru_content（YouTube/Podcast/X）+ jg_commentary（法說會點評）
 * 按 publishedAt 降序排列
 */
import { NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';

export interface TimelineItem {
  _id: string;
  type: 'youtube' | 'podcast' | 'x' | 'earnings';
  sourceType: string;         // for icon display
  sourceName: string;         // channel name or symbol
  title: string;
  publishedAt: string;        // ISO string
  summary?: string;
  thumbnailUrl?: string;
  mentionedTickers?: string[];
  externalUrl?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('type') || 'all';  // all | youtube | podcast | x | earnings
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  // includeArchived=true to also show archived content
  const includeArchived = searchParams.get('includeArchived') === 'true';

  const db = await getJgtDb();

  const items: TimelineItem[] = [];

  // ── 1. guru_content (YouTube + Podcast + X) ────────────────────────────────
  if (filter === 'all' || filter === 'youtube' || filter === 'podcast' || filter === 'x') {
    const typeFilter: Record<string, any> = {};
    if (filter !== 'all') {
      // DB may store type in 'type' or 'platform' field
      typeFilter.$and = [{ $or: [{ type: filter }, { platform: filter }] }];
    }
    // Exclude archived unless requested
    if (!includeArchived) {
      typeFilter.$or = [
        { status: { $exists: false } },
        { status: null },
        { status: 'active' },
        { status: 'fetched' },
        { status: 'summarized' },
      ];
    }

    const contentDocs = await db
      .collection('guru_content')
      .find(typeFilter)
      .sort({ publishedAt: -1 })
      .limit(filter === 'all' ? Math.floor(limit * 0.7) : limit)
      .toArray();

    for (const doc of contentDocs) {
      const contentType: 'youtube' | 'podcast' | 'x' =
        doc.type === 'podcast' ? 'podcast' :
        doc.type === 'x' ? 'x' :
        'youtube';

      items.push({
        _id: String(doc._id),
        type: contentType,
        sourceType: contentType,
        sourceName: doc.channelName || '',
        title: doc.title || '',
        publishedAt: doc.publishedAt instanceof Date
          ? doc.publishedAt.toISOString()
          : String(doc.publishedAt),
        summary: doc.summary,
        thumbnailUrl: doc.thumbnailUrl,
        mentionedTickers: doc.mentionedTickers,
      });
    }
  }

  // ── 2. jg_commentary (法說會點評) ──────────────────────────────────────────
  if (filter === 'all' || filter === 'earnings') {
    const commentaryDocs = await db
      .collection('jg_commentary')
      .find({ status: { $in: ['draft', 'published'] } })
      .sort({ updatedAt: -1 })
      .limit(filter === 'all' ? Math.floor(limit * 0.3) : limit)
      .toArray();

    for (const doc of commentaryDocs) {
      const title = doc.publishedTitle || doc.draftTitle || `${doc.symbol} 法說會點評`;
      const body = doc.publishedBody || doc.draftBody || '';
      const publishedAt = doc.publishedAt || doc.draftGeneratedAt || doc.updatedAt || doc.createdAt;

      items.push({
        _id: String(doc._id),
        type: 'earnings',
        sourceType: 'earnings',
        sourceName: doc.symbol,
        title,
        publishedAt: publishedAt instanceof Date
          ? publishedAt.toISOString()
          : String(publishedAt || new Date()),
        summary: body ? body.slice(0, 300) + (body.length > 300 ? '...' : '') : undefined,
        mentionedTickers: [doc.symbol],
      });
    }
  }

  // ── Sort all items by publishedAt descending ───────────────────────────────
  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return NextResponse.json({
    items: items.slice(0, limit),
    total: items.length,
    filter,
    timestamp: new Date().toISOString(),
  });
}
