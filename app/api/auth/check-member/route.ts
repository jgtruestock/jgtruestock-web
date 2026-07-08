import { NextRequest, NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) {
    return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
  }

  try {
    const db = await getJgtDb();
    const member = await db.collection('yt_members').findOne({ channelId });

    if (member) {
      return NextResponse.json({ isMember: true, tier: member.tier });
    } else {
      return NextResponse.json({ isMember: false, tier: null });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
