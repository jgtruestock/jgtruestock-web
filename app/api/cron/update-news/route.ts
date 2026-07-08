import { NextRequest, NextResponse } from 'next/server';
import { get13fDb } from '@/lib/mongodb';
import { fetchStockNews, fetchSecFilings, fetchPressReleases } from '@/lib/fmp';
import { upsertStockNews } from '@/lib/db/stockNews';
import { upsertStockFilings } from '@/lib/db/stockFilings';
import { upsertStockPressReleases } from '@/lib/db/stockPressReleases';
import type { JGStockNewsArticle, SecFiling, PressRelease } from '@/types/commentary';

// Whitelist for news sources (case-insensitive contains match)
const NEWS_SOURCE_WHITELIST = [
  'reuters',
  'wsj',
  'marketwatch',
  'businesswire',
  'business wire',
  'globenewswire',
  'globe newswire',
  'prnewswire',
  'pr newswire',
  'cnbc',
  'barrons',
];

function isWhitelistedSource(site: string): boolean {
  const lower = site.toLowerCase();
  return NEWS_SOURCE_WHITELIST.some((s) => lower.includes(s));
}

// Vercel Cron calls GET; also support POST for manual trigger
async function handler(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ── 1. Get active symbol list from 13f-tracker DB ─────────────────
    const db13f = await get13fDb();

    const [cacheSymbols, manualSymbols] = await Promise.all([
      db13f
        .collection('jg_picks_cache')
        .find({})
        .project<{ symbol: string }>({ symbol: 1, _id: 0 })
        .toArray(),
      db13f
        .collection('jg_picks_manual')
        .find({ active: { $ne: false } }) // active=true or field missing
        .project<{ symbol: string }>({ symbol: 1, _id: 0 })
        .toArray(),
    ]);

    const allSymbols = [
      ...new Set([
        ...cacheSymbols.map((d) => d.symbol),
        ...manualSymbols.map((d) => d.symbol),
      ]),
    ].filter(Boolean);

    if (allSymbols.length === 0) {
      return NextResponse.json({ success: true, message: 'No symbols found', updated: 0 });
    }

    // ── 2. Batch-fetch news (3 at a time, 500 ms delay) ───────────────
    const BATCH_SIZE = 3;
    const DELAY_MS = 500;

    let updated = 0;
    let failed = 0;
    const errors: { symbol: string; error: string }[] = [];

    for (let i = 0; i < allSymbols.length; i += BATCH_SIZE) {
      const batch = allSymbols.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (symbol) => {
          try {
            const raw = await fetchStockNews(symbol, 50);

            // Filter to whitelisted sources only
            const filtered = raw.filter((a) => isWhitelistedSource(a.site || ''));

            // Normalise to JGStockNewsArticle shape
            const articles: JGStockNewsArticle[] = filtered.map((a) => ({
              title: a.title || '',
              url: a.url || '',
              source: a.site || '',
              publishedDate: a.publishedDate || '',
              snippet: (a.text || '').slice(0, 200),
              sentiment: null,
            }));

            await upsertStockNews(symbol, articles);

            // Fetch 8-K filings
            const rawFilings = await fetchSecFilings(symbol, '8-K', 20);
            const filings: SecFiling[] = rawFilings.map((f) => ({
              symbol: f.symbol,
              fillingDate: f.fillingDate,
              acceptedDate: f.acceptedDate,
              type: f.type,
              link: f.link,
              finalLink: f.finalLink,
            }));
            await upsertStockFilings(symbol, filings);

            // Fetch Press Releases
            const rawReleases = await fetchPressReleases(symbol, 20);
            const releases: PressRelease[] = rawReleases.map((r) => ({
              symbol: r.symbol,
              date: r.date,
              title: r.title,
              text: r.text,
            }));
            await upsertStockPressReleases(symbol, releases);

            updated++;
          } catch (err) {
            failed++;
            errors.push({ symbol, error: String(err) });
            console.error(`[update-news] ${symbol} failed:`, err);
          }
        })
      );

      // Delay between batches (skip delay after last batch)
      if (i + BATCH_SIZE < allSymbols.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    return NextResponse.json({
      success: true,
      totalSymbols: allSymbols.length,
      updated,
      failed,
      errors: errors.slice(0, 10), // cap to first 10 errors in response
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[update-news] cron error:', err);
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
