import { NextRequest, NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';
import { deleteBinding } from '@/lib/db/userBindings';

// GET /api/admin/bindings?search=xxx&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 50;

  const db = await getJgtDb();
  const query: Record<string, any> = {};

  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { channelId: { $regex: search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    db
      .collection('user_bindings')
      .find(query)
      .sort({ boundAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    db.collection('user_bindings').countDocuments(query),
  ]);

  return NextResponse.json({ items, total, page, limit });
}

// DELETE /api/admin/bindings?email=xxx
export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const email = searchParams.get('email') ?? '';

  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  await deleteBinding(email, 'admin-panel');
  return NextResponse.json({ success: true });
}
