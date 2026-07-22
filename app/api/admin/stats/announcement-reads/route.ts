import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { getJgtDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = await getJgtDb();

  // 取所有公告
  const announcements = await db.collection('announcements')
    .find({ active: true })
    .sort({ createdAt: -1 })
    .toArray();

  // 取各公告已讀人數 + 已讀 email 列表
  const result = await Promise.all(
    announcements.map(async (ann) => {
      const reads = await db.collection('jg_announcement_reads')
        .find({ announcementId: ann._id.toString() })
        .toArray();
      return {
        announcementId: ann._id.toString(),
        title: ann.title,
        createdAt: ann.createdAt,
        readCount: reads.length,
        readers: reads.map(r => ({ email: r.email, readAt: r.readAt })),
      };
    })
  );

  return NextResponse.json({ announcements: result });
}
