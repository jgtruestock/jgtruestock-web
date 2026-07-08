'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'jg_welcome_seen';

export default function WelcomeModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setVisible(true);
    }
  }, []);

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          padding: '36px 32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 20,
            color: '#aaa',
            lineHeight: 1,
            padding: 4,
          }}
          aria-label="關閉"
        >
          ✕
        </button>

        {/* Title */}
        <h2
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 24,
            fontWeight: 900,
            color: '#cc1a22',
            marginBottom: 6,
            lineHeight: 1.3,
          }}
        >
          歡迎加入 JG 戰友情報室 👋
        </h2>
        <p style={{ fontSize: 16, color: '#888', marginBottom: 20 }}>
          這裡是 JG 頻道會員專屬的情報基地
        </p>

        {/* Divider */}
        <div style={{ height: 2, background: '#c9a84c', borderRadius: 1, marginBottom: 24 }} />

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          {[
            {
              icon: '📊',
              title: 'JG 提股資料庫',
              desc: 'JG 歷年提股紀錄，追蹤每支股票的最新進展',
            },
            {
              icon: '🎯',
              title: '法說會點評',
              desc: '影子JG 幫你拆解法說會重點，告訴你真正要注意什麼',
            },
            {
              icon: '💬',
              title: '分享你的想法',
              desc: '點右下角的金色按鈕，給 JG 留言或分享情報',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
              <div>
                <div
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#1a1a1a',
                    marginBottom: 2,
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: 13, color: '#777', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleClose}
          style={{
            width: '100%',
            background: '#cc1a22',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '14px 0',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Noto Sans TC', sans-serif",
            letterSpacing: 0.5,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#a51219';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#cc1a22';
          }}
        >
          開始探索 →
        </button>
      </div>
    </div>
  );
}
