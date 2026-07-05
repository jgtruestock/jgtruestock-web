import { getJgtDb } from '@/lib/mongodb';
import type { JGStockFiling, JGStockFilingType } from '@/types/commentary';

export async function getLatestFiling(
  symbol: string,
  filingType: JGStockFilingType = 'earnings_transcript'
): Promise<JGStockFiling | null> {
  const db = await getJgtDb();
  return db
    .collection<JGStockFiling>('jg_stock_filings')
    .findOne(
      { symbol: symbol.toUpperCase(), filingType },
      { sort: { date: -1 } }
    );
}

export async function upsertFiling(
  symbol: string,
  data: Omit<JGStockFiling, '_id' | 'createdAt' | 'fetchedAt'>
): Promise<void> {
  const db = await getJgtDb();
  const now = new Date();
  // Upsert by symbol + filingType + date (natural unique key)
  await db.collection('jg_stock_filings').updateOne(
    {
      symbol: symbol.toUpperCase(),
      filingType: data.filingType,
      date: data.date,
    },
    {
      $set: {
        ...data,
        symbol: symbol.toUpperCase(),
        fetchedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );
}
