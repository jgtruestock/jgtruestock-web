import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { Db } from 'mongodb';
import { getJgtDb } from '@/lib/mongodb';
import { getBindingByEmail, getBindingByChannelId, createBinding } from '@/lib/db/userBindings';

async function logVerifyAttempt(db: Db, opts: {
  email: string;
  channelUrl: string;
  channelId?: string;
  success: boolean;
  errorType?: string; // 'not_in_members' | 'channel_not_found' | 'already_bound' | 'rate_limited' | 'conflict'
  ip?: string;
}) {
  await db.collection('jg_verify_logs').insertOne({
    ...opts,
    createdAt: new Date(),
  });
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;
const RATE_LIMIT_PER_HOUR = 5;

function parseChannelUrl(input: string): { type: 'handle' | 'channelId' | 'unknown'; value: string } {
  const trimmed = input.trim();

  // Direct channel ID
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return { type: 'channelId', value: trimmed };
  }

  // Helper: decode URL-encoded handle safely
  function decodeHandle(raw: string): string {
    try { return decodeURIComponent(raw); } catch { return raw; }
  }

  // Direct @handle (may contain URL-encoded Chinese)
  if (trimmed.startsWith('@')) {
    return { type: 'handle', value: decodeHandle(trimmed.slice(1)) };
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);

    // youtube.com/channel/UCxxxx
    const channelMatch = url.pathname.match(/^\/channel\/(UC[\w-]{22})/);
    if (channelMatch) return { type: 'channelId', value: channelMatch[1] };

    // youtube.com/@handle — allow any char including encoded Chinese
    const handleMatch = url.pathname.match(/^\/@([^/]+)/);
    if (handleMatch) return { type: 'handle', value: decodeHandle(handleMatch[1]) };

    // youtube.com/c/customname or youtube.com/user/username
    const customMatch = url.pathname.match(/^\/(?:c|user)\/([^/]+)/);
    if (customMatch) return { type: 'handle', value: decodeHandle(customMatch[1]) };

  } catch {
    // Not a URL, treat as handle
    return { type: 'handle', value: decodeHandle(trimmed) };
  }

  return { type: 'unknown', value: trimmed };
}

async function resolveChannelId(input: string): Promise<{ channelId: string; channelName: string } | null> {
  const parsed = parseChannelUrl(input);

  if (parsed.type === 'unknown') return null;

  let apiUrl: string;
  if (parsed.type === 'channelId') {
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&id=${encodeURIComponent(parsed.value)}&key=${YOUTUBE_API_KEY}`;
  } else {
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${encodeURIComponent(parsed.value)}&key=${YOUTUBE_API_KEY}`;
  }

  const res = await fetch(apiUrl);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.items?.length) return null;

  return {
    channelId: data.items[0].id,
    channelName: data.items[0].snippet?.title ?? '',
  };
}

async function checkRateLimit(email: string): Promise<boolean> {
  const db = await getJgtDb();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await db.collection('binding_logs').countDocuments({
    email: email.toLowerCase(),
    action: 'bind',
    createdAt: { $gte: oneHourAgo },
  });
  return count < RATE_LIMIT_PER_HOUR;
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.provider !== 'google') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = (token.email ?? '').toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const channelUrl: string = body.channelUrl ?? '';

  if (!channelUrl) {
    return NextResponse.json({ error: '請輸入 YouTube 頻道連結' }, { status: 400 });
  }

  // Get IP early for logging
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  // Rate limit check
  const allowed = await checkRateLimit(email);
  if (!allowed) {
    const dbRl = await getJgtDb();
    await logVerifyAttempt(dbRl, { email, channelUrl, success: false, errorType: 'rate_limited', ip });
    return NextResponse.json({ error: '嘗試次數過多，請 1 小時後再試' }, { status: 429 });
  }

  // Resolve channel ID via YouTube API
  let resolved: { channelId: string; channelName: string } | null;
  try {
    resolved = await resolveChannelId(channelUrl);
  } catch {
    return NextResponse.json({ error: '無法連接 YouTube，請稍後再試' }, { status: 500 });
  }

  if (!resolved) {
    const dbNf = await getJgtDb();
    await logVerifyAttempt(dbNf, { email, channelUrl, success: false, errorType: 'channel_not_found', ip });
    return NextResponse.json({ error: '找不到這個頻道，請確認連結是否正確' }, { status: 404 });
  }

  const { channelId } = resolved;

  // Check yt_members
  const db = await getJgtDb();
  const member = await db.collection('yt_members').findOne({ channelId });
  if (!member) {
    await logVerifyAttempt(db, { email, channelUrl, channelId, success: false, errorType: 'not_in_members', ip });
    return NextResponse.json(
      { error: '這個帳號不在會員名單中，請確認你用的是加入會員的 Google 帳號' },
      { status: 403 }
    );
  }

  // Check 1:1 binding — channelId must not be bound to another email
  const existingByChannel = await getBindingByChannelId(channelId);
  if (existingByChannel && existingByChannel.email !== email) {
    await logVerifyAttempt(db, { email, channelUrl, channelId, success: false, errorType: 'already_bound', ip });
    return NextResponse.json(
      { error: '這個頻道已被其他帳號綁定，請聯繫管理員' },
      { status: 409 }
    );
  }

  // Check if this email already has a binding (re-binding same channel is OK)
  const existingByEmail = await getBindingByEmail(email);
  if (existingByEmail && existingByEmail.channelId === channelId) {
    // Already correctly bound — treat as success
    await logVerifyAttempt(db, { email, channelUrl, channelId, success: true, ip });
    return NextResponse.json({ success: true });
  }
  if (existingByEmail && existingByEmail.channelId !== channelId) {
    await logVerifyAttempt(db, { email, channelUrl, channelId, success: false, errorType: 'conflict', ip });
    return NextResponse.json(
      { error: '你的帳號已綁定其他頻道，請聯繫管理員解除後再試' },
      { status: 409 }
    );
  }

  // Write binding
  try {
    await createBinding({ email, channelId, channelUrl, ip });
  } catch (err: any) {
    if (err?.code === 11000) {
      await logVerifyAttempt(db, { email, channelUrl, channelId, success: false, errorType: 'already_bound', ip });
      return NextResponse.json({ error: '這個頻道已被其他帳號綁定，請聯繫管理員' }, { status: 409 });
    }
    console.error('createBinding error:', err);
    return NextResponse.json({ error: '系統錯誤，請稍後再試' }, { status: 500 });
  }

  await logVerifyAttempt(db, { email, channelUrl, channelId, success: true, ip });
  return NextResponse.json({ success: true });
}
