import { NextRequest, NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';

/**
 * Extract YouTube Channel ID from a channel URL.
 * Supports:
 *   https://www.youtube.com/channel/UCxxxxxx  → returns UCxxxxxx directly
 *   https://www.youtube.com/@handle           → calls YouTube Data API
 *   https://youtube.com/c/customName          → attempts API lookup (may fail)
 */
async function extractChannelId(
  url: string
): Promise<{ channelId: string | null; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { channelId: null, error: 'invalid_url' };
  }

  const pathname = parsed.pathname;

  // /channel/UCxxxxxx
  const channelMatch = pathname.match(/^\/channel\/(UC[\w-]+)/);
  if (channelMatch) {
    return { channelId: channelMatch[1] };
  }

  // /@handle
  const handleMatch = pathname.match(/^\/@([\w.-]+)/);
  if (handleMatch) {
    const handle = handleMatch[1];
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return { channelId: null, error: 'handle_unsupported' };
    }
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=@${handle}&key=${apiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      const channelId = data?.items?.[0]?.id ?? null;
      if (!channelId) {
        return { channelId: null, error: 'handle_unsupported' };
      }
      return { channelId };
    } catch {
      return { channelId: null, error: 'handle_unsupported' };
    }
  }

  // /c/customName or /user/username — attempt via API search (best-effort)
  const customMatch = pathname.match(/^\/(c|user)\/([\w.-]+)/);
  if (customMatch) {
    // No reliable mapping without OAuth; ask user to use /channel/ URL
    return { channelId: null, error: 'handle_unsupported' };
  }

  return { channelId: null, error: 'invalid_url' };
}

export async function POST(req: NextRequest) {
  let body: { channelUrl?: string; googleEmail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const { channelUrl, googleEmail } = body;

  if (!channelUrl || !googleEmail) {
    return NextResponse.json(
      { ok: false, error: 'channelUrl and googleEmail are required' },
      { status: 400 }
    );
  }

  const { channelId, error: extractError } = await extractChannelId(channelUrl);

  if (!channelId) {
    return NextResponse.json({ ok: false, error: extractError ?? 'invalid_url' });
  }

  try {
    const db = await getJgtDb();
    const member = await db.collection('yt_members').findOne({ channelId });

    if (!member) {
      return NextResponse.json({ ok: false, error: 'not_member' });
    }

    // Update member record with googleEmail
    await db
      .collection('yt_members')
      .updateOne({ channelId }, { $set: { googleEmail } });

    return NextResponse.json({ ok: true, tier: member.tier });
  } catch (err: any) {
    console.error('register-channel error:', err);
    return NextResponse.json(
      { ok: false, error: err.message ?? 'server_error' },
      { status: 500 }
    );
  }
}
