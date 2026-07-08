export const revalidate = 3600; // ISR: 每小時重新生成一次，幾千人點同一支股票只打一次 FMP API

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { get13fDb, getJgtDb } from '@/lib/mongodb';
import { getCommentary } from '@/lib/db/commentary';
import { getStockNews, upsertStockNews } from '@/lib/db/stockNews';
import { getStockFilings, upsertStockFilings } from '@/lib/db/stockFilings';
import { getStockPressReleases, upsertStockPressReleases } from '@/lib/db/stockPressReleases';
import { fetchStockNews, fetchEarningsTranscript, fetchSecFilings, fetchPressReleases, EarningsTranscript } from '@/lib/fmp';
import Navbar from '@/components/Navbar';
import ActivityTracker from '@/components/ActivityTracker';
import type { JGStockNewsArticle, SecFiling, PressRelease } from '@/types/commentary';

interface StockPageProps {
  params: Promise<{ symbol: string }>;
}

// ─── Data helpers ────────────────────────────────────────────────────────────

async function getOrFetchTranscript(symbol: string): Promise<EarningsTranscript[]> {
  try {
    // 1. 先查 jgtruestock.jg_transcripts collection
    const db = await getJgtDb();
    const cached = await db.collection('jg_transcripts').findOne({ symbol });

    // 如果有快取且不超過 7 天，直接用
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (cached && new Date(cached.fetchedAt) > sevenDaysAgo) {
      return cached.transcripts as EarningsTranscript[];
    }

    // 2. 打 FMP API
    const transcripts = await fetchEarningsTranscript(symbol);

    // 3. 存進 DB（只在有結果時才寫入）
    if (transcripts.length > 0) {
      await db.collection('jg_transcripts').updateOne(
        { symbol },
        { $set: { symbol, transcripts, fetchedAt: new Date() } },
        { upsert: true }
      );
    }

    return transcripts;
  } catch (err) {
    console.error(`[getOrFetchTranscript] ${symbol} error:`, err);
    return [];
  }
}

async function getStockInfo(symbol: string) {
  try {
    const db = await get13fDb();
    const cache = await db
      .collection<{
        symbol: string;
        mentionDate: string;
        mentionClose: number;
        latestClose: number;
        performancePct: number;
        companyName?: string;
      }>('jg_picks_cache')
      .findOne({ symbol });

    if (cache) return cache;

    // Fallback to manual picks
    const manual = await db
      .collection<{
        symbol: string;
        mentionDate: string;
        mentionClose: number;
        latestClose: number;
        performancePct: number;
        companyName?: string;
      }>('jg_picks_manual')
      .findOne({ symbol });

    return manual;
  } catch {
    return null;
  }
}

async function getOrFetchNews(symbol: string): Promise<JGStockNewsArticle[]> {
  try {
    const cached = await getStockNews(symbol);
    if (cached?.articles?.length) return cached.articles;

    // Live fetch if no cache
    const raw = await fetchStockNews(symbol, 50);
    const articles: JGStockNewsArticle[] = raw.map((a) => ({
      title: a.title || '',
      url: a.url || '',
      source: a.site || '',
      publishedDate: a.publishedDate || '',
      snippet: (a.text || '').slice(0, 200),
      sentiment: null,
    }));

    if (articles.length) {
      await upsertStockNews(symbol, articles);
    }
    return articles;
  } catch {
    return [];
  }
}

async function getOrFetchFilings(symbol: string): Promise<SecFiling[]> {
  try {
    const cached = await getStockFilings(symbol);
    if (cached?.filings?.length) return cached.filings;

    const raw = await fetchSecFilings(symbol, '8-K', 20);
    const filings: SecFiling[] = raw.map((f) => ({
      symbol: f.symbol,
      fillingDate: f.fillingDate,
      acceptedDate: f.acceptedDate,
      type: f.type,
      link: f.link,
      finalLink: f.finalLink,
    }));

    if (filings.length) {
      await upsertStockFilings(symbol, filings);
    }
    return filings;
  } catch {
    return [];
  }
}

async function getOrFetchPressReleases(symbol: string): Promise<PressRelease[]> {
  try {
    const cached = await getStockPressReleases(symbol);
    if (cached?.releases?.length) return cached.releases;

    const raw = await fetchPressReleases(symbol, 20);
    const releases: PressRelease[] = raw.map((r) => ({
      symbol: r.symbol,
      date: r.date,
      title: r.title,
      text: r.text,
    }));

    if (releases.length) {
      await upsertStockPressReleases(symbol, releases);
    }
    return releases;
  } catch {
    return [];
  }
}

// ─── Components ──────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return String(dateStr).slice(0, 10);
}

function formatGainPct(pct: number): { label: string; color: string } {
  const pos = pct >= 0;
  return {
    label: `${pos ? '▲' : '▼'}${pos ? '+' : ''}${pct.toFixed(1)}%`,
    color: pos ? '#1A7340' : '#C0392B',
  };
}

