/**
 * Batch regenerate commentary for all symbols
 * Usage: npx tsx scripts/regenerate-all.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
// Load .env.local
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
import type { StockNewsArticle } from '../lib/fmp';

const MONGO_URI = process.env.MONGODB_URI!;
const SLEEP_MS = 2000;
const NEWS_SOURCE_WHITELIST = [
  'reuters', 'wsj', 'marketwatch', 'businesswire', 'business wire',
  'globenewswire', 'globe newswire', 'prnewswire', 'pr newswire', 'cnbc', 'barrons',
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function regenerateSymbol(
  symbol: string,
  jgtDb: any,
  trackerDb: any
): Promise<{ symbol: string; status: 'ok' | 'skip' | 'error'; note: string }> {
  try {
    // 1. Stock info
    const stockInfo: any =
      await trackerDb.collection('jg_picks_cache').findOne({ symbol }) ??
      await trackerDb.collection('jg_picks_manual').findOne({ symbol });
    const mentionDate = stockInfo?.mentionDate ?? '未知';
    const mentionClose = stockInfo?.mentionClose ?? 0;
    const latestClose = stockInfo?.latestClose ?? 0;

    // 2. Transcript — valid cache first
    const cachedDoc: any = await jgtDb.collection('jg_transcripts').findOne(
      { symbol, year: { $ne: null }, quarter: { $ne: null }, content: { $exists: true, $ne: '' } },
      { sort: { year: -1, quarter: -1 } }
    );
    let cachedTranscript: any = (cachedDoc?.content?.length > 100) ? cachedDoc : null;

    const fmpTranscripts = await fetchEarningsTranscript(symbol);
    const fmpTranscript = fmpTranscripts.length > 0 ? fmpTranscripts[0] : null;

    let transcript: any = fmpTranscript ?? cachedTranscript;

    if (fmpTranscript) {
      await jgtDb.collection('jg_transcripts').updateOne(
        { symbol, year: fmpTranscript.year, quarter: fmpTranscript.quarter },
        { $set: { ...fmpTranscript, cachedAt: new Date() } },
        { upsert: true }
      );
    }

    // 3. News — read directly from jg_stock_news collection
    const newsDocRaw: any = await jgtDb.collection('jg_stock_news').findOne({ symbol });
    let rawNews: StockNewsArticle[];
    if (newsDocRaw?.articles?.length > 0) {
      rawNews = newsDocRaw.articles
        .slice().sort((a: any, b: any) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
        .slice(0, 30)
        .map((a: any) => ({ title: a.title, url: a.url, publishedDate: a.publishedDate, site: a.source, text: a.snippet, symbol }));
    } else {
      const fmpNews = await fetchStockNews(symbol, 50);
      rawNews = fmpNews.filter(a => NEWS_SOURCE_WHITELIST.some(s => (a.site ?? '').toLowerCase().includes(s))).slice(0, 30);
    }

    if (rawNews.length === 0 && !transcript) {
      return { symbol, status: 'skip', note: 'no news and no transcript' };
    }

    // 4. Existing commentary
    const existingCommentary: any = await jgtDb.collection('jg_commentary').findOne({ symbol });
    const existingEarningsDirection: string | undefined = existingCommentary?.earningsDirection?.body;
    const isNewEarnings = transcript && (
      !existingCommentary?.latestEarningsYear ||
      transcript.year > existingCommentary.latestEarningsYear ||
      (transcript.year === existingCommentary.latestEarningsYear && transcript.quarter > (existingCommentary.latestEarningsQuarter ?? 0))
    );

    let title: string, body: string, model: string, keyPoints: any[], earningsDirectionBody: string, shadowJGSummaryBody: string;
    let strategy: string;

    if (transcript && (isNewEarnings || !existingEarningsDirection)) {
      strategy = `FULL (${transcript.year}Q${transcript.quarter})`;
      const result = await generateCommentary(symbol, transcript, rawNews, mentionDate, mentionClose, latestClose);
      ({ title, body, model, keyPoints, earningsDirectionBody, shadowJGSummaryBody } = result);
    } else if (existingEarningsDirection) {
      strategy = 'PART_B_ONLY';
      earningsDirectionBody = existingEarningsDirection;
      keyPoints = existingCommentary?.keyPoints ?? [];
      title = existingCommentary?.draftTitle ?? existingCommentary?.publishedTitle ?? `${symbol} 點評`;
      const shadowResult = await generateShadowJGOnly(symbol, earningsDirectionBody, rawNews);
      shadowJGSummaryBody = shadowResult.shadowJGSummaryBody;
      model = shadowResult.model;
      body = earningsDirectionBody + '\n\n' + shadowJGSummaryBody;
    } else {
      // No transcript and no existing Part A — full generation
      strategy = 'FULL_NO_TRANSCRIPT';
      const result = await generateCommentary(symbol, null, rawNews, mentionDate, mentionClose, latestClose);
      ({ title, body, model, keyPoints, earningsDirectionBody, shadowJGSummaryBody } = result);
    }

    // 5. Save
    const now = new Date();
    await jgtDb.collection('jg_commentary').updateOne(
      { symbol },
      {
        $set: {
          draftTitle: title, draftBody: body, draftGeneratedAt: now, draftModel: model,
          keyPoints,
          earningsDirection: { body: earningsDirectionBody, generatedAt: now },
          shadowJGSummary: { body: shadowJGSummaryBody, generatedAt: now },
          ...(transcript ? { latestEarningsYear: transcript.year, latestEarningsQuarter: transcript.quarter } : {}),
          status: 'draft', updatedAt: now,
          sourcesSummary: { earningsTranscriptCount: transcript ? 1 : 0, newsCount: rawNews.length, filingsCount: 0, latestEarningsDate: transcript?.date ?? null },
        },
        $setOnInsert: { symbol, createdAt: now },
      },
      { upsert: true }
    );

    return { symbol, status: 'ok', note: strategy };
  } catch (err: any) {
    return { symbol, status: 'error', note: err?.message ?? String(err) };
  }
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const jgtDb = client.db('jgtruestock');
  const trackerDb = client.db('13f-tracker');

  // Get all symbols
  const [cache, manual] = await Promise.all([
    trackerDb.collection('jg_picks_cache').find({}).toArray(),
    trackerDb.collection('jg_picks_manual').find({}).toArray(),
  ]);
  const symbolSet = new Set<string>();
  for (const d of [...cache, ...manual]) if (d.symbol) symbolSet.add(String(d.symbol).toUpperCase());
  const symbols = Array.from(symbolSet).sort();

  console.log(`\n🚀 Batch regenerate: ${symbols.length} symbols`);
  console.log(`Symbols: ${symbols.join(', ')}\n`);

  const results: { symbol: string; status: string; note: string }[] = [];
  let done = 0;

  for (const symbol of symbols) {
    const result = await regenerateSymbol(symbol, jgtDb, trackerDb);
    results.push(result);
    done++;
    const icon = result.status === 'ok' ? '✅' : result.status === 'skip' ? '⏭' : '❌';
    console.log(`[${done}/${symbols.length}] ${icon} ${symbol.padEnd(8)} ${result.note}`);
    await sleep(SLEEP_MS);
  }

  await client.close();

  const ok = results.filter(r => r.status === 'ok').length;
  const skip = results.filter(r => r.status === 'skip').length;
  const errors = results.filter(r => r.status === 'error');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ 成功: ${ok}  ⏭ 略過: ${skip}  ❌ 錯誤: ${errors.length}`);
  if (errors.length > 0) {
    console.log(`\n錯誤清單：`);
    errors.forEach(e => console.log(`  ${e.symbol}: ${e.note}`));
  }
  console.log(`\n完成！`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
