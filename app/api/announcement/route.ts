import { NextResponse } from 'next/server';
import { getPublishedAnnouncements } from '@/lib/db/announcement';

export async function GET() {
  const announcements = await getPublishedAnnouncements();
  // 向下相容：同時回傳最新那則給舊前端用
  const latest = announcements.length > 0 ? announcements[announcements.length - 1] : null;
  return NextResponse.json({ announcements, announcement: latest });
}
