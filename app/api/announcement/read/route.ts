import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getJgtDb } from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const { announcementId } = await req.json();
  if (!announcementId) return NextResponse.json({ ok: false }, { status: 400 });

  const db = await getJgtDb();
  await db.collection('jg_announcement_reads').updateOne(
    { email: token.email, announcementId },
    { $setOnInsert: { email: token.email, announcementId, readAt: new Date() } },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
