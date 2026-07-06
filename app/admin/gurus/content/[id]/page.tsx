'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface ContentDetail {
  _id: string;
  title: string;
  channelName: string;
  platform: string;
  publishedAt: string;
  url: string | null;
  summary: string | null;
  rawContent: string | null;
  mentionedTickers: string[];
  status: string | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube: '🎬 YouTube',
  x: '🐦 X',
  podcast: '🎙️ Podcast',
  substack: '📰 Substack',
};

export default function GuruContentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawExpanded, setRawExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/gurus/content/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function getRawDisplay(platform: string, rawContent: string | null) {
    if (!rawContent) return { text: '（無原文資料）', isPlaceholder: true };
    if (platform === 'youtube' && rawContent.includes('Could not retrieve')) {
      return { text: '逐字稿生成中，請稍後查看', isPlaceholder: true };
    }
    return { text: rawContent, isPlaceholder: false };
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e8e8e8' }}>
      <Navbar />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        {/* Back */}
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/admin/gurus"
            style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}
          >
            ← 返回大神追蹤
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#666', padding: 60 }}>載入中...</div>
        ) : !data || (data as any).error ? (
          <div style={{ textAlign: 'center', color: '#666', padding: 60 }}>找不到內容</div>
        ) : (
          <>
            {/* Header info */}
            <div
              style={{
                background: '#151515',
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 20,
              }}
            >
              {/* Platform badge + date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: '#1a2a3a',
                    color: '#6aaddf',
                  }}
                >
                  {PLATFORM_LABELS[data.platform] ?? data.platform}
                </span>
                <span style={{ color: '#888', fontSize: 13 }}>{data.channelName}</span>
                <span style={{ color: '#555', fontSize: 12, marginLeft: 'auto' }}>
                  {formatDate(data.publishedAt)}
                </span>
              </div>

              {/* Title */}
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#e8e8e8',
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                {data.title}
              </h1>

              {/* Tickers */}
              {data.mentionedTickers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {data.mentionedTickers.map((t) => (
                    <span
                      key={t}
                      style={{
                        background: '#1a2a1a',
                        color: '#4caf50',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 12,
                        fontFamily: 'monospace',
                      }}
                    >
                      ${t}
                    </span>
                  ))}
                </div>
              )}

              {/* Original link */}
              {data.url && (
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: '#6aaddf', textDecoration: 'none' }}
                >
                  🔗 原始連結 ↗
                </a>
              )}
            </div>

            {/* AI 中文摘要 */}
            <section
              style={{
                background: '#151515',
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#aaa', marginBottom: 12 }}>
                🤖 AI 中文摘要
              </h2>
              {data.summary ? (
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.85,
                    color: '#ccc',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {data.summary}
                </div>
              ) : (
                <div style={{ color: '#555', fontSize: 13 }}>（尚無摘要）</div>
              )}
            </section>

            {/* 完整原文 */}
            <section
              style={{
                background: '#151515',
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                padding: '20px 24px',
              }}
            >
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#aaa', marginBottom: 12 }}>
                📄 完整原文
              </h2>
              {(() => {
                const { text, isPlaceholder } = getRawDisplay(data.platform, data.rawContent);
                if (isPlaceholder) {
                  return <div style={{ color: '#555', fontSize: 13 }}>{text}</div>;
                }
                return (
                  <>
                    <button
                      onClick={() => setRawExpanded((v) => !v)}
                      style={{
                        background: rawExpanded ? '#1a2a3a' : 'transparent',
                        border: '1px solid #2a4a6a',
                        borderRadius: 6,
                        color: '#6aaddf',
                        padding: '5px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        marginBottom: rawExpanded ? 14 : 0,
                      }}
                    >
                      {rawExpanded ? '▲ 收起原文' : '▼ 展開原文'}
                    </button>
                    {rawExpanded && (
                      <div
                        style={{
                          background: '#0d1a24',
                          border: '1px solid #1e3a50',
                          borderRadius: 8,
                          padding: '14px 16px',
                          color: '#b0c8d8',
                          fontSize: 12,
                          lineHeight: 1.75,
                          whiteSpace: 'pre-wrap',
                          maxHeight: 600,
                          overflowY: 'auto',
                          fontFamily: 'ui-monospace, monospace',
                        }}
                      >
                        {text}
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
