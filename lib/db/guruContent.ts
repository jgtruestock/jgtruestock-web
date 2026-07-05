import { getJgtDb } from '@/lib/mongodb';

export interface GuruChannel {
  _id?: string;
  channelId?: string;
  handle?: string;
  url?: string;
  name: string;
  type: 'youtube' | 'x' | 'substack';
}

export interface GuruContent {
  _id?: string;
  videoId: string;
  channelId: string;
  channelName: string;
  platform?: string;
  title: string;
  publishedAt: Date;
  description?: string;
  thumbnailUrl?: string;
  // rawContent: full text (transcript / tweet / article). Never truncated.
  rawContent?: string;
  transcript?: string;            // alias kept for backward compat
  transcriptSource?: 'youtube-api' | 'whisper' | 'direct';
  externalId?: string;           // YouTube videoId / Tweet ID / article slug
  url?: string;
  status?: 'active' | 'archived' | 'fetched' | 'summarized' | 'failed' | 'hidden';
  summary?: string;
  mentionedTickers?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  fetchedAt?: Date;
}

export async function upsertGuruContent(content: Omit<GuruContent, '_id'>): Promise<void> {
  const db = await getJgtDb();
  const now = new Date();
  await db.collection('guru_content').updateOne(
    { videoId: content.videoId },
    {
      $set: {
        ...content,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

export async function getGuruContent(
  channelId?: string,
  limit = 20
): Promise<GuruContent[]> {
  const db = await getJgtDb();
  const filter = channelId ? { channelId } : {};
  return db
    .collection<GuruContent>('guru_content')
    .find(filter)
    .sort({ publishedAt: -1 })
    .limit(limit)
    .toArray();
}

export async function getExistingVideoIds(channelId: string): Promise<Set<string>> {
  const db = await getJgtDb();
  const docs = await db
    .collection('guru_content')
    .find({ channelId }, { projection: { videoId: 1 } })
    .toArray();
  return new Set(docs.map((d) => d.videoId as string));
}

export async function getGuruChannels(type?: string): Promise<GuruChannel[]> {
  const db = await getJgtDb();
  const filter = type ? { type } : {};
  return db
    .collection<GuruChannel>('guru_channels')
    .find(filter)
    .toArray();
}

export async function getChannelContentStats(channelId: string): Promise<{
  total: number;
  latestDate: Date | null;
}> {
  const db = await getJgtDb();
  const last14Days = new Date();
  last14Days.setDate(last14Days.getDate() - 14);

  const [total, latest] = await Promise.all([
    db.collection('guru_content').countDocuments({ channelId, publishedAt: { $gte: last14Days } }),
    db
      .collection('guru_content')
      .findOne({ channelId }, { sort: { publishedAt: -1 }, projection: { publishedAt: 1 } }),
  ]);

  return {
    total,
    latestDate: latest?.publishedAt ?? null,
  };
}
