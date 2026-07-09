import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminSession } from '@/lib/auth';
import { getMemberList, getTopStockPerEmail } from '@/lib/db/activityLogs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '20')));
  const search = searchParams.get('search') || '';

  try {
    const { members, total } = await getMemberList({ page, pageSize, search });

    // Enrich with top stock per email
    const emails = members.map((m: any) => m.email as string);
    const topStocks = await getTopStockPerEmail(emails);

    const enriched = members.map((m: any) => ({
      ...m,
      topStock: topStocks[m.email] || null,
    }));

    return NextResponse.json({ members: enriched, total });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
