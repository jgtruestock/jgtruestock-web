/**
 * create_indexes.ts — 建立 jg_login_logs 和 jg_activity_events 的 indexes + TTL
 * 可重複執行（idempotent）
 *
 * 執行方式：
 *   npx ts-node -r tsconfig-paths/register scripts/create_indexes.ts
 */

// Load env from .env.local
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore if .env.local not found
  }
}
loadEnv();

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env.local');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db('jgtruestock');

  console.log('📦 Connected to MongoDB jgtruestock db');

  // ─── jg_login_logs ─────────────────────────────────────────────────────────

  const loginLogs = db.collection('jg_login_logs');

  // Compound index: email + createdAt desc (for per-user login history queries)
  await loginLogs.createIndex(
    { email: 1, createdAt: -1 },
    { name: 'email_createdAt_desc', background: true }
  );
  console.log('✅ jg_login_logs: index email+createdAt(-1)');

  // TTL index: 365 days
  await loginLogs.createIndex(
    { createdAt: 1 },
    {
      name: 'createdAt_ttl_365d',
      expireAfterSeconds: 31536000, // 365 days
      background: true,
    }
  );
  console.log('✅ jg_login_logs: TTL index (365 days)');

  // ─── jg_activity_events ────────────────────────────────────────────────────

  const activityEvents = db.collection('jg_activity_events');

  // Compound index: email + createdAt desc
  await activityEvents.createIndex(
    { email: 1, createdAt: -1 },
    { name: 'email_createdAt_desc', background: true }
  );
  console.log('✅ jg_activity_events: index email+createdAt(-1)');

  // Compound index: type + createdAt desc (for analytics by event type)
  await activityEvents.createIndex(
    { type: 1, createdAt: -1 },
    { name: 'type_createdAt_desc', background: true }
  );
  console.log('✅ jg_activity_events: index type+createdAt(-1)');

  // Compound index: symbol + createdAt desc (for top stocks analytics)
  await activityEvents.createIndex(
    { symbol: 1, createdAt: -1 },
    { name: 'symbol_createdAt_desc', background: true }
  );
  console.log('✅ jg_activity_events: index symbol+createdAt(-1)');

  // TTL index: 180 days
  await activityEvents.createIndex(
    { createdAt: 1 },
    {
      name: 'createdAt_ttl_180d',
      expireAfterSeconds: 15552000, // 180 days
      background: true,
    }
  );
  console.log('✅ jg_activity_events: TTL index (180 days)');

  await client.close();
  console.log('\n🎉 All indexes created successfully!');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
