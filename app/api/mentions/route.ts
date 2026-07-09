import { NextRequest, NextResponse } from 'next/server';
import { get13fDb, getJgtDb } from '@/lib/mongodb';

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

    // 以 symbol 為 key 建立 map
    // manual 覆蓋 cache 的 metadata，但 price 欄位以 cache（每日更新）為準
    const symbolMap: Record<string, Record<string, unknown>> = {};
    for (const item of cache) {
      symbolMap[item.symbol] = item;
    }
    for (const item of manual) {
      const cached = symbolMap[item.symbol] || {};
      symbolMap[item.symbol] = {
        ...cached,
        ...item,
        // 所有 price 欄位以 cache（每日 cron 更新，split-adjusted）為準
        // manual 只存加入當下的快照，可能有 stock split 造成的舊資料問題
        mentionClose: (cached.mentionClose as number) ?? (item.mentionClose as number),
        mentionCloseDate: (cached.mentionCloseDate as string) ?? (item.mentionCloseDate as string),
        latestClose: (cached.latestClose as number) ?? (item.latestClose as number),
        latestCloseDate: (cached.latestCloseDate as string) ?? (item.latestCloseDate as string),
        performancePct: (cached.performancePct as number) ?? (item.performancePct as number),
        isManualPick: true,
      };
    }

    // 合併 jgtruestock DB 的 jg_mention_history
    const jgtDb = await getJgtDb();
    // 先按 mentionDate 升序排列，確保最早的先處理
    const mentionHistory = await jgtDb
      .collection('jg_mention_history')
      .find({})
      .sort({ mentionDate: 1, createdAt: 1 })
      .toArray();

    // 用 Map 整合同 symbol 的多筆（保留最早的日期/價格，加總次數）
    const mentionMap: Record<string, any> = {};
    for (const item of mentionHistory) {
      const sym = item.symbol as string;
      if (!sym) continue;
      if (!mentionMap[sym]) {
        mentionMap[sym] = { ...item, mentionCount: item.mentionCount || 1 };
      } else {
        // 已存在：保留最早的，只加次數
        mentionMap[sym].mentionCount = (mentionMap[sym].mentionCount || 1) + (item.mentionCount || 1);
      }
    }

    for (const item of Object.values(mentionMap)) {
      const sym = item.symbol as string;
      symbolMap[sym] = {
        ...symbolMap[sym],
        _id: item._id,
        symbol: sym,
        name: item.companyName || sym,
        exchange: item.exchange || (symbolMap[sym]?.exchange as string) || 'US',
        mentionDate: item.mentionDate || (symbolMap[sym]?.mentionDate as string),
        mentionClose: item.priceAtMention ?? (symbolMap[sym]?.mentionClose as number),
        latestClose: item.currentPrice ?? (symbolMap[sym]?.latestClose as number),
        performancePct: item.gainPct ?? (symbolMap[sym]?.performancePct as number),
        source: item.source || (symbolMap[sym]?.source as string) || 'jg-mention',
        mentionCount: item.mentionCount || 1,
        _fromMentionHistory: true,
      };
    }

    const allRecords = Object.values(symbolMap);

    // 批量查詢 commentary 和 stock_news 的最新更新時間
    const allSymbolsList = allRecords.map(r => r.symbol as string).filter(Boolean);

    const [commentaryDocs, newsDocs] = await Promise.all([
      jgtDb.collection('jg_commentary')
        .find({ symbol: { $in: allSymbolsList } })
        .project<{ symbol: string; updatedAt: Date }>({ symbol: 1, updatedAt: 1, _id: 0 })
        .toArray(),
      jgtDb.collection('jg_stock_news')
        .find({ symbol: { $in: allSymbolsList } })
        .project<{ symbol: string; updatedAt: Date }>({ symbol: 1, updatedAt: 1, _id: 0 })
        .toArray(),
    ]);

    const commentaryDateMap: Record<string, Date> = {};
    for (const doc of commentaryDocs) {
      if (doc.symbol && doc.updatedAt) commentaryDateMap[doc.symbol] = doc.updatedAt;
    }

    const newsDateMap: Record<string, Date> = {};
    for (const doc of newsDocs) {
      if (doc.symbol && doc.updatedAt) newsDateMap[doc.symbol] = doc.updatedAt;
    }

    // 標準化格式
    const records = allRecords.map((rec) => ({
      _id: rec._id?.toString() ?? rec.symbol,
      symbol: rec.symbol as string,
      companyName: (rec.companyName as string) || (rec.name as string) || (rec.symbol as string),
      exchange: (rec.exchange as string) || 'US',
      mentionDate: (() => {
        const d = rec.mentionDate;
        if (!d) return '';
        if (d instanceof Date) return (d as Date).toISOString().slice(0, 10);
        const s = String(d);
        // ISO string "2026-07-02T..." → slice to 10
        if (s.length >= 10 && s[4] === '-') return s.slice(0, 10);
        return s;
      })(),
      priceAtMention: (rec.mentionClose as number) || 0,
      currentPrice: (rec.latestClose as number) || 0,
      gainPct: (rec.performancePct as number) || 0,
      source: (rec.source as string) || 'member-channel',
      mentionCount: (rec.mentionCount as number) || 1,
      _fromMentionHistory: (rec._fromMentionHistory as boolean) || false,
      lastUpdatedAt: (() => {
        const commentaryDate = commentaryDateMap[rec.symbol as string];
        const newsDate = newsDateMap[rec.symbol as string];
        const latest = commentaryDate && newsDate
          ? (commentaryDate > newsDate ? commentaryDate : newsDate)
          : commentaryDate || newsDate || null;
        return latest ? latest.toISOString().slice(0, 10) : null;
      })(),
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

    return NextResponse.json(
      {
        records,
        stats: {
          total,
          avgGainPct: parseFloat(avgGainPct.toFixed(1)),
          positiveCount,
          positiveRate: parseFloat(positiveRate.toFixed(1)),
          lastUpdatedAt: records.length > 0
            ? records.reduce((latest, r) => r.mentionDate > latest ? r.mentionDate : latest, '')
            : null,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err) {
    console.error('GET /api/mentions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
