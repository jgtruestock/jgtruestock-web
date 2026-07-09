'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function GuidePage() {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  const handleEnter = () => {
    localStorage.setItem('jg_guide_seen', '1');
    router.push('/stocks');
  };

  const cards = [
    {
      title: '會員專屬資料庫',
      desc: '這裡不是新聞列表，而是 JG 每天用來追蹤市場錯價、產業轉折與下一輪機會的研究，我每天更新也分享給你。',
    },
    {
      title: '影子 JG 點評',
      desc: '法說會結束後，影子 JG 幫你整理重點——哪些方向已驗證、哪些尚待觀察、有沒有需要注意的警訊。讀完不超過 3 分鐘。',
    },
    {
      title: '每日自動更新',
      desc: '每天早上自動抓取最新新聞，有新動態就重新整理點評。你不需要到處找資料，這裡會主動告訴你。',
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: "'Noto Sans TC', sans-serif",
      }}
    >
      <div style={{ maxWidth: 560, width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <p
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '4px',
              color: '#c9a84c',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            MEMBER EXCLUSIVE
          </p>
          <h1
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 28,
              fontWeight: 900,
              color: '#cc1a22',
              letterSpacing: 1,
              lineHeight: 1.3,
              marginBottom: 12,
            }}
          >
            JG 戰友情報室
          </h1>
          <p
            style={{
              fontSize: 14,
              color: '#888',
              lineHeight: 1.7,
            }}
          >
            每一個數字背後，都是 JG 真實研究的足跡
          </p>
        </div>

        {/* Feature Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          {cards.map((card, i) => (
            <div
              key={i}
              style={{
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderLeft: '3px solid #c9a84c',
                borderRadius: 8,
                padding: '20px 24px',
              }}
            >
              <h3
                style={{
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#e8e8e8',
                  marginBottom: 8,
                }}
              >
                {card.title}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: '#999',
                  lineHeight: 1.7,
                }}
              >
                {card.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p
          style={{
            fontSize: 13,
            color: '#666',
            textAlign: 'center',
            marginBottom: 28,
            lineHeight: 1.6,
          }}
        >
          這個資料庫不是投資建議，是 JG 研究過程的公開紀錄。
        </p>

        {/* CTA Button */}
        <button
          onClick={handleEnter}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: '100%',
            height: 52,
            background: hovered ? '#d4b35f' : '#c9a84c',
            color: '#0f0f0f',
            border: 'none',
            borderRadius: 6,
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: 1,
            transition: 'background 0.15s',
          }}
        >
          進入情報室 →
        </button>
      </div>
    </div>
  );
}
