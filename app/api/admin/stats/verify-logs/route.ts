import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { getJgtDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get('days') || 1);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const db = await getJgtDb();

  // Run all queries in parallel
  const [failures, statsAgg, errorDist, loggedInEmails, boundEmails] = await Promise.all([
    // 失敗記錄
    db.collection('jg_verify_logs')
      .find({ success: false, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray(),

    // 單次 aggregation 取代 3 次 countDocuments
    db.collection('jg_verify_logs').aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          success: { $sum: { $cond: ['$success', 1, 0] } },
          fail: { $sum: { $cond: ['$success', 0, 1] } },
        },
      },
    ]).toArray(),

    // 失敗原因分布
    db.collection('jg_verify_logs').aggregate([
      { $match: { success: false, createdAt: { $gte: since } } },
      { $group: { _id: '$errorType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),

    // 已登入的 email
    db.collection('jg_login_logs').distinct('email', { createdAt: { $gte: since } }),

    // 已綁定的 email
    db.collection('user_bindings').distinct('email'),
  ]);

  const s = statsAgg[0] ?? { total: 0, success: 0, fail: 0 };
  const boundSet = new Set(boundEmails);
  const unverified = loggedInEmails.filter((e: string) => !boundSet.has(e));

  return NextResponse.json({
    stats: {
      totalAttempts: s.total,
      successCount: s.success,
      failCount: s.fail,
      unverifiedCount: unverified.length,
    },
    errorDist: errorDist.map((e: any) => ({ type: e._id, count: e.count })),
    failures: failures.map((f: any) => ({
      email: f.email,
      channelUrl: f.channelUrl,
      errorType: f.errorType,
      createdAt: f.createdAt,
    })),
    unverifiedEmails: unverified.slice(0, 50),
  }, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  });
}
