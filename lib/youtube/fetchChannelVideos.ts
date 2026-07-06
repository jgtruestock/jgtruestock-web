import { parseStringPromise } from 'xml2js';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  publishedAt: Date;
  channelId: string;
  channelName: string;
  description: string;
  thumbnailUrl: string;
}

export async function fetchChannelVideos(
  channelId: string,
  daysBack = 14
): Promise<YouTubeVideo[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`RSS fetch failed for ${channelId}: ${res.status}`);
  }

  const xml = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false });

  const feed = parsed.feed;
  const channelName: string = feed.title || '';
  const entries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const videos: YouTubeVideo[] = [];

  for (const entry of entries) {
    const publishedAt = new Date(entry.published);
    if (publishedAt < cutoff) continue;

    const videoId: string = entry['yt:videoId'] || '';
    const title: string = entry.title || '';
    const description: string = entry['media:group']?.['media:description'] || '';
    const thumbnailUrl: string = entry['media:group']?.['media:thumbnail']?.['$']?.url || '';

    videos.push({
      videoId,
      title,
      publishedAt,
      channelId,
      channelName,
      description,
      thumbnailUrl,
    });
  }

  return videos;
}
