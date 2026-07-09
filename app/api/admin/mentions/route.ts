import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdmin, ADMIN_DISCORD_ID } from '@/lib/auth';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jgdady@gmail.com';
function isAdminSession(session: any): boolean {
  const discordId = session?.user?.discordId;
  const email = session?.user?.email;
  return isAdmin(discordId) || email === ADMIN_EMAIL;
}
import { getJgtDb } from '@/lib/mongodb';
import { getHistoricalPrice, getCompanyProfile, getCurrentPrice } from '@/lib/fmp';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const { symbol, mentionDate, source } = body;

    if (!symbol || !mentionDate) {
      return NextResponse.json(
        { error: 'symbol and mentionDate are required' },
        { status: 400 }
      );
    }

    const upperSymbol = symbol.toUpperCase();

    // Fetch company profile
    const profile = await getCompanyProfile(upperSymbol);
    const companyName = profile?.name || upperSymbol;
    const exchange = profile?.exchange || '';

    // Fetch historical price for the mention date
    const priceAtMention = await getHistoricalPrice(upperSymbol, mentionDate);
    if (priceAtMention === null) {
      return NextResponse.json(
        { error: `Could not fetch price for ${upperSymbol} on ${mentionDate}. Market may have been closed.` },
        { status: 400 }
      );
    }

    // 立即抓當前股價，計算漲幅
    const currentPrice = (await getCurrentPrice(upperSymbol)) ?? priceAtMention;
    const gainPct = priceAtMention > 0
      ? parseFloat(((currentPrice - priceAtMention) / priceAtMention * 100).toFixed(2))
      : 0;

    const db = await getJgtDb();
    const now = new Date();

    // 檢查是否已存在
    const existing = await db.collection('jg_mention_history').findOne({ symbol: upperSymbol });

    if (existing) {
      // 已存在：只累加次數，更新當前股價和漲幅，不動 mentionDate 和 priceAtMention
      await db.collection('jg_mention_history').updateOne(
        { symbol: upperSymbol },
        {
          $inc: { mentionCount: 1 },
          $set: {
            currentPrice,
            gainPct,
            updatedAt: now,
          },
        }
      );
      const updated = await db.collection('jg_mention_history').findOne({ symbol: upperSymbol });
      return NextResponse.json({
        success: true,
        id: existing._id.toString(),
        record: { ...updated, _id: updated!._id.toString() },
        alreadyExists: true,
      });
    } else {
      // 第一次：新增，mentionCount 從 1 開始
      const doc = {
        symbol: upperSymbol,
        companyName,
        exchange,
        mentionDate: mentionDate,  // 統一存 ISO 字串 "YYYY-MM-DD"
        priceAtMention,
        currentPrice,
        gainPct,
        source: source || '',
        mentionCount: 1,
        createdAt: now,
        updatedAt: now,
      };
      const result = await db.collection('jg_mention_history').insertOne(doc);
      return NextResponse.json({
        success: true,
        id: result.insertedId.toString(),
        record: { ...doc, _id: result.insertedId.toString() },
      });
    }
  } catch (err) {
    console.error('POST /api/admin/mentions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = await getJgtDb();
  const records = await db
    .collection('jg_mention_history')
    .find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  return NextResponse.json({
    records: records.map((r) => ({
      ...r,
      _id: r._id.toString(),
    })),
  });
}
