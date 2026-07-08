import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStockFilings, upsertStockFilings } from '@/lib/db/stockFilings';
import { fetchSecFilings } from '@/lib/fmp';
import type { FilingsAPIResponse, SecFiling } from '@/types/commentary';

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
    let cached = await getStockFilings(upperSymbol);

    // If no cache, fall back to live FMP fetch and store
    if (!cached) {
      const raw = await fetchSecFilings(upperSymbol, '8-K', 20);
      const filings: SecFiling[] = raw.map((f) => ({
        symbol: f.symbol,
        fillingDate: f.fillingDate,
        acceptedDate: f.acceptedDate,
        type: f.type,
        link: f.link,
        finalLink: f.finalLink,
      }));

      if (filings.length > 0) {
        await upsertStockFilings(upperSymbol, filings);
        cached = await getStockFilings(upperSymbol);
      }
    }

    const res: FilingsAPIResponse = {
      symbol: upperSymbol,
      filings: cached?.filings ?? [],
      lastUpdated: cached?.fetchedAt?.toISOString() ?? null,
    };

    return NextResponse.json(res);
  } catch (err) {
    console.error(`[/api/stocks/${upperSymbol}/filings] error:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
