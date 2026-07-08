'use client';

import { signIn } from 'next-auth/react';
import { useSession } from 'next-auth/react';

export default function AdminLoginPage() {
  const { data: session } = useSession();
  const hasGoogleSession = session?.user && (session as any)?.provider === 'google';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1A1A1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '40px 36px',
          background: '#242424',
          border: '1px solid #333',
          maxWidth: 360,
          width: '90%',
        }}
      >
        <h1
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 18,
            fontWeight: 700,
            color: '#E0DCD6',
            marginBottom: 8,
          }}
        >
          Admin Portal
        </h1>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 28 }}>
          JGTrueStock 後台管理
        </p>
        {hasGoogleSession && (
          <div
            style={{
              background: '#2a2010',
              border: '1px solid #5a4a20',
              borderRadius: 4,
              padding: '12px 14px',
              marginBottom: 20,
              textAlign: 'left',
            }}
          >
            <p style={{ fontSize: 12, color: '#c9a84c', margin: 0, lineHeight: 1.6 }}>
              ⚠️ 你目前以 Google 會員帳號登入，後台需要使用 Discord 帳號。請點下方按鈕切換。
            </p>
          </div>
        )}
        <button
          onClick={() => signIn('discord', { callbackUrl: '/admin' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            padding: '12px 24px',
            background: '#5865F2',
            color: '#FFF',
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'Noto Sans TC', sans-serif",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          使用 Discord 登入
        </button>
        <p style={{ marginTop: 20, fontSize: 12 }}>
          <a href="/login" style={{ color: '#555', textDecoration: 'none' }}>
            ← 返回
          </a>
        </p>
      </div>
    </div>
  );
}
