/**
 * PR 4 — Content detail API
 * GET /api/admin/gurus/content/[id]
 * Returns full rawContent (never truncated) for a single guru_content doc.
 */
import { NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return NextResponse.json({ error: 'Invalid id format' }, { status: 400 });
  }

  const db = await getJgtDb();
  const doc = await db.collection('guru_content').findOne({ _id: objectId });

  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Return full content — rawContent is never truncated
  return NextResponse.json({
    _id: String(doc._id),
    title: doc.title ?? '',
    channelName: doc.channelName ?? '',
    platform: doc.platform ?? doc.type ?? 'youtube',
    publishedAt: doc.publishedAt instanceof Date
      ? doc.publishedAt.toISOString()
      : String(doc.publishedAt ?? ''),
    rawContent: doc.rawContent ?? doc.transcript ?? null,
    summary: doc.summary ?? null,
    mentionedTickers: doc.mentionedTickers ?? [],
    url: doc.url ?? null,
    status: doc.status ?? null,
  });
}
