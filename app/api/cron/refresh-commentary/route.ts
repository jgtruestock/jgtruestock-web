/**
 * PR 3 — Daily Commentary Refresh Cron
 * After update-news runs (UTC 23:00), this cron runs at UTC 23:30.
 * Finds stocks with news newer than their last commentary update.
 * Regenerates and auto-publishes commentary for those stocks.
 *
 * Schedule: 30 23 * * * (UTC 23:30 = 台北 07:30)
 */
import { NextResponse } from 'next/server';
import { get13fDb, getJgtDb } from '@/lib/mongodb';
import { fetchEarningsTranscript } from '@/lib/fmp';
import { generateCommentary } from '@/lib/ai/generateCommentary';
import { getStockNews } from '@/lib/db/stockNews';
import type { JGStockNewsArticle } from '@/types/commentary';
import type { StockNewsArticle } from '@/lib/fmp';

const SLEEP_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Map JGStockNewsArticle → StockNewsArticle for generateCommentary */
function toStockNewsArticle(a: JGStockNewsArticle, symbol: string): StockNewsArticle {
  return {
    title: a.title,
    url: a.url,
    publishedDate: a.publishedDate,
    site: a.source,
    text: a.snippet,
    symbol,
  };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const tracker13fDb = await get13fDb();
  const jgtDb = await getJgtDb();

  // 1. Collect all active symbols
  const [picksCache, picksManual] = await Promise.all([
    tracker13fDb.collection('jg_picks_cache').find({}).toArray(),
    tracker13fDb.collection('jg_picks_manual').find({}).toArray(),
  ]);

  const symbolSet = new Set<string>();
  for (const doc of [...picksCache, ...picksManual]) {
    if (doc.symbol) symbolSet.add(String(doc.symbol).toUpperCase());
  }

  const allSymbols = Array.from(symbolSet);
  console.log(`[refresh-commentary] Found ${allSymbols.length} symbols:`, allSymbols);

  // Process all symbols (63 × 1s sleep ≈ 63s, well within 300s limit)
  const symbols = allSymbols;

  let refreshed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const symbol of symbols) {
    try {
      // 2. Get news for this symbol
      const newsDoc = await getStockNews(symbol);
      if (!newsDoc || !newsDoc.articles || newsDoc.articles.length === 0) {
        console.log(`[refresh-commentary] ${symbol}: no news, skipping`);
        skipped++;
        await sleep(SLEEP_MS);
        continue;
      }

      // 3. Get existing commentary
      const existing = await jgtDb.collection('jg_commentary').findOne({ symbol });
      if (!existing) {
        console.log(`[refresh-commentary] ${symbol}: no existing commentary, skipping`);
        skipped++;
        await sleep(SLEEP_MS);
        continue;
      }

      // 4. Check if any news article is newer than last commentary update
      const lastUpdated: Date = existing.updatedAt ?? new Date(0);
      const hasNewNews = newsDoc.articles.some(
        (a) => new Date(a.publishedDate) > lastUpdated
      );

      if (!hasNewNews) {
        console.log(`[refresh-commentary] ${symbol}: no new news since ${lastUpdated.toISOString()}, skipping`);
        skipped++;
        await sleep(SLEEP_MS);
        continue;
      }

      console.log(`[refresh-commentary] ${symbol}: new news detected, regenerating commentary...`);

      // 5. Get earnings transcript — prefer cached jg_transcripts, fall back to FMP
      let latest = await jgtDb
        .collection('jg_transcripts')
        .findOne({ symbol }, { sort: { year: -1, quarter: -1 } }) as import('@/lib/fmp').EarningsTranscript | null;

      if (!latest) {
        console.log(`[refresh-commentary] ${symbol}: no cached transcript, fetching from FMP...`);
        const transcripts = await fetchEarningsTranscript(symbol);
        if (!transcripts || transcripts.length === 0) {
          console.log(`[refresh-commentary] ${symbol}: no transcript from FMP either, skipping`);
          skipped++;
          await sleep(SLEEP_MS);
          continue;
        }
        latest = transcripts[0];
        // Cache for future runs
        await jgtDb.collection('jg_transcripts').updateOne(
          { symbol, year: latest.year, quarter: latest.quarter },
          { $set: { ...latest, cachedAt: new Date() } },
          { upsert: true }
        );
        console.log(`[refresh-commentary] ${symbol}: cached transcript ${latest.year}-Q${latest.quarter}`);
      } else {
        console.log(`[refresh-commentary] ${symbol}: using cached transcript ${latest.year}-Q${latest.quarter}`);
      }

      // 6. Prepare news articles (latest 20)
      const newsArticles: StockNewsArticle[] = newsDoc.articles
        .slice()
        .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
        .slice(0, 20)
        .map((a) => toStockNewsArticle(a, symbol));

      // 7. Retrieve mention date / prices from existing commentary (best-effort)
      const mentionDate: string = existing.sourcesSummary?.latestEarningsDate ?? latest.date ?? '';
      const mentionClose: number = existing.mentionClose ?? 0;
      const latestClose: number = existing.latestClose ?? 0;

      // 8. Generate commentary
      const result = await generateCommentary(
        symbol,
        latest,
        newsArticles,
        mentionDate,
        mentionClose,
        latestClose
      );

      // 9. Auto-publish (no draft)
      const now = new Date();
      await jgtDb.collection('jg_commentary').updateOne(
        { symbol },
        {
          $set: {
            publishedTitle: result.title,
            publishedBody: result.body,
            publishedAt: now,
            status: 'published',
            updatedAt: now,
            lastNewsRefreshAt: now,
            // 兩段式新格式
            earningsDirection: {
              body: result.earningsDirectionBody,
              generatedAt: now,
            },
            shadowJGSummary: {
              body: result.shadowJGSummaryBody,
              generatedAt: now,
            },
            // KeyPoints
            keyPoints: result.keyPoints,
          },
        },
        { upsert: false } // 只更新現有的，不新增
      );

      console.log(`[refresh-commentary] ${symbol}: published`);
      refreshed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[refresh-commentary] ${symbol} error:`, msg);
      errors.push(`${symbol}: ${msg}`);
    }

    await sleep(SLEEP_MS);
  }

  return NextResponse.json({
    ok: true,
    totalSymbols: allSymbols.length,
    processed: symbols.length,
    refreshed,
    skipped,
    errors,
    sleepMs: SLEEP_MS,
    timestamp: new Date().toISOString(),
  });
}
