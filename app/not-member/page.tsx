'use client';

import { signOut, useSession } from 'next-auth/react';

export default function NotMemberPage() {
  const { data: session } = useSession();
  const email = (session?.user as any)?.email ?? '';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&family=Noto+Serif+TC:wght@400;700&family=Noto+Sans+TC:wght@400;500;600&display=swap');
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
          {/* Brand */}
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
              fontSize: 13,
              color: '#c9a84c',
              letterSpacing: '0.2em',
              marginBottom: 40,
            }}
          >
            戰友情報室
          </p>

          {/* Card */}
          <div
            style={{
              background: 'oklch(0.22 0.01 65)',
              border: '1px solid oklch(0.30 0.01 65)',
              borderRadius: 12,
              padding: '32px 28px',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>

            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#EDEDEB',
                marginBottom: 12,
              }}
            >
              這個帳號不是 JG 頻道會員
            </h2>

            {email && (
              <p style={{ fontSize: 13, color: 'oklch(0.55 0.01 65)', marginBottom: 20 }}>
                你登入的 Google 帳號：
                <span style={{ color: '#c9a84c', fontWeight: 600 }}> {email}</span>
                <br />沒有在會員名單中。
              </p>
            )}

            {/* Checklist */}
            <div
              style={{
                background: 'oklch(0.19 0.01 65)',
                borderLeft: '2px solid #c9a84c',
                padding: '14px 16px',
                marginBottom: 24,
                textAlign: 'left',
                borderRadius: '0 6px 6px 0',
              }}
            >
              <p style={{ fontSize: 13, color: '#c9a84c', fontWeight: 600, marginBottom: 10 }}>
                請確認：
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  '你是否用「加入 JG 頻道會員時的 Google 帳號」登入？',
                  '如果你有多個 Google 帳號，請登出後換正確的帳號重試',
                  '如果你剛加入頻道，可能需要等幾分鐘後重新登入',
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'oklch(0.65 0.01 65)', lineHeight: 1.6 }}>
                    <span style={{ color: '#c9a84c', flexShrink: 0 }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

              <a
                href="https://www.youtube.com/channel/UCzY0ZSJO28AMIByZ640sQag/community"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 0',
                  background: 'none',
                  border: '1px solid oklch(0.35 0.01 65)',
                  color: 'oklch(0.55 0.01 65)',
                  fontSize: 13,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  textAlign: 'center',
                  fontFamily: "'Noto Sans TC', sans-serif",
                }}
              >
                還是進不去？聯絡 JG
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
