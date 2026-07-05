/**
 * PR 3 — Podcast RSS 追蹤
 * 從 guru_channels (type=podcast) 取得 RSS URL，解析最新 episodes，
 * 去重後下載音檔 → Whisper 轉文字 → AI 摘要 → 存 guru_content
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import { getGuruChannels, upsertGuruContent } from '@/lib/db/guruContent';
import { getJgtDb } from '@/lib/mongodb';
import { summarizeGuruContent } from '@/lib/ai/summarizeGuruContent';

const execAsync = promisify(exec);

export interface PodcastEpisode {
  guid: string;
  title: string;
  url: string;  // audio URL
  pubDate: Date;
  description?: string;
  channelId: string;
  channelName: string;
}

/** Parse RSS XML and return episodes */
async function parseRssFeed(rssUrl: string, channelId: string, channelName: string): Promise<PodcastEpisode[]> {
  const res = await fetch(rssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JGTrueStock/1.0)' },
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${rssUrl}`);
  const xml = await res.text();

  const parser = new xml2js.Parser({ explicitArray: false });
  const parsed = await parser.parseStringPromise(xml);

  const items = parsed?.rss?.channel?.item;
  if (!items) return [];

  const list = Array.isArray(items) ? items : [items];

  return list.slice(0, 10).map((item: any) => {
    // Extract audio URL from enclosure or media:content
    const enclosureUrl =
      item.enclosure?.['$']?.url ||
      item['media:content']?.['$']?.url ||
      item.enclosure?.url ||
      '';

    const guid = item.guid?._ || item.guid || enclosureUrl || item.title;

    return {
      guid: String(guid),
      title: item.title || 'Untitled',
      url: enclosureUrl,
      pubDate: new Date(item.pubDate || Date.now()),
      description: item.description,
      channelId,
      channelName,
    };
  }).filter((ep: PodcastEpisode) => ep.url);
}

/** Download audio and run Whisper */
async function transcribeAudio(audioUrl: string, episodeGuid: string): Promise<string | null> {
  const tmpDir = '/tmp';
  const audioPath = path.join(tmpDir, `podcast_${Date.now()}.mp3`);
  const txtPath = audioPath.replace('.mp3', '.txt');

  try {
    console.log(`[podcast] Downloading audio: ${audioUrl}`);
    const res = await fetch(audioUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JGTrueStock/1.0)' },
    });
    if (!res.ok) throw new Error(`Audio download failed: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(audioPath, buffer);

    console.log(`[podcast] Running Whisper on ${audioPath} (${Math.round(buffer.length / 1024)}KB)`);
    await execAsync(
      `whisper "${audioPath}" --model base --language en --output_format txt --output_dir "${tmpDir}"`,
      { timeout: 300_000 } // 5 min max
    );

    const transcript = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf-8').trim() : null;
    return transcript;
  } catch (err) {
    console.error(`[podcast] Transcription failed for ${episodeGuid}:`, err);
    return null;
  } finally {
    // cleanup
    try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch {}
    try { if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath); } catch {}
  }
}

/** Get existing podcast content GUIDs */
async function getExistingGuids(): Promise<Set<string>> {
  const db = await getJgtDb();
  const docs = await db
    .collection('guru_content')
    .find({ type: 'podcast' }, { projection: { videoId: 1 } })
    .toArray();
  return new Set(docs.map((d) => d.videoId as string));
}

/**
 * Main entry point: fetch all podcast channels and process new episodes.
 * Returns { processed, skipped, errors }
 */
export async function fetchAllPodcastEpisodes(): Promise<{
  processed: number;
  skipped: number;
  errors: string[];
}> {
  const channels = await getGuruChannels('podcast');
  if (channels.length === 0) {
    console.log('[podcast] No podcast channels found in guru_channels');
    return { processed: 0, skipped: 0, errors: [] };
  }

  const existingGuids = await getExistingGuids();
  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const channel of channels) {
    const rssUrl = (channel as any).rssUrl;
    if (!rssUrl) {
      console.log(`[podcast] Channel ${channel.name} has no rssUrl, skipping`);
      continue;
    }

    let episodes: PodcastEpisode[];
    try {
      episodes = await parseRssFeed(rssUrl, channel.channelId || channel.name, channel.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[podcast] RSS parse failed for ${channel.name}:`, msg);
      errors.push(`${channel.name}: ${msg}`);
      continue;
    }

    for (const ep of episodes) {
      if (existingGuids.has(ep.guid)) {
        skipped++;
        continue;
      }

      let transcript: string | undefined;
      let summary: string | undefined;
      let mentionedTickers: string[] | undefined;

      try {
        const txt = await transcribeAudio(ep.url, ep.guid);
        if (txt) {
          transcript = txt;
          const result = await summarizeGuruContent(ep.title, txt);
          summary = result.summary;
          mentionedTickers = result.mentionedTickers;
        }
      } catch (err) {
        console.error(`[podcast] Processing failed for ${ep.guid}:`, err);
        errors.push(`${ep.channelName} "${ep.title}": ${err}`);
      }

      await upsertGuruContent({
        videoId: ep.guid,
        channelId: ep.channelId,
        channelName: ep.channelName,
        title: ep.title,
        publishedAt: ep.pubDate,
        description: ep.description,
        thumbnailUrl: undefined,
        transcript,
        transcriptSource: transcript ? 'whisper' : undefined,
        summary,
        mentionedTickers,
        // @ts-ignore — extend schema with type field
        type: 'podcast',
        sourceUrl: ep.url,
      });

      existingGuids.add(ep.guid);
      processed++;
    }
  }

  return { processed, skipped, errors };
}
