import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sort = searchParams.get('sort') || 'gainPct';
    const order = searchParams.get('order') === 'asc' ? 1 : -1;

    const db = await getDb();
    const collection = db.collection('jg_mention_history');

    // Get all records with mention counts per symbol
    const allRecords = await collection
      .find({})
      .sort({ [sort]: order })
      .toArray();

    // Count mentions per symbol
    const mentionCounts: Record<string, number> = {};
    for (const rec of allRecords) {
      mentionCounts[rec.symbol] = (mentionCounts[rec.symbol] || 0) + 1;
    }

    const records = allRecords.map((rec) => ({
      _id: rec._id.toString(),
      symbol: rec.symbol,
      companyName: rec.companyName,
      exchange: rec.exchange,
      mentionDate: rec.mentionDate,
      priceAtMention: rec.priceAtMention,
      currentPrice: rec.currentPrice,
      gainPct: rec.gainPct,
      source: rec.source,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
      mentionCount: mentionCounts[rec.symbol] || 1,
    }));

    // Stats
    const total = records.length;
    const avgGainPct =
      total > 0
        ? records.reduce((sum, r) => sum + (r.gainPct || 0), 0) / total
        : 0;
    const positiveCount = records.filter((r) => r.gainPct > 0).length;
    const positiveRate = total > 0 ? (positiveCount / total) * 100 : 0;

    return NextResponse.json({
      records,
      stats: {
        total,
        avgGainPct: parseFloat(avgGainPct.toFixed(1)),
        positiveCount,
        positiveRate: parseFloat(positiveRate.toFixed(1)),
      },
    });
  } catch (err) {
    console.error('GET /api/mentions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
