'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import type { KeyPoint, PromiseCategory, PromiseStatus } from '@/types/commentary';

interface PublishHistoryEntry {
  publishedTitle: string | null;
  publishedBody: string | null;
  publishedAt: string;
}

interface CommentaryDetail {
  symbol: string;
  exists: boolean;
  status: 'draft' | 'published' | 'stale' | null;
  draftTitle: string | null;
  draftBody: string | null;
  draftGeneratedAt: string | null;
  draftModel: string | null;
  publishedTitle: string | null;
  publishedBody: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  keyPoints?: KeyPoint[];
  publishHistory?: PublishHistoryEntry[];
}

const CATEGORY_LABELS: Record<PromiseCategory, string> = {
  revenue: '📊 revenue',
  margin: '📈 margin',
  capex: '🏭 capex',
  product: '📱 product',
  headcount: '👥 headcount',
  guidance: '🔭 guidance',
  market_expansion: '🌍 market',
};

const STATUS_ICONS: Record<PromiseStatus, string> = {
  fulfilled: '✅',
  partially: '⚠️',
  broken: '❌',
  pending: '⏳',
  unclear: '❓',
};

const STATUS_LABEL: Record<PromiseStatus, string> = {
  fulfilled: '已達成',
  partially: '部分達成',
  broken: '未達成',
  pending: '待確認',
  unclear: '資訊不足',
};

const STATUS_LABELS: Record<string, string> = {
  published: '已發布',
  draft: '草稿',
  stale: '待更新',
};

const STATUS_COLORS: Record<string, string> = {
  published: '#1A7340',
  draft: '#c9a84c',
  stale: '#E67E22',
};

