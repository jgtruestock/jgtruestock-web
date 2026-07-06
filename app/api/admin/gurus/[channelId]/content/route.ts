import { NextRequest, NextResponse } from 'next/server';
import { getGuruContent } from '@/lib/db/guruContent';

interface RouteParams {
  params: Promise<{ channelId: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { channelId } = await params;
  const content = await getGuruContent(channelId, 20);
  return NextResponse.json({ content });
}
