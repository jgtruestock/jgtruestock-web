import { getJgtDb } from '@/lib/mongodb';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventType = 'page_view' | 'stock_view' | 'btn_click';

const VALID_EVENT_TYPES: EventType[] = ['page_view', 'stock_view', 'btn_click'];
const VALID_SECTIONS = ['commentary', 'news', 'filings'];
const VALID_BUTTON_IDS = ['watchlist_add', 'watchlist_remove', 'share', 'feedback', 'tab_commentary', 'tab_news', 'tab_filings'];

export interface LoginLogData {
  email: string;
  ip: string;
  userAgent: string;
  device: 'mobile' | 'tablet' | 'desktop';
}

export interface ActivityEventData {
  email: string;
  type: string;
  page: string;
  symbol?: string;
  meta?: {
    buttonId?: string;
    section?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  return 'unknown';
}

export function parseDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

export function isValidEventType(type: string): type is EventType {
  return VALID_EVENT_TYPES.includes(type as EventType);
}

// ─── Login Logs ───────────────────────────────────────────────────────────────

export async function logLogin(data: LoginLogData): Promise<void> {
  try {
    const db = await getJgtDb();
    await db.collection('jg_login_logs').insertOne({
      email: data.email.toLowerCase(),
      ip: maskIp(data.ip),
      userAgent: data.userAgent,
      device: data.device,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[logLogin] error:', err);
  }
}

// ─── Activity Events ──────────────────────────────────────────────────────────

export async function logEvent(data: ActivityEventData): Promise<void> {
  if (!isValidEventType(data.type)) {
    console.warn('[logEvent] invalid type:', data.type);
    return;
  }

  // Validate meta fields
  const meta: { buttonId?: string; section?: string } = {};
  if (data.meta?.buttonId && VALID_BUTTON_IDS.includes(data.meta.buttonId)) {
    meta.buttonId = data.meta.buttonId;
  }
  if (data.meta?.section && VALID_SECTIONS.includes(data.meta.section)) {
    meta.section = data.meta.section;
  }

  try {
    const db = await getJgtDb();
    await db.collection('jg_activity_events').insertOne({
      email: data.email.toLowerCase(),
      type: data.type,
      page: data.page.slice(0, 200),
      symbol: data.symbol ? data.symbol.toUpperCase().slice(0, 10) : null,
      meta: Object.keys(meta).length > 0 ? meta : {},
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[logEvent] error:', err);
  }
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export async function checkRateLimit(email: string): Promise<boolean> {
  try {
    const db = await getJgtDb();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const count = await db.collection('jg_activity_events').countDocuments({
      email: email.toLowerCase(),
      createdAt: { $gte: oneMinuteAgo },
    });
    return count < 30;
  } catch {
    return true; // allow on error
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getTopStocks(
  days: number,
  limit: number
): Promise<{ symbol: string; count: number }[]> {
  const db = await getJgtDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pipeline = [
    {
      $match: {
        type: 'stock_view',
        symbol: { $ne: null },
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: '$symbol', count: { $sum: 1 } } },
    { $sort: { count: -1 as -1 } },
    { $limit: limit },
    { $project: { _id: 0, symbol: '$_id', count: 1 } },
  ];
  return db.collection('jg_activity_events').aggregate<{ symbol: string; count: number }>(pipeline).toArray();
}

export async function getDailyActiveUsers(
  days: number
): Promise<{ date: string; count: number }[]> {
  const db = await getJgtDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pipeline = [
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          date: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          email: '$email',
        },
      },
    },
    { $group: { _id: '$_id.date', count: { $sum: 1 } } },
    { $sort: { _id: 1 as 1 } },
    { $project: { _id: 0, date: '$_id', count: 1 } },
  ];
  return db.collection('jg_activity_events').aggregate<{ date: string; count: number }>(pipeline).toArray();
}

export async function getMemberList(opts: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<{ members: any[]; total: number }> {
  const db = await getJgtDb();
  const { page, pageSize, search } = opts;
  const skip = (page - 1) * pageSize;

  const matchStage: any = {};
  if (search) {
    matchStage.email = { $regex: search, $options: 'i' };
  }

  const pipeline: any[] = [
    ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
    {
      $group: {
        _id: '$email',
        lastLogin: { $max: '$createdAt' },
        loginCount: { $sum: 1 },
      },
    },
    { $sort: { lastLogin: -1 as -1 } },
    { $skip: skip },
    { $limit: pageSize },
    { $project: { _id: 0, email: '$_id', lastLogin: 1, loginCount: 1 } },
  ];

  const members = await db.collection('jg_login_logs').aggregate(pipeline).toArray();

  // Count total distinct emails
  const countPipeline: any[] = [
    ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
    { $group: { _id: '$email' } },
    { $count: 'total' },
  ];
  const countResult = await db.collection('jg_login_logs').aggregate(countPipeline).toArray();
  const total = countResult[0]?.total ?? 0;

  return { members, total };
}

// ─── New Analytics Functions ─────────────────────────────────────────────────

// 每日登入趨勢（過去 N 天）
export async function getDailyLoginTrend(days: number): Promise<{ date: string; count: number }[]> {
  const db = await getJgtDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pipeline = [
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Taipei' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
  ];
  const results = await db.collection('jg_login_logs').aggregate(pipeline).toArray();
  return results.map(r => ({ date: r._id as string, count: r.count as number }));
}

// 頁面行為記錄（分頁 + 篩選）
export async function getActivityEvents(opts: {
  page: number; pageSize: number; type?: string; email?: string; days?: number;
}): Promise<{ events: any[]; total: number }> {
  const db = await getJgtDb();
  const { page, pageSize, type, email, days = 7 } = opts;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const filter: any = { createdAt: { $gte: since } };
  if (type && type !== 'all') filter.type = type;
  if (email) filter.email = new RegExp(email, 'i');
  const total = await db.collection('jg_activity_events').countDocuments(filter);
  const events = await db.collection('jg_activity_events')
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();
  return { events, total };
}

// Top Stocks V2（含 uniqueUsers）
export async function getTopStocksV2(opts: { days: number; limit: number }): Promise<{ symbol: string; viewCount: number; uniqueUsers: number }[]> {
  const db = await getJgtDb();
  const since = opts.days > 0 ? new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000) : new Date(0);
  const pipeline = [
    { $match: { type: 'stock_view', symbol: { $ne: null }, createdAt: { $gte: since } } },
    {
      $group: {
        _id: '$symbol',
        viewCount: { $sum: 1 },
        uniqueUsers: { $addToSet: '$email' },
      }
    },
    { $project: { symbol: '$_id', viewCount: 1, uniqueUsers: { $size: '$uniqueUsers' } } },
    { $sort: { viewCount: -1 } },
    { $limit: opts.limit },
  ];
  return db.collection('jg_activity_events').aggregate(pipeline).toArray() as any;
}

// 單一用戶行為追蹤
export async function getUserActivity(opts: { email: string; page: number; pageSize: number }) {
  const db = await getJgtDb();
  const { email, page, pageSize } = opts;
  const filter = { email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
  const [logins, totalEvents, events, topSymbols] = await Promise.all([
    db.collection('jg_login_logs').countDocuments(filter),
    db.collection('jg_activity_events').countDocuments(filter),
    db.collection('jg_activity_events').find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    db.collection('jg_activity_events').aggregate([
      { $match: { ...filter, type: 'stock_view', symbol: { $ne: null } } },
      { $group: { _id: '$symbol', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]).toArray(),
  ]);
  const firstLogin = await db.collection('jg_login_logs').findOne(filter, { sort: { createdAt: 1 } });
  const lastActivity = await db.collection('jg_activity_events').findOne(filter, { sort: { createdAt: -1 } });
  return {
    summary: {
      totalLogins: logins,
      firstSeen: firstLogin?.createdAt ?? null,
      lastSeen: lastActivity?.createdAt ?? null,
      totalEvents,
      topStocks: topSymbols.map((s: any) => s._id),
    },
    events,
    total: totalEvents,
  };
}

// Get top stock for each email
export async function getTopStockPerEmail(
  emails: string[]
): Promise<Record<string, string>> {
  if (emails.length === 0) return {};
  const db = await getJgtDb();
  const pipeline = [
    {
      $match: {
        email: { $in: emails },
        type: 'stock_view',
        symbol: { $ne: null },
      },
    },
    { $group: { _id: { email: '$email', symbol: '$symbol' }, count: { $sum: 1 } } },
    { $sort: { count: -1 as -1 } },
    {
      $group: {
        _id: '$_id.email',
        topSymbol: { $first: '$_id.symbol' },
      },
    },
  ];
  const results = await db
    .collection('jg_activity_events')
    .aggregate<{ _id: string; topSymbol: string }>(pipeline)
    .toArray();
  const map: Record<string, string> = {};
  for (const r of results) {
    map[r._id] = r.topSymbol;
  }
  return map;
}

// Active user counts
export async function getActiveUserCount(sinceMs: number): Promise<number> {
  const db = await getJgtDb();
  const since = new Date(Date.now() - sinceMs);
  const result = await db.collection('jg_activity_events').distinct('email', {
    createdAt: { $gte: since },
  });
  return result.length;
}

// New vs returning today
export async function getNewVsReturning(): Promise<{ newUsers: number; returningUsers: number }> {
  const db = await getJgtDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayLogins = await db
    .collection('jg_login_logs')
    .find({ createdAt: { $gte: todayStart } })
    .toArray();

  const todayEmails = [...new Set(todayLogins.map((l: any) => l.email as string))];

  let newUsers = 0;
  for (const email of todayEmails) {
    const prev = await db.collection('jg_login_logs').countDocuments({
      email,
      createdAt: { $lt: todayStart },
    });
    if (prev === 0) newUsers++;
  }

  return { newUsers, returningUsers: todayEmails.length - newUsers };
}
