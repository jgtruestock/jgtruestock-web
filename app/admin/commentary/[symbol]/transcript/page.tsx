'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface TranscriptEntry {
  youtube_id: string;
  channel: string;
  publish_date: string | null;
  fullTranscript: string | null;
}

interface PageData {
  symbol: string;
  title: string;
  summary: string | null;
  transcripts: TranscriptEntry[];
}

export default function TranscriptPage() {
  const params = useParams();
  const symbol = (params?.symbol as string)?.toUpperCase() ?? '';

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!symbol) return;
    fetch(`/api/admin/commentary/${symbol}/transcript`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [symbol]);

  function toggleExpand(i: number) {
    setExpandedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EE' }}>
      <Navbar />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
        {/* Back */}
        <div style={{ marginBottom: 16 }}>
          <Link
            href={`/admin/commentary/${symbol}`}
            style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}
          >
            ← 返回 {symbol} 點評
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: 60 }}>載入中...</div>
        ) : !data ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: 60 }}>錯誤：無法載入資料</div>
        ) : (
          <>
            {/* Title */}
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', marginBottom: 6 }}>
              {symbol} — 完整逐字稿
            </h1>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 28 }}>{data.title}</p>

            {/* Chinese summary */}
            <section
              style={{
                background: '#FFF',
                border: '1px solid #E8E4DC',
                borderRadius: 10,
                padding: '24px',
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 14 }}>
                📝 中文摘要
              </h2>
              {data.summary ? (
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.85,
                    color: '#333',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {data.summary}
                </div>
              ) : (
                <div style={{ color: '#aaa', fontSize: 13 }}>尚無中文摘要。請先在點評頁面生成草稿。</div>
              )}
            </section>

            {/* English transcripts */}
            {data.transcripts.length === 0 ? (
              <section
                style={{
                  background: '#FFF',
                  border: '1px solid #E8E4DC',
                  borderRadius: 10,
                  padding: '24px',
                }}
              >
                <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>
                  📄 英文原始逐字稿
                </h2>
                <div style={{ color: '#aaa', fontSize: 13 }}>尚無逐字稿資料。</div>
              </section>
            ) : (
              data.transcripts.map((t, i) => (
                <section
                  key={i}
                  style={{
                    background: '#FFF',
                    border: '1px solid #E8E4DC',
                    borderRadius: 10,
                    padding: '24px',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
                        📄 英文原始逐字稿
                        {data.transcripts.length > 1 && ` #${i + 1}`}
                      </h2>
                      {t.channel && (
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 0 }}>
                          {t.channel}
                          {t.publish_date && ` · ${t.publish_date.slice(0, 10)}`}
                        </span>
                      )}
                    </div>
                    {t.youtube_id && (
                      <a
                        href={`https://www.youtube.com/watch?v=${t.youtube_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}
                      >
                        ↗ YouTube
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => toggleExpand(i)}
                    style={{
                      background: expandedIndexes.has(i) ? '#F0EDE8' : 'transparent',
                      border: '1px solid #D5D0C5',
                      borderRadius: 6,
                      padding: '6px 14px',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#555',
                      marginBottom: expandedIndexes.has(i) ? 14 : 0,
                    }}
                  >
                    {expandedIndexes.has(i) ? '▲ 收起英文原始逐字稿' : '▼ 展開英文原始逐字稿'}
                  </button>

                  {expandedIndexes.has(i) && (
                    <div
                      style={{
                        background: '#FAFAF8',
                        border: '1px solid #E8E4DC',
                        borderRadius: 8,
                        padding: '14px 16px',
                        fontSize: 13,
                        lineHeight: 1.75,
                        color: '#444',
                        whiteSpace: 'pre-wrap',
                        maxHeight: 500,
                        overflowY: 'auto',
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {t.fullTranscript || '（逐字稿內容為空）'}
                    </div>
                  )}
                </section>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
