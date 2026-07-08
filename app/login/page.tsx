'use client';

import React from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const isNotMember = error === 'not_member';

  // Detect LINE/FB/Instagram WebView
  const [isWebView, setIsWebView] = React.useState(false);
  React.useEffect(() => {
    const ua = navigator.userAgent;
    setIsWebView(/Line|FBAN|FBAV|FB_IAB|Instagram|Twitter|Snapchat|TelegramWebview/.test(ua));
  }, []);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'oklch(0.18 0.01 65)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
      }}
    >
      {/* Subtle top accent line */}
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

      {/* Main content */}
      <div
        style={{
          textAlign: 'center',
          maxWidth: 380,
          width: '100%',
        }}
      >
        {/* Brand name */}
        <h1
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 36,
            fontWeight: 700,
            color: '#EDEDEB',
            letterSpacing: '0.04em',
            marginBottom: 16,
            lineHeight: 1.2,
          }}
        >
          JG<span style={{ color: '#c9a84c' }}>True</span>Stock
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 15,
            fontWeight: 400,
            color: '#c9a84c',
            letterSpacing: '0.2em',
            marginBottom: 32,
          }}
        >
          戰友情報室
        </p>

        {/* Divider */}
        <div
          style={{
            width: 40,
            height: 1,
            background: 'oklch(0.45 0.01 65)',
            margin: '0 auto 32px',
          }}
        />

        {/* Tagline */}
        <p
          style={{
            fontFamily: "'Noto Sans TC', sans-serif",
            fontSize: 14,
            color: 'oklch(0.55 0.01 65)',
            lineHeight: 1.8,
            marginBottom: 40,
          }}
        >
          限會員頻道專屬
          <br />
          這裡是我們的專屬筆記
          <br />
          跟上暴漲暴跌的變化
        </p>

        {/* WebView warning */}
        {isWebView && (
          <div
            style={{
              background: 'rgba(204,26,34,0.15)',
              border: '1px solid rgba(204,26,34,0.4)',
              borderLeft: '3px solid #cc1a22',
              padding: '14px 16px',
              marginBottom: 24,
              borderRadius: 2,
            }}
          >
            <div style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#cc1a22', marginBottom: 6, textTransform: 'uppercase' }}>
              ⚠️ 無法在此瀏覽器登入
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
              你目前在 LINE 或 App 的內建瀏覽器。Google 不允許在這裡登入。
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8, lineHeight: 1.7 }}>
              請點右上角 <strong style={{ color: '#fff' }}>「⋯」→「用瀏覽器開啟」</strong>，再用 Chrome 或 Safari 登入。
            </div>
          </div>
        )}

        {/* Not member warning */}
        {isNotMember && (
          <div
            style={{
              borderLeft: '2px solid #c9a84c',
              padding: '12px 16px',
              marginBottom: 32,
              fontSize: 13,
              color: '#c9a84c',
              textAlign: 'left',
              fontFamily: "'Noto Sans TC', sans-serif",
              background: 'oklch(0.20 0.01 65)',
            }}
          >
            你的 Google 帳號還沒在系統裡。請先加入 JG 頻道會員，加入後再登入。如果你已經是會員，請向 JG 回報你的 Google 信笱以開通權限。
          </div>
        )}

        {/* Google sign-in button */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/stocks' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            padding: '14px 24px',
            background: 'transparent',
            color: '#c9a84c',
            border: '1px solid #c9a84c',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: "'Noto Sans TC', sans-serif",
            letterSpacing: '0.05em',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#c9a84c';
            e.currentTarget.style.color = 'oklch(0.15 0.01 65)';
            const svg = e.currentTarget.querySelector('svg');
            if (svg) svg.style.fill = 'oklch(0.15 0.01 65)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#c9a84c';
            const svg = e.currentTarget.querySelector('svg');
            if (svg) svg.style.fill = '#c9a84c';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#c9a84c" style={{ transition: 'fill 0.2s' }}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          以 Google 帳號進入
        </button>

        {/* Join member link */}
        <p
          style={{
            fontSize: 12,
            color: 'oklch(0.40 0.01 65)',
            marginTop: 28,
            fontFamily: "'Noto Sans TC', sans-serif",
          }}
        >
          還不是戰友？{' '}
          <a
            href="https://www.youtube.com/channel/UCzY0ZSJO28AMIByZ640sQag/join"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'oklch(0.55 0.01 65)',
              textDecoration: 'none',
              borderBottom: '1px solid oklch(0.35 0.01 65)',
              paddingBottom: 1,
              transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            加入頻道會員
          </a>
        </p>

        {/* Admin link */}
        <p style={{ fontSize: 11, color: 'oklch(0.30 0.01 65)', marginTop: 48 }}>
          <a
            href="/login/admin"
            style={{ color: 'oklch(0.30 0.01 65)', textDecoration: 'none' }}
          >
            管理員入口
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
