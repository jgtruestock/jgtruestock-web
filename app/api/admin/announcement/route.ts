import { NextResponse } from 'next/server';
import { getActiveAnnouncement, upsertAnnouncement, insertNewAnnouncement } from '@/lib/db/announcement';

export async function GET() {
  const ann = await getActiveAnnouncement();
  return NextResponse.json({ announcement: ann });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, content, active, forceNew } = body;
  if (!title || !content) {
    return NextResponse.json({ error: '標題和內容不能為空' }, { status: 400 });
  }
  // forceNew = true → 插入全新公告（新 _id），讓所有用戶都會再次看到
  const result = forceNew
    ? await insertNewAnnouncement({ title, content, active: !!active })
    : await upsertAnnouncement({ title, content, active: !!active });
  return NextResponse.json({ announcement: result });
}
