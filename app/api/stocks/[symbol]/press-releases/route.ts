import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStockPressReleases, upsertStockPressReleases } from '@/lib/db/stockPressReleases';
import { fetchPressReleases } from '@/lib/fmp';
import type { PressReleasesAPIResponse, PressRelease } from '@/types/commentary';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  try {
    // Try DB cache first
    let cached = await getStockPressReleases(upperSymbol);

    // If no cache, fall back to live FMP fetch and store
    if (!cached) {
      const raw = await fetchPressReleases(upperSymbol, 20);
      const releases: PressRelease[] = raw.map((r) => ({
        symbol: r.symbol,
        date: r.date,
        title: r.title,
        text: r.text,
      }));

      if (releases.length > 0) {
        await upsertStockPressReleases(upperSymbol, releases);
        cached = await getStockPressReleases(upperSymbol);
      }
    }

    const res: PressReleasesAPIResponse = {
      symbol: upperSymbol,
      releases: cached?.releases ?? [],
      lastUpdated: cached?.fetchedAt?.toISOString() ?? null,
    };

    return NextResponse.json(res);
  } catch (err) {
    console.error(`[/api/stocks/${upperSymbol}/press-releases] error:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
