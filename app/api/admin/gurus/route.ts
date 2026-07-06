import { NextResponse } from 'next/server';
import { getGuruChannels, getChannelContentStats } from '@/lib/db/guruContent';

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
