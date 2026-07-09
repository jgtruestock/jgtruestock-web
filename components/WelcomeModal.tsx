'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'jg_welcome_seen';

// SVG Icons — gold stroke, no fill
function DatabaseIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="14" cy="7" rx="9" ry="3.5" stroke="#c9a84c" strokeWidth="1.5" />
      <path d="M5 7v7c0 1.933 4.03 3.5 9 3.5s9-1.567 9-3.5V7" stroke="#c9a84c" strokeWidth="1.5" />
      <path d="M5 14v7c0 1.933 4.03 3.5 9 3.5s9-1.567 9-3.5v-7" stroke="#c9a84c" strokeWidth="1.5" />
    </svg>
  );
}

function DocumentSearchIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10l-6-6z" stroke="#c9a84c" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 4v6h6" stroke="#c9a84c" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="13" cy="16" r="3" stroke="#c9a84c" strokeWidth="1.5" />
      <path d="M15.5 18.5l2.5 2.5" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-4 4V6z" stroke="#c9a84c" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 10h8M10 14h5" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const features = [
  {
    Icon: DatabaseIcon,
    title: '會員專屬資料庫',
    desc: '這裡不是新聞列表，而是 JG 每天用來追蹤市場錯價、產業轉折與下一輪機會的研究入口',
  },
  {
    Icon: DocumentSearchIcon,
    title: '法說會點評',
    desc: '影子JG 幫你拆解法說會重點，告訴你真正要注意什麼',
  },
  {
    Icon: ChatBubbleIcon,
    title: '分享你的想法',
    desc: '點右下角的金色按鈕，給 JG 留言或分享情報',
  },
];

export default function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [ctaHovered, setCtaHovered] = useState(false);

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
        background: 'rgba(0,0,0,0.72)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #1a1a1a 0%, #111 100%)',
          border: '1px solid #2a2a2a',
          boxShadow: '0 0 0 1px rgba(201,168,76,0.12), 0 24px 72px rgba(0,0,0,0.7), inset 0 1px 0 rgba(201,168,76,0.08)',
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          padding: '36px 32px 28px',
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
            color: '#555',
            lineHeight: 1,
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="關閉"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3l12 12M15 3L3 15" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Title */}
        <h2
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 22,
            fontWeight: 900,
            color: '#cc1a22',
            marginBottom: 8,
            lineHeight: 1.35,
          }}
        >
          歡迎加入 JG 戰友情報室
        </h2>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 20, lineHeight: 1.5 }}>
          這裡是 JG 頻道會員專屬的情報基地
        </p>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'linear-gradient(90deg, #c9a84c 0%, rgba(201,168,76,0.15) 100%)',
            marginBottom: 24,
          }}
        />

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {features.map(({ Icon, title, desc }, i) => (
            <div
              key={title}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                background: '#1e1e1e',
                border: `1px solid ${hoveredIndex === i ? '#c9a84c' : '#2a2a2a'}`,
                borderRadius: 10,
                padding: '14px 16px',
                transition: 'border-color 0.2s',
                cursor: 'default',
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <Icon />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontWeight: 700,
                    fontSize: 14,
                    color: '#e0e0e0',
                    marginBottom: 4,
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleClose}
          style={{
            width: '100%',
            background: ctaHovered ? '#d4b05a' : '#c9a84c',
            color: '#0f0f0f',
            border: 'none',
            borderRadius: 10,
            padding: '14px 0',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Noto Sans TC', sans-serif",
            letterSpacing: 0.5,
            transition: 'background 0.15s',
            boxShadow: ctaHovered ? '0 4px 20px rgba(201,168,76,0.35)' : '0 2px 12px rgba(201,168,76,0.2)',
          }}
          onMouseEnter={() => setCtaHovered(true)}
          onMouseLeave={() => setCtaHovered(false)}
        >
          開始探索 →
        </button>
      </div>
    </div>
  );
}
