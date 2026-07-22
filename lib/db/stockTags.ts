import { getJgtDb } from '../mongodb';

export const PRESET_TAGS = [
  'AI/ML', '半導體', '雲端/SaaS', '能源', '核能', '太空',
  '生技', '量子電腦', '網路安全', '金融科技', '基礎建設', '加密貨幣'
];

export async function getTagsMap(symbols: string[]): Promise<Record<string, string[]>> {
  const db = await getJgtDb();
  const docs = await db.collection('jg_stock_tags').find({ symbol: { $in: symbols } }).toArray();
  const map: Record<string, string[]> = {};
  for (const doc of docs) {
    map[doc.symbol] = doc.tags || [];
  }
  return map;
}

export async function setStockTags(symbol: string, tags: string[]): Promise<void> {
  const db = await getJgtDb();
  await db.collection('jg_stock_tags').updateOne(
    { symbol: symbol.toUpperCase() },
    { $set: { tags, updatedAt: new Date() } },
    { upsert: true }
  );
}
