import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import {
  getTopStocks,
  getActiveUserCount,
  getNewVsReturning,
} from '@/lib/db/activityLogs';
import { getJgtDb } from '@/lib/mongodb';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [
      todayActiveUsers,
      weekActiveUsers,
      topStocks,
      newVsReturning,
      recentLogins,
    ] = await Promise.all([
      getActiveUserCount(24 * 60 * 60 * 1000),       // last 24h
      getActiveUserCount(7 * 24 * 60 * 60 * 1000),   // last 7 days
      getTopStocks(30, 10),
      getNewVsReturning(),
      getRecentLogins(10),
    ]);

    return NextResponse.json({
      today: {
        activeUsers: todayActiveUsers,
        newUsers: newVsReturning.newUsers,
        returningUsers: newVsReturning.returningUsers,
      },
      week: {
        activeUsers: weekActiveUsers,
      },
      topStocks,
      recentLogins,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function getRecentLogins(limit: number) {
  const db = await getJgtDb();
  const docs = await db
    .collection('jg_login_logs')
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d: any) => ({
    email: d.email,
    device: d.device,
    createdAt: d.createdAt,
  }));
}
