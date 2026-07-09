import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { getTopStocksV2 } from '@/lib/db/activityLogs';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get('days') || 30);
  const limit = Math.min(50, Number(searchParams.get('limit') || 20));
  const stocks = await getTopStocksV2({ days, limit });
  return NextResponse.json({ stocks });
}
