import { getJgtDb } from '@/lib/mongodb';
import type { JGStockNews, JGStockNewsArticle } from '@/types/commentary';

export async function getStockNews(symbol: string): Promise<JGStockNews | null> {
  const db = await getJgtDb();
  return db
    .collection<JGStockNews>('jg_stock_news')
    .findOne({ symbol: symbol.toUpperCase() });
}

export async function upsertStockNews(
  symbol: string,
  articles: JGStockNewsArticle[]
): Promise<void> {
  const db = await getJgtDb();
  const now = new Date();
  await db.collection('jg_stock_news').updateOne(
    { symbol: symbol.toUpperCase() },
    {
      $set: {
        symbol: symbol.toUpperCase(),
        articles,
        articleCount: articles.length,
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
