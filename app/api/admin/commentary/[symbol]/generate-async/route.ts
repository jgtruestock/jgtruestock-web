import { NextRequest, NextResponse } from 'next/server';
import { createGenerationJob, hasActiveJob } from '@/lib/db/generationJob';

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();

  // 防重複
  if (await hasActiveJob(symbol)) {
    return NextResponse.json(
      { error: '此股票已在生成中，請稍候' },
      { status: 409 }
    );
  }

  const jobId = await createGenerationJob(symbol);

  return NextResponse.json({ jobId, symbol, status: 'pending' });
}
