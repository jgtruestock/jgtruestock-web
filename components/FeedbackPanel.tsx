'use client';

import { useState, useRef, useEffect } from 'react';

type FeedbackType = 'feature' | 'stock' | 'general';

const TYPE_LABELS: Record<FeedbackType, string> = {
  feature: '💡 新功能建議',
  stock: '📈 股票情報討論',
  general: '💬 一般建議',
};

export default function FeedbackPanel() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  function handleOpen() {
    setOpen(true);
    setSubmitted(false);
    setError('');
    setMessage('');
    setType('general');
  }

  async function handleSubmit() {
    if (!message.trim()) {
      setError('請輸入你的意見 🙏');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || '送出失敗，請稍後再試');
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={handleOpen}
        aria-label="給 JG 說"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 24,
          zIndex: 900,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#1A1A1A',
          border: '2px solid #C8A84B',
          color: '#C8A84B',
          fontSize: 22,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.32)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 18px rgba(0,0,0,0.25)';
        }}
      >
        💬
      </button>

      {/* Backdrop */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 910,
            background: 'rgba(0,0,0,0.35)',
            animation: 'fbFadeIn 0.18s ease',
          }}
        />
      )}

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            bottom: 90,
            right: 24,
            zIndex: 920,
            width: 340,
            maxWidth: 'calc(100vw - 32px)',
            background: '#FFFFFF',
            border: '1px solid #E0DCD6',
            borderRadius: 8,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            animation: 'fbSlideUp 0.2s ease',
            fontFamily: "'Noto Sans TC', sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: '#1A1A1A',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontFamily: "'Noto Serif TC', serif",
                fontSize: 15,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: 0.5,
              }}
            >
              給 JG 說
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1,
                padding: '0 2px',
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 18px 20px' }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🙌</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
                  謝謝你！JG 收到了
                </p>
                <p style={{ fontSize: 12, color: '#888' }}>
                  你的建議會讓這個平台變得更好
                </p>
                <button
                  onClick={() => { setSubmitted(false); setMessage(''); setType('general'); }}
                  style={{
                    marginTop: 16,
                    fontSize: 12,
                    color: '#C8A84B',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  再說一件事
                </button>
              </div>
            ) : (
              <>
                {/* JG's intro quote */}
                <p
                  style={{
                    fontSize: 12,
                    color: '#B8964A',
                    lineHeight: 1.7,
                    marginBottom: 14,
                    padding: '10px 12px',
                    background: '#FDFAF3',
                    border: '1px solid #EDE0BB',
                    borderRadius: 5,
                    fontStyle: 'normal',
                  }}
                >
                  我是JG，想要新功能、想討論任何股票情報、有任何建議都可以在這邊跟我說，讓我們一起打造真正的爆賺人生 🔥
                </p>

                {/* Type selector */}
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#999',
                      letterSpacing: 0.5,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    類型
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(Object.entries(TYPE_LABELS) as [FeedbackType, string][]).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setType(k)}
                        style={{
                          fontSize: 12,
                          padding: '5px 11px',
                          borderRadius: 4,
                          border: type === k ? '1.5px solid #1A1A1A' : '1.5px solid #D5D0C8',
                          background: type === k ? '#1A1A1A' : '#FAFAF8',
                          color: type === k ? '#FFFFFF' : '#666',
                          cursor: 'pointer',
                          fontFamily: "'Noto Sans TC', sans-serif",
                          transition: 'all 0.12s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message textarea */}
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#999',
                      letterSpacing: 0.5,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    說說你的想法
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); setError(''); }}
                    placeholder="任何想法都歡迎，越具體越好！"
                    rows={4}
                    maxLength={2000}
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      fontSize: 13,
                      color: '#2D2D2D',
                      border: '1px solid #D5D0C8',
                      borderRadius: 4,
                      padding: '9px 11px',
                      fontFamily: "'Noto Sans TC', sans-serif",
                      lineHeight: 1.6,
                      outline: 'none',
                      background: '#FAFAF8',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#C8A84B'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#D5D0C8'; }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#BBB', marginTop: 3 }}>
                    {message.length} / 2000
                  </div>
                </div>

                {error && (
                  <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 10 }}>{error}</p>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    background: submitting ? '#888' : '#1A1A1A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontFamily: "'Noto Sans TC', sans-serif",
                    letterSpacing: 0.3,
                    transition: 'background 0.15s',
                  }}
                >
                  {submitting ? '送出中...' : '送出給 JG'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fbFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fbSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
