'use client';
import Navbar from '@/components/Navbar';
import { useState, useEffect } from 'react';

export default function AnnouncementAdminPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/announcement')
      .then(r => r.json())
      .then(data => {
        if (data.announcement) {
          setTitle(data.announcement.title);
          setContent(data.announcement.content);
          setActive(data.announcement.active);
        }
        setLoading(false);
      });
  }, []);

  function handleNewAnnouncement() {
    setTitle('');
    setContent('');
    setActive(true);
    setIsNew(true);
    setMessage(null);
  }

  async function handleSave(overrideActive?: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, active: overrideActive ?? active, forceNew: isNew }),
      });
      if (!res.ok) throw new Error('儲存失敗');
      const data = await res.json();
      setActive(data.announcement.active);
      setIsNew(false);
      setMessage({ type: 'success', text: isNew ? '✅ 新公告已發布！所有會員下次登入都會看到' : '公告已儲存' });
    } catch {
      setMessage({ type: 'error', text: '儲存失敗，請再試一次' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <Navbar />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h1
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 22,
              fontWeight: 700,
              color: '#1A1A1A',
              margin: 0,
            }}
          >
            公告管理
          </h1>
          {!loading && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 20,
                background: active ? '#e8f5e9' : '#f5f5f5',
                color: active ? '#2e7d32' : '#888',
                border: `1px solid ${active ? '#a5d6a7' : '#ddd'}`,
              }}
            >
              {active ? '🟢 啟用中' : '⚪ 已停用'}
            </span>
          )}
        </div>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 36 }}>
          設定登入後顯示給所有會員的公告訊息
        </p>

        {loading ? (
          <div style={{ color: '#aaa', fontSize: 14 }}>載入中...</div>
        ) : (
          <div
            style={{
              background: '#FFF',
              border: '1px solid #E0DCD6',
              borderRadius: 10,
              padding: '28px 28px 24px',
            }}
          >
            {/* 標題 */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#444',
                  marginBottom: 6,
                }}
              >
                公告標題
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例：系統維護通知"
                style={{
                  width: '100%',
                  border: '1px solid #E0DCD6',
                  borderRadius: 6,
                  padding: '10px 12px',
                  fontSize: 14,
                  color: '#1A1A1A',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* 內容 */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#444',
                  marginBottom: 6,
                }}
              >
                公告內容
              </label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="輸入公告內容，支援換行..."
                rows={6}
                style={{
                  width: '100%',
                  border: '1px solid #E0DCD6',
                  borderRadius: 6,
                  padding: '10px 12px',
                  fontSize: 14,
                  color: '#1A1A1A',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  lineHeight: 1.7,
                }}
              />
            </div>

            {/* 啟用 toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 24,
              }}
            >
              <label
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: 42,
                  height: 24,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: active ? '#C0392B' : '#ccc',
                    borderRadius: 24,
                    transition: 'background 0.2s',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: active ? 21 : 3,
                    width: 18,
                    height: 18,
                    background: '#fff',
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </label>
              <span style={{ fontSize: 13, color: '#555' }}>啟用公告（顯示給會員）</span>
            </div>

            {/* 成功/錯誤訊息 */}
            {message && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  background: message.type === 'success' ? '#e8f5e9' : '#fdecea',
                  color: message.type === 'success' ? '#2e7d32' : '#c62828',
                  border: `1px solid ${message.type === 'success' ? '#a5d6a7' : '#ef9a9a'}`,
                }}
              >
                {message.type === 'success' ? '✓ ' : '✕ '}{message.text}
              </div>
            )}

            {/* 按鈕 */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {/* 發布新公告 — 產生新 _id，所有人都會再看到 */}
              {!isNew && (
                <button
                  onClick={handleNewAnnouncement}
                  style={{
                    background: '#1a1a1a',
                    color: '#c9a84c',
                    border: '1px solid #c9a84c',
                    borderRadius: 8,
                    padding: '10px 22px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  🆕 發布新公告
                </button>
              )}
              <button
                onClick={() => handleSave()}
                disabled={saving}
                style={{
                  background: saving ? '#e88' : '#C0392B',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 22px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {saving ? '儲存中...' : isNew ? '發布公告' : '儲存修改'}
              </button>
              {!isNew && (
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  style={{
                    background: '#f5f5f5',
                    color: '#555',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: '10px 22px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  停用公告
                </button>
              )}
              {isNew && (
                <button
                  onClick={() => { setIsNew(false); }}
                  style={{
                    background: '#f5f5f5',
                    color: '#555',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: '10px 22px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  取消
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
