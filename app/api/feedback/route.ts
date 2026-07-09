import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getJgtDb } from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const userEmail = (token?.email as string)?.toLowerCase() ?? null;

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
      email: userEmail,
      createdAt: now,
      userAgent: req.headers.get('user-agent') ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[feedback]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
