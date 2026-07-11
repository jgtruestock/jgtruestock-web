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

  // If caller provides explicit title/body use them; otherwise promote draft to published
  const commentary = await getCommentary(symbol);

  const newTitle = data.title ?? commentary?.draftTitle ?? null;
  const newBody = data.body ?? commentary?.draftBody ?? null;

  const updateOps: Record<string, unknown> = {
    $set: {
      publishedTitle: newTitle,
      publishedBody: newBody,
      publishedAt: now,
      updatedAt: now,
      status: 'published',
    },
  };

  // If there's an existing published version, push it to history
  if (commentary?.publishedTitle || commentary?.publishedBody) {
    updateOps.$push = {
      publishHistory: {
        $each: [
          {
            publishedTitle: commentary.publishedTitle ?? null,
            publishedBody: commentary.publishedBody ?? null,
            publishedAt: commentary.publishedAt ?? now,
          },
        ],
        $slice: -10,
      },
    };
  }

  await db
    .collection('jg_commentary')
    .updateOne({ symbol: symbol.toUpperCase() }, updateOps as any);

  return now;
}
