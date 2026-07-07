import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdmin } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { getHistoricalPrice, getCompanyProfile, getCurrentPrice } from '@/lib/fmp';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userDiscordId = (session.user as any)?.discordId;
  const userEmail = (session.user as any)?.email;
  if (!isAdmin(userDiscordId) && !isAdmin(userEmail)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

    const db = await getDb();
    const now = new Date();

    const doc = {
      symbol: upperSymbol,
      companyName,
      exchange,
      mentionDate: new Date(mentionDate),
      priceAtMention,
      currentPrice,
      gainPct,
      source: source || '',
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('jg_mention_history').insertOne(doc);

    return NextResponse.json({
      success: true,
      id: result.insertedId.toString(),
      record: { ...doc, _id: result.insertedId.toString() },
    });
  } catch (err) {
    console.error('POST /api/admin/mentions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin((session.user as any)?.discordId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = await getDb();
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
