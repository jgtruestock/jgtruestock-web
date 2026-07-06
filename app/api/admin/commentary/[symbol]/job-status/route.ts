import { NextRequest, NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  const db = await getJgtDb();
  const job = await db.collection('jg_generation_jobs').findOne(
    { jobId },
    { projection: { _id: 0, jobId: 1, symbol: 1, status: 1, requestedAt: 1, completedAt: 1, result: 1, error: 1 } }
  );

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
