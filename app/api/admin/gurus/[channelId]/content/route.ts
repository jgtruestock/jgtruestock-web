import { NextResponse } from 'next/server';
import { getGuruContent } from '@/lib/db/guruContent';

export async function GET(
  _request: Request,
  { params }: { params: { channelId: string } }
) {
  const { channelId } = params;
  const content = await getGuruContent(channelId, 20);
  return NextResponse.json({ content });
}
