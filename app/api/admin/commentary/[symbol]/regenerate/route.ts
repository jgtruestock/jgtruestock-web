/**
 * PR 7 — 手動生成 AI 點評草稿（後台用）
 * POST /api/admin/commentary/[symbol]/regenerate
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { get13fDb } from '@/lib/mongodb';
import { fetchEarningsTranscript, fetchStockNews, StockNewsArticle } from '@/lib/fmp';
import { getStockNews } from '@/lib/db/stockNews';
import type { JGStockNewsArticle } from '@/types/commentary';
import { generateCommentary, generateShadowJGOnly } from '@/lib/ai/generateCommentary';

const NEWS_SOURCE_WHITELIST = [
  'reuters', 'wsj', 'marketwatch', 'businesswire', 'business wire',
  'globenewswire', 'globe newswire', 'prnewswire', 'pr newswire', 'cnbc', 'barrons',
];

function toStockNewsArticle(a: JGStockNewsArticle, symbol: string): StockNewsArticle {
  return { title: a.title, url: a.url, publishedDate: a.publishedDate, site: a.source, text: a.snippet, symbol };
}
import { upsertCommentary } from '@/lib/db/commentary';

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();

  try {
    // 1. Get mention info (mentionDate, mentionClose, latestClose)
    const db13f = await get13fDb();
    const stockInfo = await db13f.collection<{
      symbol: string;
      mentionDate: string;
      mentionClose: number;
      latestClose: number;
      companyName?: string;
    }>('jg_picks_cache').findOne({ symbol })
      ?? await db13f.collection<{
        symbol: string;
        mentionDate: string;
        mentionClose: number;
        latestClose: number;
        companyName?: string;
      }>('jg_picks_manual').findOne({ symbol });

    const mentionDate = stockInfo?.mentionDate ?? '未知';
    const mentionClose = stockInfo?.mentionClose ?? 0;
    const latestClose = stockInfo?.latestClose ?? 0;

    // 2. Fetch earnings transcript — check jg_transcripts cache (valid only), then FMP
    const db = await import('@/lib/mongodb').then(m => m.getJgtDb());
    const cachedDoc = await db.collection('jg_transcripts').findOne(
      { symbol, year: { $ne: null }, quarter: { $ne: null }, content: { $exists: true, $ne: '' } },
      { sort: { year: -1, quarter: -1 } }
    );
    let cachedTranscript = (cachedDoc && cachedDoc.content && cachedDoc.content.length > 100
      ? cachedDoc
      : null) as import('@/lib/fmp').EarningsTranscript | null;

    let transcript: import('@/lib/fmp').EarningsTranscript | null = null;
    const fmpTranscripts = await fetchEarningsTranscript(symbol);
    const fmpTranscript = fmpTranscripts.length > 0 ? fmpTranscripts[0] : null;

    if (fmpTranscript) {
      // Check if FMP has a newer quarter than cache
      const isNewer = !cachedTranscript ||
        fmpTranscript.year > cachedTranscript.year ||
        (fmpTranscript.year === cachedTranscript.year && fmpTranscript.quarter > cachedTranscript.quarter);
      if (isNewer) {
        // Cache it
        await db.collection('jg_transcripts').updateOne(
          { symbol, year: fmpTranscript.year, quarter: fmpTranscript.quarter },
          { $set: { ...fmpTranscript, cachedAt: new Date() } },
          { upsert: true }
        );
        transcript = fmpTranscript;
      } else {
        transcript = fmpTranscript; // same quarter, still use it
      }
    } else if (cachedTranscript) {
      transcript = cachedTranscript; // fallback to cache
    }

    // 3. Get news — prefer DB; fallback to FMP with whitelist
    const newsDoc = await getStockNews(symbol);
    let rawNews: StockNewsArticle[];
    if (newsDoc && newsDoc.articles && newsDoc.articles.length > 0) {
      rawNews = newsDoc.articles
        .slice()
        .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
        .slice(0, 30)
        .map((a) => toStockNewsArticle(a, symbol));
    } else {
      const fmpNews = await fetchStockNews(symbol, 50);
      rawNews = fmpNews.filter((a) =>
        NEWS_SOURCE_WHITELIST.some((s) => (a.site ?? '').toLowerCase().includes(s))
      ).slice(0, 30);
    }

    // 4. Get existing commentary to decide regeneration strategy
    const existingCommentary = await db.collection('jg_commentary').findOne({ symbol });
    const existingEarningsDirection = existingCommentary?.earningsDirection?.body as string | undefined;
    const existingLatestYear = existingCommentary?.latestEarningsYear as number | undefined;
    const existingLatestQuarter = existingCommentary?.latestEarningsQuarter as number | undefined;

    // Is this a NEW earnings quarter?
    const isNewEarnings = transcript && (
      !existingLatestYear ||
      transcript.year > existingLatestYear ||
      (transcript.year === existingLatestYear && transcript.quarter > (existingLatestQuarter ?? 0))
    );

    let title: string;
    let body: string;
    let model: string;
    let keyPoints: import('@/lib/ai/generateCommentary').KeyPoint[];
    let earningsDirectionBody: string;
    let shadowJGSummaryBody: string;

    if (transcript && (isNewEarnings || !existingEarningsDirection)) {
      // Full regeneration: new transcript or no existing Part A
      const result = await generateCommentary(symbol, transcript, rawNews, mentionDate, mentionClose, latestClose);
      ({ title, body, model, keyPoints, earningsDirectionBody, shadowJGSummaryBody } = result);
    } else if (existingEarningsDirection) {
      // Part A unchanged (same earnings quarter or no new transcript)
      // Only regenerate Part B (影子JG總結) with latest news
      earningsDirectionBody = existingEarningsDirection;
      keyPoints = (existingCommentary?.keyPoints ?? []) as import('@/lib/ai/generateCommentary').KeyPoint[];
      title = (existingCommentary?.draftTitle ?? existingCommentary?.publishedTitle ?? `${symbol} 點評`) as string;
      const shadowResult = await generateShadowJGOnly(symbol, earningsDirectionBody, rawNews);
      shadowJGSummaryBody = shadowResult.shadowJGSummaryBody;
      model = shadowResult.model;
      body = earningsDirectionBody + '\n\n' + shadowJGSummaryBody;
    } else {
      // No transcript, no existing Part A → full generation with "no transcript" note
      const result = await generateCommentary(symbol, null, rawNews, mentionDate, mentionClose, latestClose);
      ({ title, body, model, keyPoints, earningsDirectionBody, shadowJGSummaryBody } = result);
    }

    // 5. Upsert into DB as draft
    const now = new Date();
    await upsertCommentary(symbol, {
      draftTitle: title,
      draftBody: body,
      draftGeneratedAt: now,
      draftModel: model,
      keyPoints,
      earningsDirection: {
        body: earningsDirectionBody,
        generatedAt: now,
      },
      shadowJGSummary: {
        body: shadowJGSummaryBody,
        generatedAt: now,
      },
      ...(transcript ? {
        latestEarningsYear: transcript.year,
        latestEarningsQuarter: transcript.quarter,
      } : {}),
      status: 'draft',
      sourcesSummary: {
        earningsTranscriptCount: transcript ? 1 : 0,
        newsCount: rawNews.length,
        filingsCount: 0,
        latestEarningsDate: transcript?.date ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      commentary: {
        symbol,
        draftTitle: title,
        draftBody: body,
        draftGeneratedAt: now.toISOString(),
        draftModel: model,
        keyPoints,
        earningsDirection: { body: earningsDirectionBody, generatedAt: now.toISOString() },
        shadowJGSummary: { body: shadowJGSummaryBody, generatedAt: now.toISOString() },
        status: 'draft',
      },
    });
  } catch (err: any) {
    console.error(`[regenerate] ${symbol} error:`, err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
