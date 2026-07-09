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

  // 失敗記錄
  const failures = await db.collection('jg_verify_logs')
    .find({ success: false, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  // 統計
  const [totalAttempts, successCount, failCount] = await Promise.all([
    db.collection('jg_verify_logs').countDocuments({ createdAt: { $gte: since } }),
    db.collection('jg_verify_logs').countDocuments({ success: true, createdAt: { $gte: since } }),
    db.collection('jg_verify_logs').countDocuments({ success: false, createdAt: { $gte: since } }),
  ]);

  // 失敗原因分布
  const errorDist = await db.collection('jg_verify_logs').aggregate([
    { $match: { success: false, createdAt: { $gte: since } } },
    { $group: { _id: '$errorType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  // 未完成驗證的登入帳號（有 login_logs 但無 user_bindings）
  const today = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const loggedInEmails = await db.collection('jg_login_logs').distinct('email', { createdAt: { $gte: today } });
  const boundEmails = (await db.collection('user_bindings').find({}, { projection: { email: 1 } }).toArray()).map((b: any) => b.email);
  const boundSet = new Set(boundEmails);
  const unverified = loggedInEmails.filter((e: string) => !boundSet.has(e));

  return NextResponse.json({
    stats: { totalAttempts, successCount, failCount, unverifiedCount: unverified.length },
    errorDist: errorDist.map((e: any) => ({ type: e._id, count: e.count })),
    failures: failures.map((f: any) => ({
      email: f.email,
      channelUrl: f.channelUrl,
      errorType: f.errorType,
      createdAt: f.createdAt,
    })),
    unverifiedEmails: unverified.slice(0, 50),
  });
}
