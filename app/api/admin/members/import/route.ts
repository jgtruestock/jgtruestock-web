import { NextRequest, NextResponse } from 'next/server';
import { getJgtDb } from '@/lib/mongodb';

// Parse tier string: '150元方案' → '150', '450元方案' → '450'
function parseTier(raw: string): '150' | '450' {
  if (raw.includes('450')) return '450';
  return '150';
}

// Extract channel ID from YouTube URL
function extractChannelId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/channel\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  // Note: auth is handled by middleware
  try {
    const contentType = req.headers.get('content-type') || '';
    let records: any[] = [];

    if (contentType.includes('application/json')) {
      // Accept pre-parsed JSON array
      records = await req.json();
    } else if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
      const text = await req.text();
      records = parseCsv(text);
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      const text = await file.text();
      records = parseCsv(text);
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type. Use application/json, text/csv, or multipart/form-data' },
        { status: 415 }
      );
    }

    const db = await getJgtDb();
    const col = db.collection('yt_members');

    // Ensure unique index on channelId
    await col.createIndex({ channelId: 1 }, { unique: true });

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];
    const now = new Date();

    for (const row of records) {
      try {
        const channelName = (row['會員'] || '').trim();
        const profileUrl = (row['連結到個人資料'] || '').trim();
        const tierRaw = (row['目前級別'] || '').trim();
        const statusRaw = (row['最近狀態更新'] || '').trim();

        const channelId = extractChannelId(profileUrl);
        if (!channelId) {
          errors.push(`Skipped "${channelName}": no channelId from URL "${profileUrl}"`);
          continue;
        }

        const tier = parseTier(tierRaw);
        const status = statusRaw;

        const existing = await col.findOne({ channelId });
        await col.updateOne(
          { channelId },
          {
            $set: {
              channelId,
              channelName,
              tier,
              status,
              updatedAt: now,
            },
            $setOnInsert: {
              importedAt: now,
            },
          },
          { upsert: true }
        );

        if (existing) {
          updated++;
        } else {
          imported++;
        }
      } catch (err: any) {
        errors.push(`Row error: ${err.message}`);
      }
    }

    return NextResponse.json({ imported, updated, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseRow(lines[0]);
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    results.push(row);
  }

  return results;
}

function parseRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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
