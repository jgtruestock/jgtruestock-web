/**
 * PR 4 — X 帳號追蹤
 * 使用 xurl CLI 抓取 guru_channels (type=x) 的最新推文，
 * AI 整理今日重點 → 存 guru_content
 *
 * 注意：xurl 需要先在本機手動完成 auth，否則跳過 X 追蹤。
 * Rate limit 遇到 429 → 跳過該帳號，記錄到 x_rate_limit collection。
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { getGuruChannels, upsertGuruContent } from '@/lib/db/guruContent';
import { getJgtDb } from '@/lib/mongodb';
import Anthropic from '@anthropic-ai/sdk';

const execAsync = promisify(exec);

interface XPost {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
}

/** Check if xurl is available and authenticated */
async function checkXurlReady(): Promise<boolean> {
  try {
    await execAsync('which xurl');
    const { stdout } = await execAsync('xurl auth status 2>&1');
    // If "No apps registered" → not ready
    if (stdout.includes('No apps registered')) return false;
    return true;
  } catch {
    return false;
  }
}

/** Fetch recent posts from an X handle via xurl */
async function fetchUserPosts(handle: string): Promise<XPost[]> {
  // xurl search "from:handle" -n 20 returns recent posts
  const cleanHandle = handle.replace(/^@/, '');
  const { stdout } = await execAsync(
    `xurl search "from:${cleanHandle}" -n 20 2>&1`,
    { timeout: 30_000 }
  );

  // Check for rate limit
  if (stdout.includes('429') || stdout.toLowerCase().includes('rate limit')) {
    const err = new Error(`RATE_LIMIT:${handle}`);
    throw err;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    console.error(`[x] Failed to parse xurl output for ${handle}:`, stdout.slice(0, 200));
    return [];
  }

  const posts: XPost[] = (parsed?.data || []).map((p: any) => ({
    id: p.id,
    text: p.text,
    created_at: p.created_at,
    author_id: p.author_id,
  }));

  // Filter to last 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return posts.filter((p) => {
    if (!p.created_at) return true;
    return new Date(p.created_at) >= cutoff;
  });
}

/** Generate a 200-char Chinese summary of posts */
async function summarizePosts(handle: string, posts: XPost[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return posts.map((p) => p.text).join('\n').slice(0, 200);

  const client = new Anthropic({ apiKey });
  const postsText = posts.map((p, i) => `${i + 1}. ${p.text}`).join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `以下是 @${handle} 在 X (Twitter) 上的最新推文，請用繁體中文整理今日重點，200字以內，只列最重要的觀點：\n\n${postsText}`,
      },
    ],
  });

  return response.content[0].type === 'text' ? response.content[0].text.slice(0, 500) : '';
}

/** Get existing X tweet IDs */
async function getExistingTweetIds(): Promise<Set<string>> {
  const db = await getJgtDb();
  const docs = await db
    .collection('guru_content')
    .find({ type: 'x' }, { projection: { videoId: 1 } })
    .toArray();
  return new Set(docs.map((d) => d.videoId as string));
}

/** Record rate limit to DB */
async function recordRateLimit(handle: string): Promise<void> {
  try {
    const db = await getJgtDb();
    await db.collection('x_rate_limit').updateOne(
      { handle },
      { $set: { handle, lastHit: new Date(), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[x] Failed to record rate limit:', err);
  }
}

/**
 * Main entry: fetch X channels, process new posts, store summaries.
 */
export async function fetchAllXPosts(): Promise<{
  processed: number;
  skipped: number;
  rateLimited: string[];
  errors: string[];
}> {
  const ready = await checkXurlReady();
  if (!ready) {
    console.log('[x] xurl not authenticated. Skipping X tracking.');
    return { processed: 0, skipped: 0, rateLimited: [], errors: ['xurl not authenticated'] };
  }

  const channels = await getGuruChannels('x');
  if (channels.length === 0) {
    return { processed: 0, skipped: 0, rateLimited: [], errors: [] };
  }

  const existingIds = await getExistingTweetIds();
  let processed = 0;
  let skipped = 0;
  const rateLimited: string[] = [];
  const errors: string[] = [];

  for (const channel of channels) {
    const handle = channel.handle || channel.name;
    if (!handle) continue;

    let posts: XPost[];
    try {
      posts = await fetchUserPosts(handle);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('RATE_LIMIT:')) {
        console.warn(`[x] Rate limited for ${handle}`);
        await recordRateLimit(handle);
        rateLimited.push(handle);
        continue;
      }
      console.error(`[x] Error fetching ${handle}:`, msg);
      errors.push(`${handle}: ${msg}`);
      continue;
    }

    if (posts.length === 0) {
      skipped++;
      continue;
    }

    // Check if we have any new posts
    const newPosts = posts.filter((p) => !existingIds.has(p.id));
    if (newPosts.length === 0) {
      skipped++;
      continue;
    }

    let summary = '';
    try {
      summary = await summarizePosts(handle, newPosts);
    } catch (err) {
      console.error(`[x] Summarize failed for ${handle}:`, err);
      summary = newPosts.map((p) => p.text).join(' ').slice(0, 200);
    }

    // Use the latest post's ID as the document identifier
    const latestPost = newPosts[0];
    const publishedAt = latestPost.created_at ? new Date(latestPost.created_at) : new Date();

    await upsertGuruContent({
      videoId: `x_${handle}_${latestPost.id}`,
      channelId: channel.channelId || handle,
      channelName: channel.name || handle,
      title: `@${handle} 今日重點 (${publishedAt.toISOString().slice(0, 10)})`,
      publishedAt,
      description: newPosts.map((p) => p.text).join('\n\n'),
      thumbnailUrl: undefined,
      transcript: undefined,
      transcriptSource: undefined,
      summary,
      mentionedTickers: [],
      // @ts-ignore — extend schema
      type: 'x',
      tweetIds: newPosts.map((p) => p.id),
    });

    newPosts.forEach((p) => existingIds.add(p.id));
    processed++;
  }

  return { processed, skipped, rateLimited, errors };
}
