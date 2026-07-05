/**
 * PR 2 — Daily Earnings Check Cron
 * Checks all active JG picks for new earnings call transcripts.
 * If a new quarter is found (not in jg_commentary), generates AI commentary.
 *
 * Schedule: 0 22 * * * (UTC 22:00 = 台北 06:00)
 */
import { NextResponse } from 'next/server';
import { get13fDb, getJgtDb } from '@/lib/mongodb';
import { fetchEarningsTranscript } from '@/lib/fmp';
import { generateCommentary } from '@/lib/ai/generateCommentary';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  // 1. Collect all active symbols from 13f-tracker DB
  const [picksCache, picksManual] = await Promise.all([
    tracker13fDb.collection('jg_picks_cache').find({}).toArray(),
    tracker13fDb.collection('jg_picks_manual').find({}).toArray(),
  ]);

  const symbolSet = new Set<string>();
  for (const doc of [...picksCache, ...picksManual]) {
    if (doc.symbol) symbolSet.add(String(doc.symbol).toUpperCase());
  }

  const symbols = Array.from(symbolSet);
  console.log(`[check-earnings] Found ${symbols.length} symbols:`, symbols);

  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const symbol of symbols) {
    try {
      // 2. Fetch latest earnings transcript
      const transcripts = await fetchEarningsTranscript(symbol);
      if (!transcripts || transcripts.length === 0) {
        console.log(`[check-earnings] ${symbol}: no transcript found, skipping`);
        skipped++;
        await sleep(1000);
        continue;
      }

      const latest = transcripts[0];
      // FMP returns `period` ("Q3") not `quarter` — normalise
      const rawDoc = latest as any;
      const year: number = rawDoc.year ?? latest.year;
      const period: string = rawDoc.period ?? (latest.quarter ? `Q${latest.quarter}` : 'Q?');

      // 3. Check if we already have commentary for this symbol+year+period
      const existing = await jgtDb.collection('jg_commentary').findOne({
        symbol,
        latestEarningsYear: year,
        latestEarningsPeriod: period,
      });

      if (existing) {
        console.log(`[check-earnings] ${symbol} ${year} ${period}: already exists, skipping`);
        skipped++;
        await sleep(1000);
        continue;
      }

      // 4. New earnings found — generate AI commentary
      console.log(`[check-earnings] ${symbol} ${year} ${period}: generating commentary...`);

      const result = await generateCommentary(
        symbol,
        latest,
        [], // no news for now; could add fetchStockNews
        latest.date,
        0,
        0
      );

      // 5. Upsert into jgtruestock.jg_commentary
      const now = new Date();
      await jgtDb.collection('jg_commentary').updateOne(
        { symbol },
        {
          $set: {
            symbol,
            draftTitle: result.title,
            draftBody: result.body,
            draftGeneratedAt: now,
            draftModel: result.model,
            latestEarningsYear: year,
            latestEarningsPeriod: period,
            status: 'draft',
            updatedAt: now,
            sourcesSummary: {
              earningsTranscriptCount: 1,
              newsCount: 0,
              filingsCount: 0,
              latestEarningsDate: latest.date,
            },
          },
          $setOnInsert: {
            publishedTitle: null,
            publishedBody: null,
            publishedAt: null,
            createdAt: now,
          },
        },
        { upsert: true }
      );

      console.log(`[check-earnings] ${symbol} ${year} ${period}: saved draft`);
      generated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[check-earnings] ${symbol} error:`, msg);
      errors.push(`${symbol}: ${msg}`);
    }

    // Rate limit: 1s between each symbol
    await sleep(1000);
  }

  return NextResponse.json({
    ok: true,
    symbols: symbols.length,
    generated,
    skipped,
    errors,
    timestamp: new Date().toISOString(),
  });
}
