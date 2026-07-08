import { getJgtDb } from '@/lib/mongodb';
import type { JGStockPressReleases, PressRelease } from '@/types/commentary';

export async function getStockPressReleases(symbol: string): Promise<JGStockPressReleases | null> {
  const db = await getJgtDb();
  return db
    .collection<JGStockPressReleases>('stockPressReleases')
    .findOne({ symbol: symbol.toUpperCase() });
}

export async function upsertStockPressReleases(
  symbol: string,
  releases: PressRelease[]
): Promise<void> {
  const db = await getJgtDb();
  const now = new Date();
  await db.collection('stockPressReleases').updateOne(
    { symbol: symbol.toUpperCase() },
    {
      $set: {
        symbol: symbol.toUpperCase(),
        releases,
        fetchedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );
}
