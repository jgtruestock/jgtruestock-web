import { NextResponse } from 'next/server';
import { getActiveAnnouncement } from '@/lib/db/announcement';

export async function GET() {
  const ann = await getActiveAnnouncement();
  return NextResponse.json({ announcement: ann });
}
