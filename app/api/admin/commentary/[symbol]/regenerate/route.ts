/**
 * PR 7 — 手動生成 AI 點評草稿（後台用）
 * POST /api/admin/commentary/[symbol]/regenerate
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdmin } from '@/lib/auth';
import { get13fDb } from '@/lib/mongodb';
import { fetchEarningsTranscript, fetchStockNews } from '@/lib/fmp';
import { generateCommentary } from '@/lib/ai/generateCommentary';
import { upsertCommentary } from '@/lib/db/commentary';

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  // Auth disabled for preview
  const discordId = "preview-admin"; // bypass, { status: 403 });

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

    // 3. Fetch latest news
    const rawNews = await fetchStockNews(symbol, 30);

    // 4. Generate AI commentary
    const { title, body, model } = await generateCommentary(
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
