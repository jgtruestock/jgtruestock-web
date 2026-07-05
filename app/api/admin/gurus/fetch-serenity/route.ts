/**
 * PR 2 — Serenity X tweets re-fetch
 * Each tweet → individual guru_content doc.
 * Clears old batch Serenity records first, then imports all tweets.
 */
import { NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface TrackSerenityTweet {
  id: string;
  text: string;
  createdAt: string;
  url: string;
  cashtags?: string[];
  quotedTweet?: { text?: string } | null;
  isRetweet?: boolean;
}

interface TrackSerenityResponse {
  tweets: TrackSerenityTweet[];
}

function parseTwitterDate(dateStr: string): Date {
  // "Sun Jul 05 13:38:44 +0000 2026" — natively parseable by JS Date
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(_request: Request) {
  const db = await getJgtDb();

  // ── 1. Find Serenity channel ───────────────────────────────────────────────
  const channel = await db.collection('guru_channels').findOne({ name: 'Serenity (白毛股神)' });
  if (!channel) {
    return NextResponse.json({ error: 'Serenity channel not found in guru_channels' }, { status: 404 });
  }

  const dataUrl = channel.dataUrl as string | null;
  if (!dataUrl) {
    return NextResponse.json({ error: 'Serenity channel has no dataUrl set' }, { status: 400 });
  }

  // ── 2. Fetch signal data ───────────────────────────────────────────────────
  let data: TrackSerenityResponse;
  try {
    const res = await fetch(dataUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json() as TrackSerenityResponse;
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch Serenity data: ${String(err)}` },
      { status: 500 }
    );
  }

  const tweets = data.tweets ?? [];
  if (tweets.length === 0) {
    return NextResponse.json({ error: 'No tweets in response' }, { status: 400 });
  }

  // ── 3. Clear old Serenity batch records ───────────────────────────────────
  const deleteResult = await db.collection('guru_content').deleteMany({ channelName: 'Serenity' });

  // ── 4. Insert each tweet as individual guru_content ───────────────────────
  const channelId = channel._id as ObjectId;
  const now = new Date();
  let inserted = 0;
  let skipped = 0;

  for (const tweet of tweets) {
    if (!tweet.id) { skipped++; continue; }

    // Build rawContent: tweet text + quoted tweet if present
    const rawContent = tweet.quotedTweet?.text
      ? `${tweet.text}\n\n[引用推文]\n${tweet.quotedTweet.text}`
      : tweet.text;

    const doc = {
      // New-schema fields
      channelId: channelId.toString(),
      channelName: 'Serenity',
      platform: 'x',
      externalId: tweet.id,
      url: tweet.url || `https://twitter.com/aleabitoreddit/status/${tweet.id}`,
      publishedAt: parseTwitterDate(tweet.createdAt),
      title: tweet.text.slice(0, 80),
      rawContent,
      transcriptSource: 'direct' as const,
      mentionedTickers: tweet.cashtags ?? [],
      status: 'active' as const,
      metadata: { cashtags: tweet.cashtags ?? [] },
      fetchedAt: now,
      updatedAt: now,
      // Keep videoId for backward compat with existing queries
      videoId: `x_serenity_${tweet.id}`,
      type: 'x',
    };

    // Upsert by externalId+platform to prevent duplicates on re-run
    await db.collection('guru_content').updateOne(
      { externalId: tweet.id, platform: 'x' },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    inserted++;
  }

  return NextResponse.json({
    deleted: deleteResult.deletedCount,
    inserted,
    skipped,
    total: tweets.length,
  });
}
