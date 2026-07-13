'use client';

import Navbar from '@/components/Navbar';
import Link from 'next/link';

const CARDS = [
  {
    href: '/admin/mentions',
    icon: '📈',
    title: '提股管理',
    desc: '新增、刪除提股記錄，追蹤股票表現',
  },
  {
    href: '/admin/commentary',
    icon: '📝',
    title: '法說會點評',
    desc: '管理 AI 生成的法說會中文摘要，發布給會員',
  },
  {
    href: '/admin/gurus',
    icon: '🧠',
    title: '大神追蹤',
    desc: '追蹤 YouTube、Podcast、X 大神最新內容',
  },
  {
    href: '/admin/announcement',
    icon: '📢',
    title: '公告管理',
    desc: '設定登入後顯示給所有會員的公告訊息',
  },
];

export default function AdminPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <Navbar />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        <h1
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 22,
            fontWeight: 700,
            color: '#1A1A1A',
            marginBottom: 8,
          }}
        >
          後台管理
        </h1>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 36 }}>
          選擇一個功能開始管理
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  background: '#FFF',
                  border: '1px solid #E0DCD6',
                  borderRadius: 10,
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#C0392B';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#E0DCD6';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 28 }}>{card.icon}</span>
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: '#1A1A1A',
                        marginBottom: 4,
                      }}
                    >
                      {card.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#888' }}>{card.desc}</div>
                  </div>
                </div>
                <span style={{ color: '#C0392B', fontSize: 18 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
