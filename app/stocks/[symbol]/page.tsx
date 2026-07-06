import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { get13fDb } from '@/lib/mongodb';
import { getCommentary } from '@/lib/db/commentary';
import { getStockNews, upsertStockNews } from '@/lib/db/stockNews';
import { fetchStockNews } from '@/lib/fmp';
import Navbar from '@/components/Navbar';
import type { JGStockNewsArticle } from '@/types/commentary';

interface StockPageProps {
  params: Promise<{ symbol: string }>;
}

// ─── Data helpers ────────────────────────────────────────────────────────────

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
        ← 返回提股記錄
      </a>

      {/* Symbol + company */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h1
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 26,
            fontWeight: 700,
            color: '#D93025',
            letterSpacing: 0.5,
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
            <span style={{ fontWeight: 600, color: gain.color }}>{gain.label}</span>
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
        background: '#FAFAF8',
        border: '1px solid #E0DCD6',
        borderLeft: '3px solid #c9a84c',
        borderRadius: 2,
        padding: '20px 24px',
        marginBottom: 28,
      }}
    >
      <h2
        style={{
          fontFamily: "'Noto Serif TC', serif",
          fontSize: 15,
          fontWeight: 600,
          color: '#999',
          letterSpacing: 1,
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
              whiteSpace: 'pre-wrap',
            }}
          >
            {body}
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
      <div style={{ fontSize: 12, color: '#888' }}>
        {article.source && <span>{article.source}</span>}
        {article.source && article.publishedDate && (
          <span style={{ margin: '0 6px', color: '#CCC' }}>·</span>
        )}
        {article.publishedDate && <span>{formatDate(article.publishedDate)}</span>}
      </div>
    </div>
  );
}

function NewsFeed({ articles }: { articles: JGStockNewsArticle[] }) {
  return (
    <div
      style={{
        background: '#FAFAF8',
        border: '1px solid #E0DCD6',
        borderRadius: 2,
        padding: '20px 24px',
      }}
    >
      <h2
        style={{
          fontFamily: "'Noto Serif TC', serif",
          fontSize: 15,
          fontWeight: 600,
          color: '#999',
          letterSpacing: 1,
          margin: '0 0 14px',
          textTransform: 'uppercase',
        }}
      >
        近 30 天新聞
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
  const [stockInfo, commentary, articles] = await Promise.all([
    getStockInfo(upperSymbol),
    getCommentary(upperSymbol),
    getOrFetchNews(upperSymbol),
  ]);

  const isPublished =
    commentary?.status === 'published' && !!commentary?.publishedTitle;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <Navbar />

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

        <NewsFeed articles={articles} />
      </div>

      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <style>{`
        .news-link:hover {
          color: #D93025 !important;
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
