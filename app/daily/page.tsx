'use client';

import Navbar from '@/components/Navbar';

export default function DailyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <Navbar />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 52px)',
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            borderLeft: '3px solid #c9a84c',
            paddingLeft: 24,
            textAlign: 'left',
            maxWidth: 420,
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: 3,
              color: '#c9a84c',
              textTransform: 'uppercase',
              marginBottom: 16,
              fontFamily: "'Noto Sans TC', sans-serif",
            }}
          >
            Coming Soon
          </p>
          <h1
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 24,
              fontWeight: 700,
              color: '#1A1A1A',
              lineHeight: 1.5,
              marginBottom: 12,
            }}
          >
            每日分享
          </h1>
          <p
            style={{
              fontSize: 15,
              color: '#555',
              lineHeight: 1.8,
              fontFamily: "'Noto Sans TC', sans-serif",
            }}
          >
            下一階段更新，預計八月前上線，敬請期待。
          </p>
        </div>
      </div>
    </div>
  );
}
