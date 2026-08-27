import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getJgtDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  // Auth: member or admin required
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getJgtDb();
    const collection = db.collection('biotech_milestones');

    const now = new Date();
    const in12Months = new Date(now);
    in12Months.setMonth(in12Months.getMonth() + 12);

    // 只回傳未來 12 個月內的 milestones，依完成日升序
    const milestones = await collection
      .find({
        primaryCompletionDate: {
          $gte: now.toISOString().slice(0, 10),
          $lte: in12Months.toISOString().slice(0, 10),
        },
      })
      .sort({ primaryCompletionDate: 1 })
      .limit(100)
      .toArray();

    return NextResponse.json({ milestones });
  } catch (err) {
    console.error('[biotech/milestones] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