export default function AdminCommentarySymbolPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const symbol = (params?.symbol as string)?.toUpperCase() ?? '';

  const [data, setData] = useState<CommentaryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  const discordId = (session?.user as any)?.discordId;
  const email = (session?.user as any)?.email?.toLowerCase();
  const adminId = process.env.NEXT_PUBLIC_ADMIN_DISCORD_ID;
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'jgdady@gmail.com').toLowerCase();
  const userIsAdmin = discordId === adminId || email === adminEmail;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    try {
      const res = await fetch(`/api/admin/commentary/${symbol}`);
      if (!res.ok) {
        if (res.status === 403) { router.push('/'); return; }
        throw new Error('failed');
      }
      const d: CommentaryDetail = await res.json();
      setData(d);
      setEditTitle(d.draftTitle ?? '');
      setEditBody(d.draftBody ?? '');
    } catch (err) {
      console.error('fetch commentary detail:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, fetchData]);

  const handleSave = async () => {
    if (!editTitle && !editBody) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/commentary/${symbol}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      const d = await res.json();
      if (res.ok) {
        setMessage('✅ 草稿已儲存');
        await fetchData();
      } else {
        setMessage(`❌ 儲存失敗：${d.error}`);
      }
    } catch (err: any) {
      setMessage(`❌ 錯誤：${err?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm(`確定要發布 ${symbol} 的點評嗎？`)) return;
    setPublishing(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/commentary/${symbol}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      const d = await res.json();
      if (res.ok) {
        setMessage(`✅ 已發布！時間：${d.publishedAt?.slice(0, 10)}`);
        await fetchData();
      } else {
        setMessage(`❌ 發布失敗：${d.error}`);
      }
    } catch (err: any) {
      setMessage(`❌ 錯誤：${err?.message}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm(`確定要重新生成 ${symbol} 的 AI 草稿嗎？現有草稿將被覆蓋。`)) return;
    setGenerating(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/commentary/${symbol}/regenerate`, { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        setMessage(`✅ AI 草稿已重新生成：${d.commentary?.draftTitle ?? ''}`);
        await fetchData();
      } else {
        setMessage(`❌ 生成失敗：${d.error}`);
      }
    } catch (err: any) {
      setMessage(`❌ 錯誤：${err?.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const wordCount = editBody.replace(/\s/g, '').length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F3EE' }}>
        <Navbar />
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>載入中...</div>
      </div>
    );
  }

  if (!userIsAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F3EE' }}>
        <Navbar />
        <div style={{ padding: 40, textAlign: 'center', color: '#c00' }}>無管理員權限</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EE' }}>
      <Navbar />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/admin/commentary')}
            style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #D5D0C5',
              background: '#fff', color: '#666', cursor: 'pointer', fontSize: 13,
            }}
          >
            ← 返回列表
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
            {symbol}
          </h1>
          {data?.status && (
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                background: STATUS_COLORS[data.status] + '22',
                color: STATUS_COLORS[data.status],
                border: `1px solid ${STATUS_COLORS[data.status]}55`,
              }}
            >
              {STATUS_LABELS[data.status]}
            </span>
          )}
        </div>

        {/* Message */}
        {message && (
          <div
            style={{
              background: message.startsWith('✅') ? '#f0fff4' : '#fff5f5',
              border: `1px solid ${message.startsWith('✅') ? '#c6f6d5' : '#fed7d7'}`,
              borderRadius: 6,
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 14,
              color: message.startsWith('✅') ? '#276749' : '#c53030',
            }}
          >
            {message}
          </div>
        )}

        {/* Draft Editor */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #E8E4DC',
            padding: '24px',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
              AI 草稿
              {data?.draftGeneratedAt && (
                <span style={{ fontSize: 12, fontWeight: 400, color: '#999', marginLeft: 8 }}>
                  {data.draftGeneratedAt.replace('T', ' ').slice(0, 16)} 生成
                  {data.draftModel ? ` · ${data.draftModel}` : ''}
                </span>
              )}
            </h2>
          </div>

          {/* Title input */}
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
            標題
          </label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="點評標題（15 字以內）"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: '1px solid #D5D0C5',
              fontSize: 15,
              fontWeight: 600,
              marginBottom: 16,
              boxSizing: 'border-box',
              color: '#1A1A1A',
            }}
          />

          {/* Body textarea */}
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
            內容（支援 Markdown）
          </label>
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={12}
            placeholder="點評內容..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: '1px solid #D5D0C5',
              fontSize: 14,
              lineHeight: 1.7,
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              color: '#1A1A1A',
            }}
          />
          <div style={{ textAlign: 'right', fontSize: 12, color: wordCount >= 200 && wordCount <= 400 ? '#1A7340' : '#E67E22', marginTop: 4 }}>
            字數：{wordCount} / 建議 200-400
          </div>
        </div>

        {/* Transcript link */}
        <div style={{ marginBottom: 16 }}>
          <a
            href={`/admin/commentary/${symbol}/transcript`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              fontSize: 13,
              color: '#555',
              textDecoration: 'none',
              border: '1px solid #D5D0C5',
              borderRadius: 6,
              padding: '6px 14px',
              background: '#FFF',
            }}
          >
            📄 查看完整逃字稿 ↗
          </a>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
          <button
            onClick={handleRegenerate}
            disabled={generating}
            style={{
              padding: '10px 18px',
              borderRadius: 7,
              border: '1px solid #D5D0C5',
              background: '#fff',
              color: '#555',
              cursor: generating ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {generating ? '生成中...' : '🔄 重新生成'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 18px',
              borderRadius: 7,
              border: '1px solid #c9a84c',
              background: '#fffbf0',
              color: '#a07830',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {saving ? '儲存中...' : '💾 儲存草稿'}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || (!editTitle && !editBody)}
            style={{
              padding: '10px 20px',
              borderRadius: 7,
              border: 'none',
              background: (!editTitle && !editBody) ? '#ccc' : '#1A1A1A',
              color: '#fff',
              cursor: publishing || (!editTitle && !editBody) ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {publishing ? '發布中...' : '📢 發布'}
          </button>
        </div>

        {/* Currently published */}
        {data?.publishedTitle && (
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #E8E4DC',
              padding: '24px',
              marginBottom: 20,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A7340', marginBottom: 12 }}>
              目前已發布版本
              {data.publishedAt && (
                <span style={{ fontSize: 12, fontWeight: 400, color: '#999', marginLeft: 8 }}>
                  {data.publishedAt.slice(0, 10)}
                </span>
              )}
            </h3>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A', marginBottom: 8 }}>
              {data.publishedTitle}
            </p>
            <p
              style={{
                fontSize: 14,
                color: '#444',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {data.publishedBody}
            </p>
          </div>
        )}

        {/* Publish History */}
        {data?.publishHistory && data.publishHistory.length > 0 && (
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #E8E4DC',
              padding: '24px',
              marginBottom: 20,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 12 }}>
              發布紀錄
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.publishHistory.map((h, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'baseline',
                    padding: '8px 0',
                    borderBottom: i < data.publishHistory!.length - 1 ? '1px solid #F0EDE6' : 'none',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#999', flexShrink: 0 }}>
                    {h.publishedAt.slice(0, 10)}
                  </span>
                  <span style={{ fontSize: 14, color: '#444' }}>
                    {h.publishedTitle ?? '（無標題）'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Points Tracker */}
        {data?.keyPoints && data.keyPoints.length > 0 && (
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #E8E4DC',
              padding: '24px',
              marginBottom: 20,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 16 }}>
              【要點追蹤】
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {data.keyPoints.map((kp, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: `3px solid ${
                      kp.status === 'fulfilled' ? '#1A7340'
                      : kp.status === 'partially' ? '#c9a84c'
                      : kp.status === 'broken' ? '#c53030'
                      : kp.status === 'pending' ? '#555'
                      : '#999'
                    }`,
                    paddingLeft: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#888',
                        background: '#F5F3EE',
                        borderRadius: 4,
                        padding: '2px 6px',
                        flexShrink: 0,
                      }}
                    >
                      {CATEGORY_LABELS[kp.category] ?? kp.category}
                    </span>
                    {kp.targetQuarter && (
                      <span style={{ fontSize: 12, color: '#aaa' }}>{kp.targetQuarter}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: '4px 0 2px' }}>
                    {kp.summary}
                  </p>
                  {kp.originalText && (
                    <p style={{ fontSize: 12, color: '#888', fontStyle: 'italic', margin: '0 0 6px' }}>
                      "{kp.originalText}"
                    </p>
                  )}
                  <p style={{ fontSize: 13, color: '#444', margin: '0 0 2px' }}>
                    {STATUS_ICONS[kp.status]} <strong>{STATUS_LABEL[kp.status]}</strong>：{kp.statusNote}
                  </p>
                  {kp.newsEvidence && kp.newsEvidence !== '—' && (
                    <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
                      依据：{kp.newsEvidence}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No data state */}
        {!data?.exists && !loading && (
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #E8E4DC',
              padding: '32px',
              textAlign: 'center',
              color: '#aaa',
            }}
          >
            尚無點評資料。點「🔄 重新生成」來產生 AI 草稿。
          </div>
        )}
      </div>
    </div>
  );
}
