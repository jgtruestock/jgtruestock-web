import { NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// PATCH /api/admin/gurus/[channelId] — toggle active or update fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const body = await request.json();

  const db = await getJgtDb();

  let filter: Record<string, unknown>;
  try {
    filter = { _id: new ObjectId(channelId) };
  } catch {
    filter = { $or: [{ channelId }, { handle: channelId }, { _id: channelId }] };
  }

  const result = await db.collection('guru_channels').updateOne(filter, {
    $set: { ...body, updatedAt: new Date() },
  });

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/gurus/[channelId] — delete channel
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;

  const db = await getJgtDb();

  let filter: Record<string, unknown>;
  try {
    filter = { _id: new ObjectId(channelId) };
  } catch {
    filter = { $or: [{ channelId }, { handle: channelId }, { _id: channelId }] };
  }

  const result = await db.collection('guru_channels').deleteOne(filter);

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
