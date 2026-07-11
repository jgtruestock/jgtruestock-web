import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCommentary } from '@/lib/db/commentary';
import type { CommentaryResponse } from '@/types/commentary';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  // Auth: protected by middleware, but double-check here for safety
  const session = await getServerSession(authOptions);
  if (!session) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  try {
    const commentary = await getCommentary(upperSymbol);

    if (!commentary || commentary.status !== 'published' || !commentary.publishedTitle) {
      const res: CommentaryResponse = { symbol: upperSymbol, hasCommentary: false };
      return NextResponse.json(res);
    }

    const res: CommentaryResponse = {
      symbol: upperSymbol,
      hasCommentary: true,
      title: commentary.publishedTitle,
      body: commentary.publishedBody ?? '',
      publishedAt: commentary.publishedAt?.toISOString() ?? '',
      earningsDirection: commentary.earningsDirection
        ? { body: commentary.earningsDirection.body, generatedAt: commentary.earningsDirection.generatedAt?.toISOString() ?? null }
        : null,
      shadowJGSummary: commentary.shadowJGSummary
        ? { body: commentary.shadowJGSummary.body, generatedAt: commentary.shadowJGSummary.generatedAt?.toISOString() ?? null }
        : null,
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error(`[/api/stocks/${upperSymbol}/commentary] error:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
