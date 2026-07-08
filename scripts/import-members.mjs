// One-time CSV import script for yt_members collection
// Usage: node scripts/import-members.mjs <csv-path>
import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local manually
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simple .env.local parser
function loadEnv(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadEnv(join(__dirname, '..', '.env.local'));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/import-members.mjs <csv-path>');
  process.exit(1);
}

function parseTier(raw) {
  return raw.includes('450') ? '450' : '150';
}

function extractChannelId(url) {
  const match = url?.match(/\/channel\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function parseRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseRow(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim(); });
    return row;
  });
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('jgtruestock');
  const col = db.collection('yt_members');

  await col.createIndex({ channelId: 1 }, { unique: true });

  const text = readFileSync(csvPath, 'utf-8');
  const records = parseCsv(text);
  console.log(`Parsed ${records.length} rows`);

  let imported = 0, updated = 0;
  const errors = [];
  const now = new Date();

  for (const row of records) {
    const channelName = row['會員'] || '';
    const profileUrl = row['連結到個人資料'] || '';
    const tierRaw = row['目前級別'] || '';
    const status = row['最近狀態更新'] || '';

    const channelId = extractChannelId(profileUrl);
    if (!channelId) {
      errors.push(`Skipped "${channelName}": no channelId from "${profileUrl}"`);
      continue;
    }

    const tier = parseTier(tierRaw);

    try {
      const existing = await col.findOne({ channelId });
      await col.updateOne(
        { channelId },
        {
          $set: { channelId, channelName, tier, status, updatedAt: now },
          $setOnInsert: { importedAt: now },
        },
        { upsert: true }
      );
      if (existing) updated++; else imported++;
    } catch (err) {
      errors.push(`Error for ${channelId}: ${err.message}`);
    }
  }

  await client.close();
  console.log(`✅ imported=${imported}, updated=${updated}, errors=${errors.length}`);
  if (errors.length) errors.forEach(e => console.log('  ⚠️', e));
}

main().catch(err => { console.error(err); process.exit(1); });
