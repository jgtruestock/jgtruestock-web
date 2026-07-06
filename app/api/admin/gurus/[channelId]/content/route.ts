import { NextRequest, NextResponse } from 'next/server';
import { getGuruContent } from '@/lib/db/guruContent';
import { getJgtDb } from '@/lib/mongodb';

interface RouteParams {
  params: Promise<{ channelId: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { channelId } = await params;

  let lookupId = channelId;

  // If channelId looks like a MongoDB ObjectId (24 hex chars), look up the YouTube channelId
  if (/^[a-f0-9]{24}$/.test(channelId)) {
    try {
      const { ObjectId } = await import('mongodb');
      const db = await getJgtDb();
      const ch = await db.collection('guru_channels').findOne({ _id: new ObjectId(channelId) });
      if (ch?.channelId) {
        lookupId = ch.channelId as string;
      }
    } catch {
      // fall through with original channelId
    }
  }

  const content = await getGuruContent(lookupId, 20);
  const items = content.map((item) => ({
    ...item,
    _id: item._id?.toString(),
    // text: deepSummary（深度中文摘要）> summary > rawContent/transcript
    text: item.deepSummary || item.summary || item.rawContent || item.transcript || '',
  }));

  return NextResponse.json({ items });
}
