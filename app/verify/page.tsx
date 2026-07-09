'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

export default function VerifyPage() {
  const router = useRouter();
  const { update } = useSession();
  const [channelUrl, setChannelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        // Force session refresh so middleware sees new isYTMember=true
        await update();
        setTimeout(() => router.push('/stocks'), 1500);
      } else {
        setError(data.error ?? '發生錯誤，請稍後再試');
      }
    } catch {
      setError('無法連線，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    '打開 YouTube（手機或電腦）',
    '點右上角的頭像 / 大頭照',
    '點「查看頻道」',
    '複製網址列的連結，貼到下面的輸入框',
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&family=Noto+Serif+TC:wght@400;700&family=Noto+Sans+TC:wght@400;500;600&display=swap');
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0f0f0f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 16px',
          fontFamily: "'Noto Sans TC', sans-serif",
        }}
      >
        <div style={{ width: '100%', maxWidth: 480 }}>

          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{
                fontFamily: "'Raleway', sans-serif",
                color: '#c9a84c',
                fontSize: 9,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              MEMBER VERIFICATION
            </div>
            <h1
              style={{
                fontFamily: "'Noto Serif TC', serif",
                color: '#cc1a22',
                fontSize: 22,
                fontWeight: 700,
                margin: '0 0 8px 0',
              }}
            >
              確認你的頻道會員身份
            </h1>
            <p
              style={{
                color: '#888',
                fontSize: 14,
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              貼上你的 YouTube 頻道連結，系統自動確認你是否為頻道會員
            </p>
          </div>

          {/* Steps Card */}
          <div
            style={{
              background: '#1a1a1a',
              borderLeft: '3px solid #c9a84c',
              border: '1px solid #2a2a2a',
              borderLeftWidth: 3,
              borderLeftColor: '#c9a84c',
              borderRadius: 8,
              padding: '20px 24px',
              marginBottom: 20,
            }}
          >
            <p
              style={{
                color: '#e0e0e0',
                fontSize: 14,
                fontWeight: 700,
                margin: '0 0 14px 0',
              }}
            >
              怎麼找到我的頻道連結？
            </p>
            <ol
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {steps.map((step, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#cc1a22',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: '#e0e0e0', fontSize: 14, lineHeight: 1.5 }}>{step}</span>
                </li>
              ))}
            </ol>
            <p
              style={{
                color: '#c9a84c',
                fontWeight: 600,
                fontSize: 13,
                marginTop: 14,
                marginBottom: 0,
              }}
            >
              連結通常長這樣：youtube.com/@yourname
            </p>
          </div>

          {/* Form / Success Area */}
          {success ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2e7d52"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block', margin: '0 auto 12px' }}
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 11.5 14.5 15.5 9.5" />
              </svg>
              <p
                style={{
                  color: '#2e7d52',
                  fontSize: 16,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                確認成功！正在進入...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                type="text"
                value={channelUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  try { setChannelUrl(decodeURIComponent(val)); }
                  catch { setChannelUrl(val); }
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="貼上你的頻道連結，例如：youtube.com/@yourname 或 @yourname"
                style={{
                  background: '#1a1a1a',
                  border: `1px solid ${inputFocused ? '#c9a84c' : '#333'}`,
                  color: '#e0e0e0',
                  borderRadius: 8,
                  padding: '12px 16px',
                  fontSize: 14,
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: "'Noto Sans TC', sans-serif",
                  transition: 'border-color 0.2s',
                }}
                disabled={loading}
                required
              />

              {error && (
                <div
                  style={{
                    background: 'rgba(204, 26, 34, 0.1)',
                    border: '1px solid rgba(204, 26, 34, 0.3)',
                    color: '#ff6b6b',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 14,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !channelUrl.trim()}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  background: loading || !channelUrl.trim() ? '#8a7034' : btnHover ? '#d4b05a' : '#c9a84c',
                  color: '#0f0f0f',
                  fontWeight: 700,
                  fontSize: 15,
                  padding: '13px 0',
                  borderRadius: 8,
                  border: 'none',
                  cursor: loading || !channelUrl.trim() ? 'not-allowed' : 'pointer',
                  width: '100%',
                  fontFamily: "'Noto Sans TC', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'background 0.2s',
                  opacity: loading || !channelUrl.trim() ? 0.6 : 1,
                }}
              >
                {loading ? (
                  <>
                    <svg
                      className="spin"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" />
                    </svg>
                    驗證中...
                  </>
                ) : (
                  '確認'
                )}
              </button>
            </form>
          )}

          {/* Footer */}
          <p style={{ color: '#555', fontSize: 12, textAlign: 'center', marginTop: 24, marginBottom: 0 }}>
            如果確認你是頻道會員但仍無法通過，請聯繫 JG
          </p>

          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              onMouseEnter={() => setLogoutHover(true)}
              onMouseLeave={() => setLogoutHover(false)}
              style={{
                background: 'none',
                border: 'none',
                color: logoutHover ? '#999' : '#444',
                fontSize: 12,
                cursor: 'pointer',
                padding: 0,
                fontFamily: "'Noto Sans TC', sans-serif",
                transition: 'color 0.2s',
              }}
            >
              登出並換帳號
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
