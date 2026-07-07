import { NextRequest, NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';
import { getCurrentPrice } from '@/lib/fmp';

export async function GET(req: NextRequest) {
  // Vercel cron auth check
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow if no CRON_SECRET set (dev mode)
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const db = await getJgtDb();
    const collection = db.collection('jg_mention_history');
    const records = await collection.find({}).toArray();

    let updated = 0;
    let failed = 0;

    // Get unique symbols
    const symbols = [...new Set(records.map((r) => r.symbol as string))];

    const priceMap: Record<string, number | null> = {};
    for (const symbol of symbols) {
      const price = await getCurrentPrice(symbol);
      priceMap[symbol] = price;
      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 100));
    }

    // Update each record
    for (const record of records) {
      const currentPrice = priceMap[record.symbol];
      if (currentPrice === null || currentPrice === undefined) {
        failed++;
        continue;
      }

      const gainPct =
        record.priceAtMention > 0
          ? ((currentPrice - record.priceAtMention) / record.priceAtMention) * 100
          : 0;

      await collection.updateOne(
        { _id: record._id },
        {
          $set: {
            currentPrice,
            gainPct: parseFloat(gainPct.toFixed(2)),
            updatedAt: new Date(),
          },
        }
      );
      updated++;
    }

    return NextResponse.json({
      success: true,
      updated,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Cron update error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