function StockHeader({
  symbol,
  stockInfo,
}: {
  symbol: string;
  stockInfo: {
    mentionDate?: string;
    mentionClose?: number;
    latestClose?: number;
    performancePct?: number;
    companyName?: string;
  } | null;
}) {
  const gain = stockInfo?.performancePct != null
    ? formatGainPct(stockInfo.performancePct)
    : null;

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Back link */}
      <a
        href="/stocks"
        style={{
          fontSize: 12,
          color: '#888',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 12,
        }}
      >
        ← 返回頻道追蹤
      </a>

      {/* Symbol + company */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h1
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontSize: 26,
            fontWeight: 800,
            color: '#cc1a22',
            letterSpacing: '1px',
            margin: 0,
          }}
        >
          {symbol}
        </h1>
        {stockInfo?.companyName && (
          <span style={{ fontSize: 16, color: '#555' }}>{stockInfo.companyName}</span>
        )}
      </div>

      {/* Meta row */}
      {stockInfo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 6,
            fontSize: 13,
            color: '#888',
            flexWrap: 'wrap',
          }}
        >
          {stockInfo.mentionDate && (
            <>
              <span>提股日期 {formatDate(String(stockInfo.mentionDate))}</span>
              <span style={{ color: '#CCC' }}>·</span>
            </>
          )}
          {stockInfo.mentionClose != null && (
            <>
              <span>當時 ${stockInfo.mentionClose.toFixed(2)}</span>
              <span style={{ color: '#CCC' }}>·</span>
            </>
          )}
          {gain && (
            <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 700, fontSize: 13, color: gain.color }}>{gain.label}</span>
          )}
          {stockInfo?.latestClose != null && (
            <>
              <span style={{ color: '#CCC' }}>·</span>
              <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, color: '#c9a84c' }}>${stockInfo.latestClose.toFixed(2)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CommentarySection({
  title,
  body,
  publishedAt,
}: {
  title?: string | null;
  body?: string | null;
  publishedAt?: string | null;
}) {
  const hasContent = title && body;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e0dcd6',
        borderLeft: '3px solid #c9a84c',
        borderRadius: 2,
        padding: '20px 24px',
        marginBottom: 28,
      }}
    >
      <h2
        style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          color: '#c9a84c',
          letterSpacing: '3px',
          margin: '0 0 14px',
          textTransform: 'uppercase',
        }}
      >
        JG 點評
      </h2>

      {hasContent ? (
        <>
          <h3
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 20,
              fontWeight: 700,
              color: '#1A1A1A',
              margin: '0 0 12px',
              lineHeight: 1.4,
            }}
          >
            {title}
          </h3>
          <div
            style={{
              fontFamily: "'Noto Sans TC', sans-serif",
              fontSize: 15,
              lineHeight: 1.8,
              color: '#333',
            }}
          >
            {(() => {
              const shadowMarker = '【影子JG總結】';
              const idx = (body || '').indexOf(shadowMarker);
              if (idx === -1) {
                return <span style={{ whiteSpace: 'pre-wrap' }}>{body}</span>;
              }
              const before = body!.slice(0, idx);
              const after = body!.slice(idx + shadowMarker.length);
              return (
                <>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{before}</span>
                  {/* Brand-stamp header for 影子JG總結 */}
                  <div style={{ margin: '28px 0 16px' }}>
                    <div style={{ height: 1, background: 'linear-gradient(90deg, #c9a84c 0%, #e8c97a 40%, transparent 100%)', marginBottom: 16 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 4, height: 36, background: '#cc1a22', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '3px', color: '#c9a84c', textTransform: 'uppercase', marginBottom: 3 }}>Shadow JG &middot; Member Exclusive</div>
                        <div style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 20, fontWeight: 900, color: '#cc1a22', lineHeight: 1.2 }}>影子JG總結</div>
                      </div>
                    </div>
                    <div style={{ height: 1, background: 'linear-gradient(90deg, #c9a84c 0%, transparent 60%)', marginTop: 16 }} />
                  </div>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{after}</span>
                </>
              );
            })()}
          </div>
          {publishedAt && (
            <p
              style={{
                fontSize: 12,
                color: '#999',
                margin: '16px 0 0',
                textAlign: 'right',
              }}
            >
              最後更新：{formatDate(publishedAt)}
            </p>
          )}
        </>
      ) : (
        <p
          style={{
            fontFamily: "'Noto Sans TC', sans-serif",
            fontSize: 14,
            color: '#AAA',
            margin: 0,
          }}
        >
          JG 尚未發布此股的點評
        </p>
      )}
    </div>
  );
}

