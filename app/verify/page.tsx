'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

export default function VerifyPage() {
  const router = useRouter();
  const { update } = useSession();
  const [channelUrl, setChannelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!channelUrl.trim()) {
      setError('請輸入你的 YouTube 頻道連結');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: channelUrl.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '驗證失敗，請稍後再試');
        setLoading(false);
        return;
      }

      setSuccess(true);
      // Force session refresh so middleware sees new isYTMember=true
      await update();
      setTimeout(() => router.push('/stocks'), 1000);
    } catch {
      setError('網路錯誤，請稍後再試');
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&family=Noto+Sans+TC:wght@400;500;600&display=swap');
        .step-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
          gap: 6px;
          align-items: center;
        }
        .step-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #555;
          font-size: 16px;
          padding: 0 2px;
        }
        @media (max-width: 600px) {
          .step-grid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .step-arrow {
            display: none;
          }
        }
      `}</style>
      <div
        style={{
          minHeight: '100dvh',
          background: 'oklch(0.18 0.01 65)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          fontFamily: "'Noto Sans TC', sans-serif",
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, #c9a84c 50%, transparent 100%)',
          }}
        />

        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 32,
              fontWeight: 700,
              color: '#EDEDEB',
              letterSpacing: '0.04em',
              marginBottom: 8,
            }}
          >
            JG<span style={{ color: '#c9a84c' }}>True</span>Stock
          </h1>

          <p
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 14,
              color: '#c9a84c',
              letterSpacing: '0.15em',
              marginBottom: 32,
            }}
          >
            會員資格驗證
          </p>

          <div
            style={{
              background: 'oklch(0.22 0.01 65)',
              border: '1px solid oklch(0.30 0.01 65)',
              borderRadius: 8,
              padding: '32px 24px',
              textAlign: 'left',
            }}
          >
            {success ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#EDEDEB', marginBottom: 8 }}>
                  驗證成功！
                </p>
                <p style={{ fontSize: 13, color: 'oklch(0.55 0.01 65)' }}>
                  正在跳轉到戰友情報室⋯
                </p>
              </div>
            ) : (
              <>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#EDEDEB',
                    marginBottom: 20,
                    textAlign: 'center',
                  }}
                >
                  請貼上你的 YouTube 頻道連結
                </h2>

                {/* Steps - 4-step visual guide */}
                <div
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid #2a2a2a',
                    borderRadius: 8,
                    padding: '14px 12px 10px',
                    marginBottom: 20,
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#e0e0e0',
                      marginBottom: 12,
                      textAlign: 'center',
                    }}
                  >
                    怎麼找到我的頻道連結？
                  </p>

                  <div className="step-grid">
                    {/* Step 1 */}
                    <div
                      style={{
                        background: '#222',
                        borderRadius: 6,
                        padding: 12,
                        textAlign: 'center',
                      }}
                    >
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ margin: '0 auto 6px' }}>
                        <rect width="32" height="32" rx="6" fill="#CC0000" />
                        <polygon points="12,9 25,16 12,23" fill="white" />
                      </svg>
                      <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.4 }}>打開 YouTube</div>
                    </div>

                    {/* Arrow 1 */}
                    <div className="step-arrow">→</div>

                    {/* Step 2 */}
                    <div
                      style={{
                        background: '#222',
                        borderRadius: 6,
                        padding: 12,
                        textAlign: 'center',
                      }}
                    >
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#c9a84c" strokeWidth="1.8" style={{ margin: '0 auto 6px', display: 'block' }}>
                        <circle cx="16" cy="12" r="5" />
                        <path d="M6 26c0-5.523 4.477-10 10-10s10 4.477 10 10" strokeLinecap="round" />
                      </svg>
                      <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.4 }}>點右上角頭像</div>
                    </div>

                    {/* Arrow 2 */}
                    <div className="step-arrow">→</div>

                    {/* Step 3 - highlighted */}
                    <div
                      style={{
                        background: '#222',
                        borderRadius: 6,
                        padding: 12,
                        textAlign: 'center',
                        border: '1px solid #c9a84c',
                      }}
                    >
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#c9a84c" strokeWidth="1.8" style={{ margin: '0 auto 6px', display: 'block' }}>
                        <rect x="3" y="5" width="26" height="18" rx="2" />
                        <line x1="12" y1="27" x2="20" y2="27" strokeLinecap="round" />
                        <line x1="16" y1="23" x2="16" y2="27" />
                        <rect x="7" y="9" width="10" height="10" rx="1" fill="#c9a84c" opacity="0.3" />
                      </svg>
                      <div style={{ fontSize: 12, color: '#c9a84c', lineHeight: 1.4, fontWeight: 600 }}>點「查看頻道」<br />或「瀏覽頻道」</div>
                    </div>

                    {/* Arrow 3 */}
                    <div className="step-arrow">→</div>

                    {/* Step 4 */}
                    <div
                      style={{
                        background: '#222',
                        borderRadius: 6,
                        padding: 12,
                        textAlign: 'center',
                      }}
                    >
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#c9a84c" strokeWidth="1.8" style={{ margin: '0 auto 6px', display: 'block' }}>
                        <path d="M13 19l-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8 14h11a5 5 0 0 1 0 10h-2" strokeLinecap="round" />
                        <rect x="14" y="8" width="14" height="10" rx="2" />
                        <line x1="17" y1="11" x2="25" y2="11" strokeLinecap="round" />
                        <line x1="17" y1="14" x2="23" y2="14" strokeLinecap="round" />
                      </svg>
                      <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.4 }}>複製網址<br />貼到下方</div>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: '#c9a84c', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
                    連結通常長這樣：youtube.com/@yourname
                  </p>
                </div>

                {/* Example */}
                <p
                  style={{
                    fontSize: 11,
                    color: 'oklch(0.45 0.01 65)',
                    marginBottom: 16,
                    lineHeight: 1.6,
                  }}
                >
                  例如：https://www.youtube.com/@你的頻道名稱
                  <br />
                  或：https://www.youtube.com/channel/UC...
                </p>

                {/* Input */}
                <input
                  type="text"
                  value={channelUrl}
                  onChange={(e) => {
                    setChannelUrl(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="貼上你的 YouTube 頻道連結"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: 'oklch(0.16 0.01 65)',
                    border: error
                      ? '1px solid rgba(204,26,34,0.6)'
                      : '1px solid oklch(0.35 0.01 65)',
                    borderRadius: 6,
                    color: '#EDEDEB',
                    fontSize: 14,
                    fontFamily: "'Noto Sans TC', sans-serif",
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: 8,
                  }}
                  onFocus={(e) => {
                    if (!error) e.currentTarget.style.borderColor = '#c9a84c';
                  }}
                  onBlur={(e) => {
                    if (!error) e.currentTarget.style.borderColor = 'oklch(0.35 0.01 65)';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) handleSubmit();
                  }}
                />

                {/* Error */}
                {error && (
                  <p
                    style={{
                      fontSize: 12,
                      color: '#cc1a22',
                      marginTop: 4,
                      marginBottom: 8,
                      lineHeight: 1.6,
                    }}
                  >
                    {error}
                  </p>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '13px 0',
                    marginTop: 12,
                    background: loading ? 'oklch(0.35 0.01 65)' : '#c9a84c',
                    border: 'none',
                    color: loading ? 'oklch(0.55 0.01 65)' : 'oklch(0.15 0.01 65)',
                    fontSize: 14,
                    fontWeight: 700,
                    borderRadius: 6,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: "'Noto Sans TC', sans-serif",
                    letterSpacing: '0.05em',
                    transition: 'background 0.2s',
                  }}
                >
                  {loading ? '驗證中⋯' : '確認驗證'}
                </button>

                {/* Divider */}
                <div
                  style={{
                    width: '100%',
                    height: 1,
                    background: 'oklch(0.30 0.01 65)',
                    margin: '24px 0 16px',
                  }}
                />

                {/* Logout option */}
                <p style={{ fontSize: 12, color: 'oklch(0.45 0.01 65)', textAlign: 'center' }}>
                  登入了錯的帳號？{' '}
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#c9a84c',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: "'Noto Sans TC', sans-serif",
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    切換帳號
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
