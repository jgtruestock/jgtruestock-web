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
import { generateCommentary } from '@/lib/ai/generateCommentary';

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

    // 2. Fetch earnings transcript
    const transcripts = await fetchEarningsTranscript(symbol);
    const transcript = transcripts.length > 0 ? transcripts[0] : null;

    // 3. Get news — prefer DB (whitelist-filtered); fallback to FMP with whitelist
    const newsDoc = await getStockNews(symbol);
    let rawNews: StockNewsArticle[];
    if (newsDoc && newsDoc.articles && newsDoc.articles.length > 0) {
      rawNews = newsDoc.articles
        .slice()
        .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
        .slice(0, 30)
        .map((a) => toStockNewsArticle(a, symbol));
    } else {
      // Fallback: FMP direct, apply whitelist filter
      const fmpNews = await fetchStockNews(symbol, 50);
      rawNews = fmpNews.filter((a) =>
        NEWS_SOURCE_WHITELIST.some((s) => (a.site ?? '').toLowerCase().includes(s))
      ).slice(0, 30);
    }

    // 4. Generate AI commentary
    const { title, body, model, keyPoints, earningsDirectionBody, shadowJGSummaryBody } = await generateCommentary(
      symbol,
      transcript,
      rawNews,
      mentionDate,
      mentionClose,
      latestClose
    );

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
