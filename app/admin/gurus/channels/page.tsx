'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface Channel {
  _id: string;
  name: string;
  type: string;
  url?: string;
  rssUrl?: string;
  active?: boolean;
  updatedAt?: string;
  contentCount?: number;
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube: '🎬 YouTube',
  x: '🐦 X',
  podcast: '🎙️ Podcast',
  substack: '📰 Substack',
};

function PlatformBadge({ platform }: { platform: string }) {
  const label = PLATFORM_LABELS[platform] ?? platform;
  return (
    <span
      style={{
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 6,
        background: '#f0f0f0',
        color: '#444',
      }}
    >
      {label}
    </span>
  );
}

export default function GuruChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // New channel form state
  const [formName, setFormName] = useState('');
  const [formPlatform, setFormPlatform] = useState('youtube');
  const [formUrl, setFormUrl] = useState('');
  const [formRssUrl, setFormRssUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fetchingAll, setFetchingAll] = useState(false);

  async function loadChannels() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gurus/channels');
      const data = await res.json();
      setChannels(data.channels || []);
    } catch {
      setMessage('❌ 載入失敗');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChannels();
  }, []);

  async function handleToggle(id: string, current: boolean) {
    try {
      await fetch(`/api/admin/gurus/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !current }),
      });
      setChannels((prev) =>
        prev.map((c) => (c._id === id ? { ...c, active: !current } : c))
      );
    } catch {
      setMessage('❌ 更新失敗');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`確認刪除「${name}」？`)) return;
    try {
      const res = await fetch(`/api/admin/gurus/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c._id !== id));
        setMessage('✅ 已刪除');
      } else {
        setMessage('❌ 刪除失敗');
      }
    } catch {
      setMessage('❌ 刪除失敗');
    }
  }

  async function handleFetchAll() {
    setFetchingAll(true);
    setMessage('');
    try {
      const r = await fetch('/api/cron/update-gurus', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` },
      });
      const result = await r.json();
      setMessage(result.error ? `❌ ${result.error}` : `✅ 更新完成`);
      loadChannels();
    } catch (e) {
      setMessage(`❌ ${String(e)}`);
    } finally {
      setFetchingAll(false);
    }
  }

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!formName || !formPlatform) return;
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/gurus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          platform: formPlatform,
          url: formUrl,
          rssUrl: formRssUrl,
        }),
      });
      if (res.ok) {
        setMessage('✅ 頻道已新增');
        setFormName('');
        setFormUrl('');
        setFormRssUrl('');
        loadChannels();
      } else {
        const d = await res.json();
        setMessage(`❌ ${d.error}`);
      }
    } catch {
      setMessage('❌ 新增失敗');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <Navbar />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <Link
            href="/admin/gurus"
            style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}
          >
            ← 返回大神追蹤
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0, flex: 1 }}>
            頻道管理
          </h1>
          <button
            onClick={handleFetchAll}
            disabled={fetchingAll}
            style={{
              background: fetchingAll ? '#CCC' : '#1A7340',
              color: '#FFF',
              border: 'none',
              borderRadius: 7,
              padding: '8px 16px',
              cursor: fetchingAll ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {fetchingAll ? '⏳ 更新中...' : '🔄 立刻更新'}
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            style={{
              padding: '10px 14px',
              marginBottom: 16,
              borderRadius: 6,
              background: message.startsWith('✅') ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${message.startsWith('✅') ? '#BBF7D0' : '#FECACA'}`,
              color: message.startsWith('✅') ? '#1A7340' : '#C0392B',
              fontSize: 13,
            }}
          >
            {message}
          </div>
        )}

        {/* Channel list */}
        <div
          style={{
            background: '#FFF',
            border: '1px solid #E0DCD6',
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: 32,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F5F3EE', borderBottom: '1px solid #E0DCD6' }}>
                {['名稱', '平台', '狀態', '最後更新', '內容筆數', '操作'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#666',
                      fontSize: 12,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>
                    載入中...
                  </td>
                </tr>
              ) : channels.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>
                    尚無頻道
                  </td>
                </tr>
              ) : (
                channels.map((ch, i) => (
                  <tr
                    key={ch._id}
                    style={{
                      borderBottom: i < channels.length - 1 ? '1px solid #EDEBE6' : 'none',
                      background: i % 2 === 0 ? '#FFF' : '#FAFAF8',
                    }}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1A1A1A' }}>
                      {ch.name}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <PlatformBadge platform={ch.type} />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: ch.active !== false ? '#F0FDF4' : '#F5F5F5',
                          color: ch.active !== false ? '#1A7340' : '#999',
                        }}
                      >
                        {ch.active !== false ? '啟用' : '停用'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>
                      {ch.updatedAt ? new Date(ch.updatedAt).toLocaleDateString('zh-TW') : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#666' }}>
                      {ch.contentCount ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleToggle(ch._id, ch.active !== false)}
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            border: '1px solid #D5D0C8',
                            borderRadius: 5,
                            background: '#FFF',
                            color: '#555',
                            cursor: 'pointer',
                          }}
                        >
                          {ch.active !== false ? '停用' : '啟用'}
                        </button>
                        <button
                          onClick={() => handleDelete(ch._id, ch.name)}
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            border: '1px solid #FECACA',
                            borderRadius: 5,
                            background: '#FFF',
                            color: '#C0392B',
                            cursor: 'pointer',
                          }}
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add channel form */}
        <div
          style={{
            background: '#FFF',
            border: '1px solid #E0DCD6',
            borderRadius: 10,
            padding: '24px',
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 16 }}>
            新增頻道
          </h2>
          <form onSubmit={handleAddChannel} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={labelStyle}>名稱 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="頻道名稱"
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={labelStyle}>平台 *</label>
                <select
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value)}
                  style={inputStyle}
                >
                  <option value="youtube">YouTube</option>
                  <option value="x">X</option>
                  <option value="podcast">Podcast</option>
                  <option value="substack">Substack</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>網址</label>
              <input
                type="text"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://..."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>RSS URL（選填）</label>
              <input
                type="text"
                value={formRssUrl}
                onChange={(e) => setFormRssUrl(e.target.value)}
                placeholder="https://...feed.xml"
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                alignSelf: 'flex-start',
                padding: '9px 20px',
                background: submitting ? '#CCC' : '#1A1A1A',
                color: '#FFF',
                border: 'none',
                borderRadius: 7,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {submitting ? '新增中...' : '送出'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#666',
  marginBottom: 4,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #D5D0C8',
  borderRadius: 6,
  fontSize: 13,
  background: '#FFF',
  color: '#1A1A1A',
  boxSizing: 'border-box',
};
