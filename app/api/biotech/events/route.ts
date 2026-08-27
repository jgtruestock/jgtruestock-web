import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getJgtDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  // Auth: member or admin required (proxy handles redirect, this is API double-check)
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const symbol = searchParams.get('symbol')?.toUpperCase() || null;

    const skip = (page - 1) * limit;

    const db = await getJgtDb();
    const collection = db.collection('biotech_events');

    const filter: Record<string, unknown> = { relevant: true };
    if (symbol) {
      filter.symbol = symbol;
    }

    const [events, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ filingDate: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return NextResponse.json({
      events,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[biotech/events] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
