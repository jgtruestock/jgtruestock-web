import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStockNews, upsertStockNews } from '@/lib/db/stockNews';
import { fetchStockNews } from '@/lib/fmp';
import type { NewsAPIResponse, JGStockNewsArticle } from '@/types/commentary';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  // Auth temporarily disabled for preview — TODO: re-enable before production
  // const session = await getServerSession(authOptions);
  // if (!session) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  try {
    // Try DB cache first
    let cached = await getStockNews(upperSymbol);

    // If no cache, fall back to live FMP fetch and store
    if (!cached) {
      const raw = await fetchStockNews(upperSymbol, 50);
      const articles: JGStockNewsArticle[] = raw.map((a) => ({
        title: a.title || '',
        url: a.url || '',
        source: a.site || '',
        publishedDate: a.publishedDate || '',
        snippet: (a.text || '').slice(0, 200),
        sentiment: null,
      }));

      if (articles.length > 0) {
        await upsertStockNews(upperSymbol, articles);
        // Re-read from DB so we get consistent timestamps
        cached = await getStockNews(upperSymbol);
      }
    }

    const res: NewsAPIResponse = {
      symbol: upperSymbol,
      articles: cached?.articles ?? [],
      lastUpdated: cached?.fetchedAt?.toISOString() ?? null,
    };

    return NextResponse.json(res);
  } catch (err) {
    console.error(`[/api/stocks/${upperSymbol}/news] error:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
