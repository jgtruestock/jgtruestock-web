import { NextResponse } from 'next/server';
import { fetchChannelVideos } from '@/lib/youtube/fetchChannelVideos';
import { getTranscript } from '@/lib/youtube/getTranscript';
import { summarizeGuruContent } from '@/lib/ai/summarizeGuruContent';
import { upsertGuruContent, getExistingVideoIds, getGuruChannels } from '@/lib/db/guruContent';
import { getJgtDb } from '@/lib/mongodb';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { channelId: targetChannelId, refetch } = body as {
    channelId?: string;
    refetch?: boolean; // re-fetch existing records with short transcripts
  };

  let channels = await getGuruChannels('youtube');
  if (targetChannelId) {
    channels = channels.filter((c) => c.channelId === targetChannelId);
  }

  if (channels.length === 0) {
    return NextResponse.json({ error: 'No channels found' }, { status: 404 });
  }

  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const channel of channels) {
    if (!channel.channelId) continue;

    try {
      const videos = await fetchChannelVideos(channel.channelId, 14);
      const existingIds = await getExistingVideoIds(channel.channelId);

      // If refetch=true, also grab existing records with short / missing transcripts
      let existingShortDocs: Array<{ videoId: string }> = [];
      if (refetch) {
        const db = await getJgtDb();
        existingShortDocs = await db
          .collection('guru_content')
          .find(
            {
              channelId: channel.channelId,
              $or: [
                { transcript: { $exists: false } },
                { transcript: null },
                { $expr: { $lt: [{ $strLenCP: { $ifNull: ['$transcript', ''] } }, 5000] } },
                { rawContent: { $exists: false } },
                { rawContent: null },
                { $expr: { $lt: [{ $strLenCP: { $ifNull: ['$rawContent', ''] } }, 5000] } },
              ],
            },
            { projection: { videoId: 1 } }
          )
          .toArray() as Array<{ videoId: string }>;
      }

      // Merge: new videos + refetch candidates
      const videosToProcess = [...videos];
      for (const doc of existingShortDocs) {
        if (doc.videoId && !videos.find((v) => v.videoId === doc.videoId)) {
          // Add a minimal placeholder so we can re-fetch transcript only
          videosToProcess.push({
            videoId: doc.videoId,
            channelId: channel.channelId,
            channelName: channel.name,
            title: '',
            description: '',
            thumbnailUrl: '',
            publishedAt: new Date(),
          });
        }
      }

      for (const video of videosToProcess) {
        const isNew = !existingIds.has(video.videoId);

        // Skip new videos we've already processed
        if (!isNew && !refetch) {
          skipped++;
          continue;
        }

        // Get transcript
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
          errors.push(`Transcript failed: ${video.videoId}`);
        }

        // Only proceed with DB write / summary if we have transcript
        if (!transcriptText && !isNew) {
          skipped++;
          continue;
        }

        // AI summary (only if we have transcript)
        let summary: string | undefined;
        let mentionedTickers: string[] | undefined;

        if (transcriptText && transcriptText.length > 200) {
          try {
            const result = await summarizeGuruContent(video.title || '', transcriptText);
            summary = result.summary;
            mentionedTickers = result.mentionedTickers;
          } catch (err) {
            console.error(`Summary failed for ${video.videoId}:`, err);
            errors.push(`Summary failed: ${video.videoId}`);
          }
        }

        // Upsert to DB — store transcript as both `transcript` and `rawContent`
        const upsertData: Parameters<typeof upsertGuruContent>[0] = {
          videoId: video.videoId,
          channelId: video.channelId,
          channelName: video.channelName,
          title: video.title,
          publishedAt: video.publishedAt,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          transcript: transcriptText,
          transcriptSource,
          ...(transcriptText ? { rawContent: transcriptText } : {}),
          ...(summary !== undefined ? { summary } : {}),
          ...(mentionedTickers !== undefined ? { mentionedTickers } : {}),
        };

        await upsertGuruContent(upsertData);

        processed++;

        // Rate limit: 1 second between videos
        await sleep(1000);
      }
    } catch (err) {
      console.error(`Channel ${channel.channelId} failed:`, err);
      errors.push(`Channel failed: ${channel.name} (${channel.channelId})`);
    }
  }

  return NextResponse.json({ processed, skipped, errors });
}
