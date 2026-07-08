'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';

type ContentType = 'all' | 'youtube' | 'podcast' | 'x' | 'earnings';

interface TimelineItem {
  _id: string;
  type: ContentType;
  sourceType: string;
  sourceName: string;
  title: string;
  publishedAt: string;
  summary?: string;
  thumbnailUrl?: string;
  mentionedTickers?: string[];
  externalUrl?: string;
}

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  youtube:  { icon: '🎬', label: 'YouTube',  color: '#FF4444' },
  podcast:  { icon: '🎙️', label: 'Podcast',  color: '#9B59B6' },
  x:        { icon: '🐦', label: 'X',        color: '#1DA1F2' },
  earnings: { icon: '📊', label: '法說會',   color: '#F0A500' },
};

const FILTERS: { key: ContentType; label: string }[] = [
  { key: 'all',      label: '全部' },
  { key: 'youtube',  label: '🎬 YouTube' },
  { key: 'podcast',  label: '🎙️ Podcast' },
  { key: 'x',        label: '🐦 X' },
  { key: 'earnings', label: '📊 法說會' },
];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function TimelineCard({ item }: { item: TimelineItem }) {
  const [expanded, setExpanded] = useState(false);
  const [rawExpanded, setRawExpanded] = useState(false);
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [rawLoading, setRawLoading] = useState(false);
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.youtube;

  async function handleExpandRaw(e: React.MouseEvent) {
    e.stopPropagation();
    if (rawContent !== null) {
      setRawExpanded((v) => !v);
      return;
    }
    setRawLoading(true);
    try {
      const res = await fetch(`/api/admin/gurus/content/${item._id}`);
      const data = await res.json();
      setRawContent(data.rawContent ?? '（無原文）');
      setRawExpanded(true);
    } catch {
      setRawContent('（載入失敗）');
      setRawExpanded(true);
    } finally {
      setRawLoading(false);
    }
  }

  return (
    <div
      style={{
        background: '#FFF',
        border: '1px solid #E8E4DC',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 12,
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header row — click toggles summary */}
      <div
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {item.thumbnailUrl && (
            <img
              src={item.thumbnailUrl}
              alt=""
              style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Source badge + date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  background: cfg.color + '22',
                  color: cfg.color,
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {cfg.icon} {cfg.label}
              </span>
              <span style={{ color: '#666', fontSize: 12, whiteSpace: 'nowrap' }}>
                {item.sourceName}
              </span>
              <span style={{ color: '#999', fontSize: 11, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {formatDate(item.publishedAt)}
              </span>
            </div>

            {/* Title */}
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.4 }}>
              {item.title}
            </div>

            {/* Tickers */}
            {item.mentionedTickers && item.mentionedTickers.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {item.mentionedTickers.slice(0, 6).map((t) => (
                  <span
                    key={t}
                    style={{
                      background: '#F0FAF0',
                      color: '#1A7340',
                      borderRadius: 4,
                      padding: '1px 6px',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      border: '1px solid #C6E8D0',
                    }}
                  >
                    ${t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            background: '#F5F3EE',
            border: '1px solid #E0DCD6',
            borderRadius: 6,
            color: '#555',
            padding: '3px 10px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {expanded ? '▲ 收起摘要' : '▼ 展開摘要'}
        </button>

        {item.type !== 'earnings' && (
          <button
            onClick={handleExpandRaw}
            disabled={rawLoading}
            style={{
              background: rawExpanded ? '#EDF4FB' : '#F5F3EE',
              border: '1px solid #B8D8F0',
              borderRadius: 6,
              color: rawLoading ? '#aaa' : '#2980B9',
              padding: '3px 10px',
              fontSize: 12,
              cursor: rawLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {rawLoading ? '⏳ 載入中...' : rawExpanded ? '▲ 收起原文' : '📄 展開原文'}
          </button>
        )}

        {item.externalUrl && (
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#F5F3EE',
              border: '1px solid #E0DCD6',
              borderRadius: 6,
              color: '#666',
              padding: '3px 10px',
              fontSize: 12,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            🔗 原始連結
          </a>
        )}

        <a
          href={`/admin/gurus/content/${item._id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#F0FAF0',
            border: '1px solid #C6E8D0',
            borderRadius: 6,
            color: '#1A7340',
            padding: '3px 10px',
            fontSize: 12,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          📄 查看完整內容
        </a>
      </div>

      {/* Expanded summary */}
      {expanded && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid #E8E4DC',
            color: '#333',
            fontSize: 13,
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
          }}
        >
          {item.summary || '（無摘要）'}
        </div>
      )}

      {/* Expanded raw content */}
      {rawExpanded && rawContent !== null && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid #D0E8F5',
          }}
        >
          <div style={{ color: '#2980B9', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>
            📄 完整原文
          </div>
          <div
            style={{
              background: '#F8FAFB',
              border: '1px solid #D0E8F5',
              borderRadius: 8,
              padding: '12px 14px',
              color: '#333',
              fontSize: 12,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              maxHeight: 400,
              overflowY: 'auto',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {rawContent}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GurusPage() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContentType>('all');
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState('');

  const loadTimeline = (f: ContentType) => {
    setLoading(true);
    fetch(`/api/admin/gurus/timeline?type=${f}&limit=80`)
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTimeline(filter);
  }, [filter]);

  async function handleFetchAll() {
    setFetching(true);
    setFetchResult(null);
    try {
      const r = await fetch('/api/cron/update-gurus');
      const result = await r.json();
      setFetchResult(result);
      loadTimeline(filter);
    } catch (e) {
      setFetchResult({ error: String(e) });
    } finally {
      setFetching(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EE', color: '#1A1A1A' }}>
      <Navbar />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href="/admin/gurus/channels"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#FFF',
              textDecoration: 'none',
              background: '#1A1A1A',
              border: 'none',
              borderRadius: 7,
              padding: '7px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ⚙️ 頻道管理（新增 / 刪除大神）
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1A1A1A' }}>
            🧠 大神追蹤 · 統一時間軸
            {items.length > 0 && (
              <span style={{ fontSize: 12, color: '#999', fontWeight: 400, marginLeft: 12 }}>
                上次更新：{items[0].publishedAt.slice(0, 10)}
              </span>
            )}
          </h1>
          <button
            onClick={handleFetchAll}
            disabled={fetching}
            style={{
              background: fetching ? '#444' : '#1A7340',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '9px 18px',
              cursor: fetching ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {fetching ? '⏳ 抓取中...' : '🔄 立刻更新全部'}
          </button>
        </div>

        {/* Fetch result notice */}
        {fetchResult && (
          <div
            style={{
              background: fetchResult.error ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${fetchResult.error ? '#FECACA' : '#BBF7D0'}`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 12,
              color: fetchResult.error ? '#C0392B' : '#1A7340',
            }}
          >
            {fetchResult.error
              ? `❌ ${fetchResult.error}`
              : `✅ YouTube: +${fetchResult.youtube?.processed ?? 0} | Podcast: +${fetchResult.podcast?.processed ?? 0} | X: +${fetchResult.x?.processed ?? 0} | 封存: ${fetchResult.archived ?? 0}`}
          </div>
        )}

        {/* Date filter */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, color: '#666' }}>📅 日期篩選（顯示此日期之後）：</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              background: '#FFF',
              border: '1px solid #D5D0C8',
              borderRadius: 6,
              color: '#1A1A1A',
              padding: '5px 10px',
              fontSize: 13,
            }}
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              style={{
                background: '#FFF',
                border: '1px solid #D5D0C8',
                borderRadius: 6,
                color: '#666',
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              清除
            </button>
          )}
        </div>

        {/* 功能說明：展開原文 / expand full content */}
        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          💡 點擊卡片可展開摘要，點擊「展開原文」可查看完整內容
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? '#1A1A1A' : '#E8E4DC',
                color: filter === f.key ? '#fff' : '#555',
                border: `1px solid ${filter === f.key ? '#1A1A1A' : '#D5D0C8'}`,
                borderRadius: 20,
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: filter === f.key ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {loading ? (
          <div style={{ color: '#999', textAlign: 'center', padding: 60 }}>載入中...</div>
        ) : items.length === 0 ? (
          <div style={{ color: '#888', textAlign: 'center', padding: 60 }}>
            暫無資料。點擊「立刻更新全部」抓取最新內容。
          </div>
        ) : (() => {
          const filtered = dateFilter
            ? items.filter((item) => new Date(item.publishedAt) >= new Date(dateFilter))
            : items;
          return (
            <>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
                共 {filtered.length} 則
                {dateFilter && ` (${dateFilter} 之後)`}
                · 點擊「展開摘要」查看 AI 摘要，「展開原文」查看完整原文
              </div>
              {filtered.map((item) => (
                <TimelineCard key={item._id} item={item} />
              ))}
            </>
          );
        })()}
      </main>
    </div>
  );
}