function NewsItem({ article }: { article: JGStockNewsArticle }) {
  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: '1px solid #EDEBE6',
      }}
    >
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          fontFamily: "'Noto Sans TC', sans-serif",
          fontSize: 14,
          color: '#1A1A1A',
          textDecoration: 'none',
          lineHeight: 1.5,
          marginBottom: 4,
        }}
        className="news-link"
      >
        📰 {article.title}
      </a>
      <div style={{ fontSize: 11, color: '#aaa' }}>
        {article.source && <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{article.source}</span>}
        {article.source && article.publishedDate && (
          <span style={{ margin: '0 6px', color: '#CCC' }}>·</span>
        )}
        {article.publishedDate && <span>{formatDate(article.publishedDate)}</span>}
      </div>
    </div>
  );
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #E0DCD6',
        borderRadius: 2,
        padding: '20px 24px',
        marginBottom: 16,
      }}
    >
      <h2
        style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          color: '#c9a84c',
          letterSpacing: '2px',
          margin: '0 0 14px',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function FilingItem({ filing }: { filing: SecFiling }) {
  const href = filing.finalLink || filing.link;
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #EDEBE6' }}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          fontFamily: "'Noto Sans TC', sans-serif",
          fontSize: 14,
          color: '#1A1A1A',
          textDecoration: 'none',
          lineHeight: 1.5,
          marginBottom: 4,
        }}
        className="news-link"
      >
        📑 {filing.type} 申報
      </a>
      <div style={{ fontSize: 12, color: '#888' }}>
        <span
          style={{
            display: 'inline-block',
            background: '#EEE',
            borderRadius: 3,
            padding: '1px 6px',
            marginRight: 6,
            fontSize: 11,
          }}
        >
          8-K 申報
        </span>
        <span>{String(filing.fillingDate).slice(0, 10)}</span>
      </div>
    </div>
  );
}

function PressReleaseItem({ release }: { release: PressRelease }) {
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #EDEBE6' }}>
      <div
        style={{
          fontFamily: "'Noto Sans TC', sans-serif",
          fontSize: 14,
          color: '#1A1A1A',
          lineHeight: 1.5,
          marginBottom: 4,
        }}
      >
        📢 {release.title}
      </div>
      <div style={{ fontSize: 12, color: '#888' }}>
        <span>{String(release.date).slice(0, 10)}</span>
      </div>
    </div>
  );
}

function NewsFeed({ articles }: { articles: JGStockNewsArticle[] }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #E0DCD6',
        borderRadius: 2,
        padding: '20px 24px',
        marginBottom: 16,
      }}
    >
      <h2
        style={{
          fontFamily: "'Raleway', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          color: '#c9a84c',
          letterSpacing: '2px',
          margin: '0 0 14px',
          textTransform: 'uppercase',
        }}
      >
        市場報導
      </h2>

      {articles.length === 0 ? (
        <p style={{ fontSize: 14, color: '#AAA', margin: 0 }}>目前無新聞資料</p>
      ) : (
        articles.slice(0, 30).map((article, i) => (
          <NewsItem key={i} article={article} />
        ))
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function StockDetailPage({ params }: StockPageProps) {
  // Auth temporarily disabled for preview — TODO: re-enable before production
  // const session = await getServerSession(authOptions);
  // if (!session) { redirect('/login'); }

  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  // Parallel fetch
  const [stockInfo, commentary, articles, filings, pressReleases] = await Promise.all([
    getStockInfo(upperSymbol),
    getCommentary(upperSymbol),
    getOrFetchNews(upperSymbol),
    getOrFetchFilings(upperSymbol),
    getOrFetchPressReleases(upperSymbol),
  ]);

  const isPublished =
    commentary?.status === 'published' && !!commentary?.publishedTitle;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f3f2' }}>
      <Navbar />
      <ActivityTracker page={`/stocks/${upperSymbol}`} symbol={upperSymbol} />

      <div
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: '28px 24px 48px',
        }}
      >
        <StockHeader symbol={upperSymbol} stockInfo={stockInfo} />

        <CommentarySection
          title={isPublished ? commentary?.publishedTitle : null}
          body={isPublished ? commentary?.publishedBody : null}
          publishedAt={
            isPublished ? commentary?.publishedAt?.toISOString() : null
          }
        />

        {/* 📑 重大申報（8-K） */}
        <SectionBox title="重大申報">
          {filings.length === 0 ? (
            <p style={{ fontSize: 14, color: '#AAA', margin: 0 }}>暫無近期重大申報</p>
          ) : (
            filings.slice(0, 20).map((f, i) => <FilingItem key={i} filing={f} />)
          )}
        </SectionBox>

        {/* 📢 官方公告（Press Release） */}
        <SectionBox title="官方公告">
          {pressReleases.length === 0 ? (
            <p style={{ fontSize: 14, color: '#AAA', margin: 0 }}>暫無近期官方公告</p>
          ) : (
            pressReleases.slice(0, 20).map((r, i) => <PressReleaseItem key={i} release={r} />)
          )}
        </SectionBox>

        {/* 📰 市場報導（Wire News） */}
        <NewsFeed articles={articles} />
      </div>

      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <style>{`
        .news-link:hover {
          color: #cc1a22 !important;
        }
        @media (max-width: 768px) {
          .stock-detail-title { font-size: 22px !important; }
          .stock-detail-body { font-size: 14px !important; }
          .stock-detail-news-title { font-size: 13px !important; }
          .stock-detail-wrap { padding: 16px 16px 48px !important; }
        }
      `}</style>
    </div>
  );
}
