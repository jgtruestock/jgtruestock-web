'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function VerifyPage() {
  const router = useRouter();
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
      setTimeout(() => router.push('/stocks'), 1500);
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

                {/* Steps */}
                <div style={{ marginBottom: 24 }}>
                  {[
                    '打開 YouTube App 或網頁',
                    '點右上角你的頭像',
                    '點「查看頻道」',
                    '複製網址列的連結',
                    '貼到下方輸入框',
                  ].map((step, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
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
                      <span style={{ fontSize: 13, color: 'oklch(0.65 0.01 65)', lineHeight: 1.7 }}>
                        {step}
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
