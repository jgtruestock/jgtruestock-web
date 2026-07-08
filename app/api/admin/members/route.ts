import { NextRequest, NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';

// GET /api/admin/members — list all members
export async function GET(_req: NextRequest) {
  try {
    const db = await getJgtDb();
    const members = await db
      .collection('yt_members')
      .find({})
      .sort({ importedAt: -1 })
      .toArray();
    return NextResponse.json({ members });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/admin/members?channelId=xxx — delete single member
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  if (!channelId) {
    return NextResponse.json({ error: 'channelId required' }, { status: 400 });
  }
  try {
    const db = await getJgtDb();
    const result = await db.collection('yt_members').deleteOne({ channelId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
