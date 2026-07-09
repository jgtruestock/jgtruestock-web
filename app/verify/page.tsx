'use client';

import { signOut } from 'next-auth/react';

export default function VerifyPage() {
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

          <div
            style={{
              background: 'oklch(0.22 0.01 65)',
              border: '1px solid oklch(0.30 0.01 65)',
              borderRadius: 12,
              padding: '36px 28px',
              marginTop: 32,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>

            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#EDEDEB',
                marginBottom: 16,
              }}
            >
              驗證方式已升級
            </h2>

            <p
              style={{
                fontSize: 14,
                color: 'oklch(0.60 0.01 65)',
                lineHeight: 1.8,
                marginBottom: 28,
              }}
            >
              會員驗證現在在登入時自動完成，不再需要貼頻道連結。
              <br />
              請登出後重新登入，系統會自動確認你的會員資格。
            </p>

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{
                width: '100%',
                padding: '13px 0',
                background: 'transparent',
                border: '1px solid #c9a84c',
                color: '#c9a84c',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: "'Noto Sans TC', sans-serif",
                letterSpacing: '0.05em',
              }}
            >
              重新登入
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
