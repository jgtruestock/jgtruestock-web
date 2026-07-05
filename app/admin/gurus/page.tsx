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
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.youtube;

  return (
    <div
      style={{
        background: '#151515',
        border: '1px solid #2a2a2a',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 12,
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
      onClick={() => setExpanded((e) => !e)}
    >
      {/* Header row */}
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
            <span style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
              {item.sourceName}
            </span>
            <span style={{ color: '#555', fontSize: 11, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {formatDate(item.publishedAt)}
            </span>
          </div>

          {/* Title */}
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8', lineHeight: 1.4 }}>
            {item.title}
          </div>

          {/* Tickers */}
          {item.mentionedTickers && item.mentionedTickers.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {item.mentionedTickers.slice(0, 6).map((t) => (
                <span
                  key={t}
                  style={{
                    background: '#1a2a1a',
                    color: '#4caf50',
                    borderRadius: 4,
                    padding: '1px 6px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                  }}
                >
                  ${t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expanded summary */}
      {expanded && item.summary && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid #2a2a2a',
            color: '#ccc',
            fontSize: 13,
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
          }}
        >
          {item.summary}
        </div>
      )}

      {expanded && !item.summary && (
        <div style={{ marginTop: 12, color: '#666', fontSize: 13 }}>
          （無摘要）
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
      const r = await fetch('/api/cron/update-gurus', {
        method: 'GET',
      });
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
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e8e8e8' }}>
      <Navbar />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🧠 大神追蹤 · 統一時間軸</h1>
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
              background: fetchResult.error ? '#2a1010' : '#0d2010',
              border: `1px solid ${fetchResult.error ? '#ff4444' : '#1a7340'}`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 12,
              color: fetchResult.error ? '#ff8888' : '#6fcf97',
            }}
          >
            {fetchResult.error
              ? `❌ ${fetchResult.error}`
              : `✅ YouTube: +${fetchResult.youtube?.processed ?? 0} | Podcast: +${fetchResult.podcast?.processed ?? 0} | X: +${fetchResult.x?.processed ?? 0}`}
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? '#1A7340' : '#1a1a1a',
                color: filter === f.key ? '#fff' : '#aaa',
                border: `1px solid ${filter === f.key ? '#1A7340' : '#333'}`,
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
          <div style={{ color: '#666', textAlign: 'center', padding: 60 }}>載入中...</div>
        ) : items.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 60 }}>
            暫無資料。點擊「立刻更新全部」抓取最新內容。
          </div>
        ) : (
          <>
            <div style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
              共 {items.length} 則 · 點擊卡片展開摘要
            </div>
            {items.map((item) => (
              <TimelineCard key={item._id} item={item} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
