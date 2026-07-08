import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdmin } from '@/lib/auth';
import { getMemberStats } from '@/lib/db/memberActivity';

export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = (session?.user as any)?.discordId;

  if (!isAdmin(discordId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const stats = await getMemberStats();
    return NextResponse.json({ stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
