import { NextRequest, NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, message } = body;

    if (!type || !message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: '請填寫意見內容' }, { status: 400 });
    }

    const validTypes = ['feature', 'stock', 'general'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: '無效的類型' }, { status: 400 });
    }

    const db = await getJgtDb();
    const now = new Date();

    await db.collection('jg_feedback').insertOne({
      type,
      message: message.trim().slice(0, 2000),
      createdAt: now,
      // capture rough origin for context
      userAgent: req.headers.get('user-agent') ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[feedback]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
