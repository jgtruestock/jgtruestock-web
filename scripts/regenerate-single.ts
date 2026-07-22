/**
 * Local script: regenerate commentary for a single symbol
 * Usage: SYMBOL=RKLB npx tsx scripts/regenerate-single.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
// Manually load .env.local
const envPath = join(process.cwd(), '.env.local');
try {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      process.env[key] ??= val;
    }
  }
} catch {}

import { MongoClient } from 'mongodb';
import { fetchEarningsTranscript, fetchStockNews } from '../lib/fmp';
import { generateCommentary, generateShadowJGOnly } from '../lib/ai/generateCommentary';

const SYMBOL = (process.env.SYMBOL ?? 'RKLB').toUpperCase();
const MONGO_URI = process.env.MONGODB_URI!;
const NEWS_SOURCE_WHITELIST = [
  'reuters', 'wsj', 'marketwatch', 'businesswire', 'business wire',
  'globenewswire', 'globe newswire', 'prnewswire', 'pr newswire', 'cnbc', 'barrons',
];

async function main() {
  console.log(`\n🚀 Regenerating ${SYMBOL}...`);

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const jgtDb = client.db('jgtruestock');
  const trackerDb = client.db('13f-tracker');

  try {
    // 1. Get stock info
    const stockInfo =
      await trackerDb.collection('jg_picks_cache').findOne({ symbol: SYMBOL }) ??
      await trackerDb.collection('jg_picks_manual').findOne({ symbol: SYMBOL });
    const mentionDate = (stockInfo as any)?.mentionDate ?? '未知';
    const mentionClose = (stockInfo as any)?.mentionClose ?? 0;
    const latestClose = (stockInfo as any)?.latestClose ?? 0;

    // 2. Get transcript — valid cache first, then FMP
    const cachedDoc = await jgtDb.collection('jg_transcripts').findOne(
      { symbol: SYMBOL, year: { $ne: null }, quarter: { $ne: null }, content: { $exists: true, $ne: '' } },
      { sort: { year: -1, quarter: -1 } }
    ) as any;
    let cachedTranscript = (cachedDoc?.content?.length > 100) ? cachedDoc : null;

    console.log(`  📄 Cached transcript: ${cachedTranscript ? `${cachedTranscript.year}Q${cachedTranscript.quarter} (${cachedTranscript.content.length} chars)` : 'none'}`);

    const fmpTranscripts = await fetchEarningsTranscript(SYMBOL);
    const fmpTranscript = fmpTranscripts.length > 0 ? fmpTranscripts[0] : null;
    console.log(`  📡 FMP transcript: ${fmpTranscript ? `${fmpTranscript.year}Q${fmpTranscript.quarter} (${fmpTranscript.content.length} chars)` : 'none'}`);

    let transcript = fmpTranscript ?? cachedTranscript;

    if (fmpTranscript) {
      // Cache it
      await jgtDb.collection('jg_transcripts').updateOne(
        { symbol: SYMBOL, year: fmpTranscript.year, quarter: fmpTranscript.quarter },
        { $set: { ...fmpTranscript, cachedAt: new Date() } },
        { upsert: true }
      );
      console.log(`  💾 Cached transcript ${fmpTranscript.year}Q${fmpTranscript.quarter}`);
    }

    // 3. Get news
    const { getStockNews } = await import('../lib/db/stockNews');
    const newsDoc = await getStockNews(SYMBOL);
    let rawNews: any[];
    if (newsDoc?.articles?.length > 0) {
      rawNews = newsDoc.articles
        .slice().sort((a: any, b: any) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
        .slice(0, 30)
        .map((a: any) => ({ title: a.title, url: a.url, publishedDate: a.publishedDate, site: a.source, text: a.snippet, symbol: SYMBOL }));
    } else {
      const fmpNews = await fetchStockNews(SYMBOL, 50);
      rawNews = fmpNews.filter((a) => NEWS_SOURCE_WHITELIST.some((s) => (a.site ?? '').toLowerCase().includes(s))).slice(0, 30);
    }
    console.log(`  📰 News: ${rawNews.length} articles`);

    // 4. Determine strategy
    const existingCommentary = await jgtDb.collection('jg_commentary').findOne({ symbol: SYMBOL }) as any;
    const existingEarningsDirection = existingCommentary?.earningsDirection?.body as string | undefined;
    const isNewEarnings = transcript && (
      !existingCommentary?.latestEarningsYear ||
      transcript.year > existingCommentary.latestEarningsYear ||
      (transcript.year === existingCommentary.latestEarningsYear && transcript.quarter > (existingCommentary.latestEarningsQuarter ?? 0))
    );

    console.log(`  🔍 Strategy: ${transcript && (isNewEarnings || !existingEarningsDirection) ? 'FULL REGEN' : existingEarningsDirection ? 'PART B ONLY' : 'FULL REGEN (no transcript)'}`);

    let title: string, body: string, model: string, keyPoints: any[], earningsDirectionBody: string, shadowJGSummaryBody: string;

    if (transcript && (isNewEarnings || !existingEarningsDirection)) {
      const result = await generateCommentary(SYMBOL, transcript, rawNews, mentionDate, mentionClose, latestClose);
      ({ title, body, model, keyPoints, earningsDirectionBody, shadowJGSummaryBody } = result);
    } else if (existingEarningsDirection) {
      earningsDirectionBody = existingEarningsDirection;
      keyPoints = existingCommentary?.keyPoints ?? [];
      title = existingCommentary?.draftTitle ?? existingCommentary?.publishedTitle ?? `${SYMBOL} 點評`;
      const shadowResult = await generateShadowJGOnly(SYMBOL, earningsDirectionBody, rawNews);
      shadowJGSummaryBody = shadowResult.shadowJGSummaryBody;
      model = shadowResult.model;
      body = earningsDirectionBody + '\n\n' + shadowJGSummaryBody;
    } else {
      const result = await generateCommentary(SYMBOL, null, rawNews, mentionDate, mentionClose, latestClose);
      ({ title, body, model, keyPoints, earningsDirectionBody, shadowJGSummaryBody } = result);
    }

    // 5. Save to DB
    const now = new Date();
    await jgtDb.collection('jg_commentary').updateOne(
      { symbol: SYMBOL },
      {
        $set: {
          draftTitle: title, draftBody: body, draftGeneratedAt: now, draftModel: model,
          keyPoints,
          earningsDirection: { body: earningsDirectionBody, generatedAt: now },
          shadowJGSummary: { body: shadowJGSummaryBody, generatedAt: now },
          ...(transcript ? { latestEarningsYear: transcript.year, latestEarningsQuarter: transcript.quarter } : {}),
          status: 'draft',
          updatedAt: now,
          sourcesSummary: { earningsTranscriptCount: transcript ? 1 : 0, newsCount: rawNews.length, filingsCount: 0, latestEarningsDate: transcript?.date ?? null },
        },
        $setOnInsert: { symbol: SYMBOL, createdAt: now },
      },
      { upsert: true }
    );

    console.log(`\n✅ Done! ${SYMBOL}`);
    console.log(`\n=== TITLE ===\n${title}`);
    console.log(`\n=== EARNINGS DIRECTION (Part A) ===\n${earningsDirectionBody.slice(0, 800)}...`);
    console.log(`\n=== SHADOW JG (Part B) ===\n${shadowJGSummaryBody.slice(0, 600)}...`);
    console.log(`\nTranscript: ${transcript ? `${transcript.year}Q${transcript.quarter}` : 'NONE'}`);

  } finally {
    await client.close();
  }
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
