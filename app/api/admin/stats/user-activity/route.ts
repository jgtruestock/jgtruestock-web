import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { getUserActivity } from '@/lib/db/activityLogs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email') || '';
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = Math.min(50, Number(searchParams.get('pageSize') || 30));
  const result = await getUserActivity({ email, page, pageSize });
  return NextResponse.json(result);
}
