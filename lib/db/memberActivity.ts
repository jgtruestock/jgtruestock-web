import { ObjectId } from 'mongodb';
import { getJgtDb } from '@/lib/mongodb';

interface JGMemberActivity {
  _id?: ObjectId;
  userId: string;       // Google sub ID (or email as fallback)
  userEmail: string;
  type: 'page_view';
  page: string;         // e.g. '/stocks/RKLB'
  symbol?: string;      // 若是股票頁
  createdAt: Date;
}

export async function logActivity(
  data: Omit<JGMemberActivity, '_id' | 'createdAt'>
): Promise<void> {
  const db = await getJgtDb();
  await db.collection<JGMemberActivity>('jg_member_activity').insertOne({
    ...data,
    createdAt: new Date(),
  });
}

export interface MemberStat {
  userId: string;
  userEmail: string;
  totalViews: number;
  lastSeen: Date;
  topStocks: string[];  // top 3 symbols
}

export async function getMemberStats(): Promise<MemberStat[]> {
  const db = await getJgtDb();

  const pipeline = [
    // 1. Group by userId to get basic stats
    {
      $group: {
        _id: '$userId',
        userEmail: { $last: '$userEmail' },
        totalViews: { $sum: 1 },
        lastSeen: { $max: '$createdAt' },
        symbols: {
          $push: {
            $cond: [{ $ifNull: ['$symbol', false] }, '$symbol', '$$REMOVE'],
          },
        },
      },
    },
    // 2. Sort by lastSeen desc
    { $sort: { lastSeen: -1 as -1 } },
    // 3. Project final shape
    {
      $project: {
        _id: 0,
        userId: '$_id',
        userEmail: 1,
        totalViews: 1,
        lastSeen: 1,
        symbols: 1,
      },
    },
  ];

  const rows = await db
    .collection('jg_member_activity')
    .aggregate(pipeline)
    .toArray();

  // Compute topStocks client-side (top 3 by frequency)
  return rows.map((r) => {
    const freq: Record<string, number> = {};
    for (const s of (r.symbols as string[]) ?? []) {
      freq[s] = (freq[s] ?? 0) + 1;
    }
    const topStocks = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sym]) => sym);

    return {
      userId: r.userId as string,
      userEmail: r.userEmail as string,
      totalViews: r.totalViews as number,
      lastSeen: r.lastSeen as Date,
      topStocks,
    };
  });
}
