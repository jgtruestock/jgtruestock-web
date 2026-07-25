import { getJgtDb } from '../mongodb';

export const PRESET_TAGS = [
  'AI/ML', '光通訊', '加密/金融', '半導體', '國防', '基因編輯',
  '太空', '核能', '機器人', '生技/製藥', '網路安全', '能源/電力',
  '雲端/SaaS', '量子電腦'
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
