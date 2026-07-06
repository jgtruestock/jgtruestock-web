import { NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getJgtDb();
    const channels = await db.collection('guru_channels').find({}).sort({ createdAt: -1 }).toArray();

    // Enrich with content counts
    const enriched = await Promise.all(
      channels.map(async (ch) => {
        const channelId = ch.channelId || ch.handle || String(ch._id);
        const contentCount = await db.collection('guru_content').countDocuments({ channelId });
        return {
          _id: String(ch._id),
          name: ch.name ?? '',
          type: ch.type ?? ch.platform ?? 'unknown',
          url: ch.url ?? '',
          rssUrl: ch.rssUrl ?? '',
          active: ch.active !== false,
          updatedAt: ch.updatedAt?.toISOString?.() ?? null,
          contentCount,
        };
      })
    );

    return NextResponse.json({ channels: enriched });
  } catch (err) {
    console.error('GET /api/admin/gurus/channels error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
