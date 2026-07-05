/**
 * PR 5 — Updated Daily Guru Cron
 * Combines: YouTube RSS + Podcast RSS + X 帳號
 *
 * Schedule: 30 22 * * * (UTC 22:30 = 台北 06:30)
 */
import { NextResponse } from 'next/server';
import { fetchChannelVideos } from '@/lib/youtube/fetchChannelVideos';
import { getTranscript } from '@/lib/youtube/getTranscript';
import { summarizeGuruContent } from '@/lib/ai/summarizeGuruContent';
import { upsertGuruContent, getExistingVideoIds, getGuruChannels } from '@/lib/db/guruContent';
import { fetchAllPodcastEpisodes } from '@/lib/podcast/fetchPodcastEpisodes';
import { fetchAllXPosts } from '@/lib/x/fetchXPosts';
import { getJgtDb } from '@/lib/mongodb';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results = {
    youtube: { processed: 0, skipped: 0, errors: [] as string[] },
    podcast: { processed: 0, skipped: 0, errors: [] as string[] },
    x: { processed: 0, skipped: 0, rateLimited: [] as string[], errors: [] as string[] },
  };

  // ── 1. YouTube ─────────────────────────────────────────────────────────────
  const youtubeChannels = await getGuruChannels('youtube');

  for (const channel of youtubeChannels) {
    if (!channel.channelId) continue;

    try {
      const videos = await fetchChannelVideos(channel.channelId, 14);
      const existingIds = await getExistingVideoIds(channel.channelId);

      for (const video of videos) {
        if (existingIds.has(video.videoId)) {
          results.youtube.skipped++;
          continue;
        }

        let transcriptText: string | undefined;
        let transcriptSource: 'youtube-api' | 'whisper' | undefined;

        try {
          const result = await getTranscript(video.videoId);
          if (result) {
            transcriptText = result.text;
            transcriptSource = result.source;
          }
        } catch (err) {
          console.error(`Transcript failed for ${video.videoId}:`, err);
          results.youtube.errors.push(`Transcript: ${video.videoId}`);
        }

        let summary: string | undefined;
        let mentionedTickers: string[] | undefined;

        if (transcriptText) {
          try {
            const result = await summarizeGuruContent(video.title, transcriptText);
            summary = result.summary;
            mentionedTickers = result.mentionedTickers;
          } catch (err) {
            console.error(`Summary failed for ${video.videoId}:`, err);
            results.youtube.errors.push(`Summary: ${video.videoId}`);
          }
        }

        await upsertGuruContent({
          videoId: video.videoId,
          channelId: video.channelId,
          channelName: video.channelName,
          title: video.title,
          publishedAt: video.publishedAt,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          transcript: transcriptText,
          rawContent: transcriptText,
          transcriptSource,
          status: 'active',
          summary,
          mentionedTickers,
        });

        results.youtube.processed++;
        await sleep(1000);
      }
    } catch (err) {
      console.error(`YouTube channel ${channel.channelId} failed:`, err);
      results.youtube.errors.push(`Channel: ${channel.name}`);
    }
  }

  // ── 2. Podcast RSS ─────────────────────────────────────────────────────────
  try {
    const podcastResult = await fetchAllPodcastEpisodes();
    results.podcast = podcastResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[update-gurus] Podcast fetch failed:', msg);
    results.podcast.errors.push(msg);
  }

  // ── 3. X 帳號 ──────────────────────────────────────────────────────────────
  try {
    const xResult = await fetchAllXPosts();
    results.x = xResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[update-gurus] X fetch failed:', msg);
    results.x.errors.push(msg);
  }

  // ── 4. Archive content older than 30 days ─────────────────────────────────
  let archived = 0;
  try {
    const db = await getJgtDb();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const archiveResult = await db.collection('guru_content').updateMany(
      { publishedAt: { $lt: thirtyDaysAgo }, status: 'active' },
      { $set: { status: 'archived', updatedAt: new Date() } }
    );
    archived = archiveResult.modifiedCount;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[update-gurus] Archive step failed:', msg);
  }

  return NextResponse.json({
    ok: true,
    youtube: results.youtube,
    podcast: results.podcast,
    x: results.x,
    archived,
    timestamp: new Date().toISOString(),
  });
}
