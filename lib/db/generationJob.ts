import { getJgtDb } from '@/lib/mongodb';
import { randomUUID } from 'crypto';

export interface GenerationJob {
  jobId: string;
  symbol: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedBy: string;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  workerHost: string | null;
  result: {
    title: string;
    body: string;
    model: string;
    keyPoints: any[];
  } | null;
  error: string | null;
  createdAt: Date;
}

/** 建立新 job，回傳 jobId */
export async function createGenerationJob(symbol: string, requestedBy = 'admin'): Promise<string> {
  const db = await getJgtDb();
  const jobId = randomUUID();
  const now = new Date();
  await db.collection('jg_generation_jobs').insertOne({
    jobId,
    symbol: symbol.toUpperCase(),
    status: 'pending',
    requestedBy,
    requestedAt: now,
    startedAt: null,
    completedAt: null,
    workerHost: null,
    result: null,
    error: null,
    createdAt: now,
  });
  return jobId;
}

/** 查詢 job 狀態 */
export async function getGenerationJob(jobId: string): Promise<GenerationJob | null> {
  const db = await getJgtDb();
  return db.collection<GenerationJob>('jg_generation_jobs').findOne({ jobId });
}

/** 防止同一 symbol 重複排隊 */
export async function hasActiveJob(symbol: string): Promise<boolean> {
  const db = await getJgtDb();
  const job = await db.collection('jg_generation_jobs').findOne({
    symbol: symbol.toUpperCase(),
    status: { $in: ['pending', 'processing'] },
  });
  return !!job;
}
