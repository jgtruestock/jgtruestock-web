import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { getJgtDb } from '@/lib/mongodb';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = await getJgtDb();
  const feedbacks = await db.collection('jg_feedback')
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({
    feedbacks: feedbacks.map(f => ({
      ...f,
      _id: f._id.toString(),
    })),
  });
}
