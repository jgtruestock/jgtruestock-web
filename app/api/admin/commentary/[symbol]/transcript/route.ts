import { NextResponse } from 'next/server';
import { getJgtDb, get13fDb } from '@/lib/mongodb';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  try {
    // 1. 從 jgtruestock DB 取中文摘要
    const jgtDb = await getJgtDb();
    const commentary = await jgtDb.collection('jg_commentary').findOne({ symbol: sym });

    const summary = commentary?.publishedBody || commentary?.draftBody || null;
    const title = commentary?.publishedTitle || commentary?.draftTitle || `${sym} 法說會點評`;

    // 2. 從 13f-tracker DB 取英文逐字稿
    const trackerDb = await get13fDb();
    const transcriptDocs = await trackerDb
      .collection('video_transcripts')
      .find({ symbol: sym })
      .sort({ publish_date: -1 })
      .toArray();

    const transcripts = transcriptDocs.map((doc) => ({
      youtube_id: doc.youtube_id ?? '',
      channel: doc.channel ?? '',
      publish_date: doc.publish_date
        ? (doc.publish_date instanceof Date
            ? doc.publish_date.toISOString()
            : String(doc.publish_date))
        : null,
      fullTranscript: doc.fullTranscript ?? doc.transcript ?? doc.text ?? null,
    }));

    return NextResponse.json({
      symbol: sym,
      title,
      summary,
      transcripts,
    });
  } catch (err) {
    console.error(`GET /api/admin/commentary/${sym}/transcript error:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
