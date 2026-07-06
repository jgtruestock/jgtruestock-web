import { NextResponse } from 'next/server';
import { getGuruChannels, getChannelContentStats } from '@/lib/db/guruContent';
import { getJgtDb } from '@/lib/mongodb';

export async function GET() {
  const channels = await getGuruChannels();

  const channelsWithStats = await Promise.all(
    channels.map(async (ch) => {
      const channelId = ch.channelId || ch.handle || ch.url || '';
      if (ch.type === 'youtube' && ch.channelId) {
        const stats = await getChannelContentStats(ch.channelId);
        return { ...ch, stats };
      }
      return { ...ch, channelId, stats: { total: 0, latestDate: null } };
    })
  );

  // Group by type
  const youtube = channelsWithStats.filter((c) => c.type === 'youtube');
  const x = channelsWithStats.filter((c) => c.type === 'x');
  const substack = channelsWithStats.filter((c) => c.type === 'substack');

  return NextResponse.json({ youtube, x, substack });
}

// POST /api/admin/gurus — 新增頻道
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, platform, url, rssUrl } = body;

    if (!name || !platform) {
      return NextResponse.json({ error: '名稱和平台為必填欄位' }, { status: 400 });
    }

    const db = await getJgtDb();
    const now = new Date();
    const doc = {
      name,
      type: platform,
      url: url || '',
      rssUrl: rssUrl || '',
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('guru_channels').insertOne(doc);
    return NextResponse.json({ ok: true, id: result.insertedId.toString() });
  } catch (err) {
    console.error('POST /api/admin/gurus error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
