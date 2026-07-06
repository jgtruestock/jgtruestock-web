'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface GuruContent {
  _id: string;
  videoId: string;
  title: string;
  publishedAt: string;
  channelName: string;
  summary?: string;
  mentionedTickers?: string[];
  transcriptSource?: string;
  thumbnailUrl?: string;
}

export default function ChannelContentPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const [content, setContent] = useState<GuruContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!channelId) return;
    fetch(`/api/admin/gurus/${channelId}/content`)
      .then((r) => r.json())
      .then((d) => setContent(d.content || []))
      .finally(() => setLoading(false));
  }, [channelId]);

  const channelName = content[0]?.channelName || channelId;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e8e8e8' }}>
      <Navbar />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ marginBottom: 28 }}>
          <Link
            href="/admin/gurus"
            style={{ color: '#666', fontSize: 14, textDecoration: 'none' }}
          >
            ← 返回大神列表
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>
            {channelName}
          </h1>
        </div>

        {loading ? (
          <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>載入中...</div>
        ) : content.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>
            尚無資料。請先點「立刻抓取」。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {content.map((item) => (
              <ContentCard key={item._id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ContentCard({ item }: { item: GuruContent }) {
  const date = new Date(item.publishedAt).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div
      style={{
        background: '#161616',
        border: '1px solid #2a2a2a',
        borderRadius: 10,
        padding: '18px 20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{item.title}</div>
          <div style={{ fontSize: 12, color: '#555' }}>
            {date}
            {item.transcriptSource && (
              <span style={{ marginLeft: 8, color: '#444' }}>
                · 逐字稿：{item.transcriptSource === 'youtube-api' ? 'YouTube CC' : 'Whisper'}
              </span>
            )}
          </div>
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${item.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 6,
            color: '#888',
            padding: '6px 12px',
            fontSize: 12,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          查看原文 ↗
        </a>
      </div>

      {item.summary ? (
        <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.7, marginBottom: 10 }}>
          {item.summary}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#444', fontStyle: 'italic', marginBottom: 10 }}>
          尚無 AI 摘要
        </div>
      )}

      {item.mentionedTickers && item.mentionedTickers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {item.mentionedTickers.map((ticker) => (
            <span
              key={ticker}
              style={{
                background: '#0d2a17',
                border: '1px solid #1A7340',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 12,
                color: '#4ade80',
                fontFamily: 'monospace',
              }}
            >
              {ticker}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
