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
  const [isNotMember, setIsNotMember] = useState(false);
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
        if (res.status === 403) {
          setIsNotMember(true);
        }
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

                {/* Steps - text list with icons */}
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', marginBottom: 12 }}>
                    怎麼找到我的頻道連結？
                  </p>
                  {([
                    {
                      text: '打開 YouTube App 或網頁',
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <rect width="18" height="18" rx="4" fill="#CC0000" />
                          <polygon points="7,5 14,9 7,13" fill="white" />
                        </svg>
                      ),
                    },
                    {
                      text: '點右上角你的頭像',
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#c9a84c" strokeWidth="1.5">
                          <circle cx="9" cy="7" r="3" />
                          <path d="M3 16c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round" />
                        </svg>
                      ),
                    },
                    {
                      text: '點「查看頻道」（或「瀏覽頻道」）',
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#c9a84c" strokeWidth="1.5">
                          <rect x="1" y="2" width="16" height="11" rx="1.5" />
                          <line x1="6" y1="16" x2="12" y2="16" strokeLinecap="round" />
                          <line x1="9" y1="13" x2="9" y2="16" />
                        </svg>
                      ),
                      highlight: true,
                    },
                    {
                      text: '複製網址列的連結',
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#c9a84c" strokeWidth="1.5">
                          <rect x="6" y="1" width="10" height="12" rx="1.5" />
                          <rect x="2" y="5" width="10" height="12" rx="1.5" fill="oklch(0.22 0.01 65)" />
                          <rect x="2" y="5" width="10" height="12" rx="1.5" />
                        </svg>
                      ),
                    },
                    {
                      text: '貼到下方輸入框',
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#c9a84c" strokeWidth="1.5">
                          <rect x="1" y="7" width="16" height="10" rx="1.5" />
                          <path d="M6 7V4a3 3 0 0 1 6 0v3" strokeLinecap="round" />
                          <line x1="9" y1="11" x2="9" y2="13" strokeLinecap="round" />
                        </svg>
                      ),
                    },
                  ] as { text: string; icon: React.ReactNode; highlight?: boolean }[]).map((step, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'oklch(0.28 0.01 65)',
                          color: '#c9a84c',
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{step.icon}</span>
                      <span
                        style={{
                          fontSize: 13,
                          color: step.highlight ? '#c9a84c' : 'oklch(0.65 0.01 65)',
                          fontWeight: step.highlight ? 600 : 400,
                          lineHeight: 1.7,
                        }}
                      >
                        {step.text}
                      </span>
                    </div>
                  ))}
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
                    if (error) { setError(''); setIsNotMember(false); }
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
                {error && !isNotMember && (
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

                {/* Not a member — join prompt */}
                {isNotMember && (
                  <div
                    style={{
                      marginTop: 8,
                      marginBottom: 8,
                      padding: '14px 16px',
                      background: 'oklch(0.16 0.01 65)',
                      border: '1px solid rgba(201,168,76,0.35)',
                      borderRadius: 8,
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 600, marginBottom: 6 }}>
                      你目前還不是 JG 頻道會員
                    </p>
                    <p style={{ fontSize: 12, color: 'oklch(0.55 0.01 65)', marginBottom: 14, lineHeight: 1.6 }}>
                      加入會員後回來再驗證一次即可
                    </p>
                    <a
                      href="https://youtu.be/EY2SnYA9bHU"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '10px 24px',
                        background: '#c9a84c',
                        color: 'oklch(0.15 0.01 65)',
                        fontSize: 14,
                        fontWeight: 700,
                        borderRadius: 6,
                        textDecoration: 'none',
                        letterSpacing: '0.04em',
                      }}
                    >
                      加入 JG 頻道會員 →
                    </a>
                  </div>
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
