import { getJgtDb } from '@/lib/mongodb';

export interface Announcement {
  _id?: string;
  title: string;
  content: string; // 支援換行（\n），前台用 white-space: pre-line 顯示
  active: boolean;
  published?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getActiveAnnouncement(): Promise<Announcement | null> {
  const db = await getJgtDb();
  const doc = await db
    .collection('announcements')
    .findOne({ active: true }, { sort: { updatedAt: -1 } });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() } as Announcement;
}

export async function upsertAnnouncement(data: { title: string; content: string; active: boolean }) {
  const db = await getJgtDb();
  const col = db.collection('announcements');
  const existing = await col.findOne({}, { sort: { createdAt: -1 } });
  const now = new Date();
  if (existing) {
    await col.updateOne({ _id: existing._id }, { $set: { ...data, updatedAt: now } });
    return { ...existing, ...data, updatedAt: now, _id: existing._id.toString() };
  } else {
    const result = await col.insertOne({ ...data, createdAt: now, updatedAt: now });
    return { ...data, createdAt: now, updatedAt: now, _id: result.insertedId.toString() };
  }
}

// 強制插入新公告（新 _id → 所有用戶都會再次看到）
export async function insertNewAnnouncement(data: { title: string; content: string; active: boolean }) {
  const db = await getJgtDb();
  const col = db.collection('announcements');
  const now = new Date();
  // 不再 unpublish 舊公告，讓所有用戶都能看到所有歷史公告
  const result = await col.insertOne({ ...data, active: true, published: true, createdAt: now, updatedAt: now });
  return { ...data, active: true, published: true, createdAt: now, updatedAt: now, _id: result.insertedId.toString() };
}

// 取得所有已發佈的公告，按 createdAt 升序（舊→新）
export async function getPublishedAnnouncements(): Promise<Announcement[]> {
  const db = await getJgtDb();
  const docs = await db
    .collection('announcements')
    .find({ published: true })
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map(doc => ({ ...doc, _id: doc._id.toString() })) as Announcement[];
}
