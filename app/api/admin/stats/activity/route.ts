import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminSession } from '@/lib/auth';
import { getActivityEvents } from '@/lib/db/activityLogs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 30)));
  const type = searchParams.get('type') || 'all';
  const email = searchParams.get('email') || '';
  const days = Math.max(1, Number(searchParams.get('days') || 7));
  const result = await getActivityEvents({ page, pageSize, type: type || 'all', email: email || undefined, days });
  return NextResponse.json(result);
}
