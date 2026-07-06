import { NextRequest, NextResponse } from 'next/server';
import { get13fDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sortParam = searchParams.get('sort') || 'gainPct';
    const order = searchParams.get('order') === 'asc' ? 1 : -1;

    // 資料來源：13f-tracker DB 的 jg_picks_cache + jg_picks_manual
    const db = await get13fDb();

    // 合併兩個 collection，取所有 active 股票
    const [cache, manual] = await Promise.all([
      db.collection('jg_picks_cache').find({}).toArray(),
      db.collection('jg_picks_manual').find({ active: true }).toArray(),
    ]);

    // 以 symbol 為 key 建立 map，manual 覆蓋 cache
    const symbolMap: Record<string, Record<string, unknown>> = {};
    for (const item of cache) {
      symbolMap[item.symbol] = item;
    }
    for (const item of manual) {
      symbolMap[item.symbol] = { ...symbolMap[item.symbol], ...item, isManualPick: true };
    }

    const allRecords = Object.values(symbolMap);

    // 標準化格式
    const records = allRecords.map((rec) => ({
      _id: rec._id?.toString() ?? rec.symbol,
      symbol: rec.symbol as string,
      companyName: (rec.name as string) || (rec.symbol as string),
      exchange: (rec.exchange as string) || 'US',
      mentionDate: rec.mentionDate as string,
      priceAtMention: (rec.mentionClose as number) || 0,
      currentPrice: (rec.latestClose as number) || 0,
      gainPct: (rec.performancePct as number) || 0,
      source: (rec.source as string) || 'member-channel',
      mentionCount: 1,
    }));

    // 排序
    const sortKey = sortParam === 'mentionDate' ? 'mentionDate' :
                    sortParam === 'symbol' ? 'symbol' : 'gainPct';
    records.sort((a, b) => {
      const av = a[sortKey as keyof typeof a];
      const bv = b[sortKey as keyof typeof b];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * order;
      return String(av).localeCompare(String(bv)) * order;
    });

    // Stats
    const total = records.length;
    const avgGainPct = total > 0
      ? records.reduce((sum, r) => sum + (r.gainPct || 0), 0) / total : 0;
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
