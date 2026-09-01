import { NextRequest, NextResponse } from 'next/server';
import { getJgtDb, get13fDb } from '@/lib/mongodb';
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

    // Get unique symbols from jg_mention_history
    const symbols = [...new Set(records.map((r) => r.symbol as string))];

    // Also get symbols from jg_picks_cache (13f-tracker DB)
    const db13f = await get13fDb();
    const cacheRecords = await db13f.collection('jg_picks_cache').find({}).toArray();
    const cacheSymbols = [...new Set(cacheRecords.map((r) => r.symbol as string))];

    // Merge all unique symbols
    const allSymbols = [...new Set([...symbols, ...cacheSymbols])];

    const priceMap: Record<string, number | null> = {};
    for (const symbol of allSymbols) {
      const price = await getCurrentPrice(symbol);
      priceMap[symbol] = price;
      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 150));
    }

    // Update jg_mention_history records
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

    // Update jg_picks_cache latestClose (daily, split-adjusted via FMP)
    const today = new Date().toISOString().slice(0, 10);
    let cacheUpdated = 0;
    let cacheFailed = 0;
    for (const symbol of cacheSymbols) {
      const price = priceMap[symbol];
      if (price === null || price === undefined) { cacheFailed++; continue; }
      await db13f.collection('jg_picks_cache').updateMany(
        { symbol },
        { $set: { latestClose: price, latestCloseDate: today } }
      );
      cacheUpdated++;
    }

    return NextResponse.json({
      success: true,
      updated,
      failed,
      cacheUpdated,
      cacheFailed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Cron update error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
