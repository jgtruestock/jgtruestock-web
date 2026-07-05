import { getJgtDb } from '@/lib/mongodb';
import type { JGCommentary } from '@/types/commentary';

export async function getCommentary(symbol: string): Promise<JGCommentary | null> {
  const db = await getJgtDb();
  const doc = await db
    .collection<JGCommentary>('jg_commentary')
    .findOne({ symbol: symbol.toUpperCase() });
  return doc;
}

export async function upsertCommentary(
  symbol: string,
  data: Partial<Omit<JGCommentary, '_id' | 'symbol' | 'createdAt'>>
): Promise<void> {
  const db = await getJgtDb();
  const now = new Date();
  await db.collection('jg_commentary').updateOne(
    { symbol: symbol.toUpperCase() },
    {
      $set: {
        ...data,
        symbol: symbol.toUpperCase(),
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

export async function publishCommentary(
  symbol: string,
  data: { title?: string; body?: string }
): Promise<Date> {
  const db = await getJgtDb();
  const now = new Date();

  // If title/body provided, update draft first then publish
  const setFields: Record<string, unknown> = {
    publishedAt: now,
    updatedAt: now,
    status: 'published',
  };

  // If caller provides explicit title/body use them; otherwise promote draft to published
  const commentary = await getCommentary(symbol);

  setFields.publishedTitle = data.title ?? commentary?.draftTitle ?? null;
  setFields.publishedBody = data.body ?? commentary?.draftBody ?? null;

  await db
    .collection('jg_commentary')
    .updateOne({ symbol: symbol.toUpperCase() }, { $set: setFields });

  return now;
}
