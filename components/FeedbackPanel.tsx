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

  // Auto-close after submit
  useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setMessage('');
      setType('general');
    }, 2200);
    return () => clearTimeout(t);
  }, [submitted]);

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
      {/* ── Floating trigger: gold + pulse + label (方案 C) ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 28,
          right: 24,
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Label tag */}
        {!open && (
          <button
            onClick={handleOpen}
            style={{
              background: '#cc1a22',
              color: '#fff',
              border: 'none',
              padding: '7px 14px',
              fontFamily: "'Raleway', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 3px 12px rgba(204,26,34,0.4)',
              animation: 'fbTagIn 0.3s ease',
            }}
          >
            給 JG 說 →
          </button>
        )}

        {/* Gold pulse button */}
        <div style={{ position: 'relative', width: 60, height: 60 }}>
          {/* Pulse ring */}
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid #c9a84c',
              animation: 'fbPulse 2s ease-out infinite',
              pointerEvents: 'none',
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid #c9a84c',
              animation: 'fbPulse 2s ease-out infinite 0.8s',
              pointerEvents: 'none',
            }}
          />
          <button
            onClick={handleOpen}
            aria-label="給 JG 說"
            style={{
              position: 'relative',
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#c9a84c',
              border: 'none',
              color: '#1a1a1a',
              fontSize: 24,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(201,168,76,0.5)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              zIndex: 1,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(201,168,76,0.65)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(201,168,76,0.5)';
            }}
          >
            💬
          </button>
        </div>
      </div>

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
            bottom: 100,
            right: 24,
            zIndex: 920,
            width: 340,
            maxWidth: 'calc(100vw - 32px)',
            borderRadius: 4,
            boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
            overflow: 'hidden',
            animation: 'fbSlideUp 0.2s ease',
            fontFamily: "'Noto Sans TC', sans-serif",
            transition: 'background 0.3s',
          }}
        >
          {/* ── SUCCESS STATE (想法三) ── */}
          {submitted ? (
            <div
              style={{
                background: '#cc1a22',
                padding: '48px 28px',
                textAlign: 'center',
                animation: 'fbSuccessIn 0.25s ease',
              }}
            >
              <div
                style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: 32,
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: '2px',
                  marginBottom: 12,
                }}
              >
                ✔
              </div>
              <div
                style={{
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#fff',
                  marginBottom: 8,
                  lineHeight: 1.3,
                }}
              >
                已傳給 JG
              </div>
              <div
                style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '3px',
                  color: 'rgba(255,255,255,0.7)',
                  textTransform: 'uppercase',
                }}
              >
                感謝戰友
              </div>
              <div
                style={{
                  width: 40,
                  height: 2,
                  background: 'rgba(255,255,255,0.4)',
                  margin: '20px auto 0',
                  animation: 'fbCountdown 2.2s linear forwards',
                }}
              />
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                style={{
                  background: '#1A1A1A',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderLeft: '3px solid #c9a84c',
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
              <div style={{ padding: '16px 18px 20px', background: '#fff' }}>
                {/* JG intro */}
                <p
                  style={{
                    fontSize: 12,
                    color: '#B8964A',
                    lineHeight: 1.7,
                    marginBottom: 14,
                    padding: '10px 12px',
                    background: '#FDFAF3',
                    borderLeft: '2px solid #c9a84c',
                  }}
                >
                  我是JG，想要新功能、想討論任何股票情報、有任何建議都可以在這邊跟我說，讓我們一起打造真正的爆賺人生 🔥
                </p>

                {/* Type selector */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
                    類型
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(Object.entries(TYPE_LABELS) as [FeedbackType, string][]).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setType(k)}
                        style={{
                          fontSize: 12,
                          padding: '5px 11px',
                          border: type === k ? '1.5px solid #cc1a22' : '1.5px solid #D5D0C8',
                          background: type === k ? '#cc1a22' : '#FAFAF8',
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

                {/* Textarea */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
                    說說你的想法
                  </div>
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
                      padding: '9px 11px',
                      fontFamily: "'Noto Sans TC', sans-serif",
                      lineHeight: 1.6,
                      outline: 'none',
                      background: '#FAFAF8',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#c9a84c'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#D5D0C8'; }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#BBB', marginTop: 3 }}>
                    {message.length} / 2000
                  </div>
                </div>

                {error && (
                  <p style={{ fontSize: 12, color: '#cc1a22', marginBottom: 10 }}>{error}</p>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '11px 0',
                    background: submitting ? '#888' : '#cc1a22',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontFamily: "'Raleway', sans-serif",
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    transition: 'background 0.15s',
                  }}
                >
                  {submitting ? '送出中...' : '送給 JG'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes fbFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes fbSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fbTagIn {
          from { opacity: 0; transform: translateX(10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fbPulse {
          0%   { transform: scale(1);    opacity: 0.8; }
          70%  { transform: scale(1.55); opacity: 0;   }
          100% { transform: scale(1.55); opacity: 0;   }
        }
        @keyframes fbSuccessIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fbCountdown {
          from { width: 40px; opacity: 1; }
          to   { width: 0px;  opacity: 0; }
        }
      `}</style>
    </>
  );
}
