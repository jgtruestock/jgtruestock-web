'use client';

import { useEffect, useState } from 'react';

interface StatsData {
  today: { activeUsers: number; newUsers: number; returningUsers: number };
  week: { activeUsers: number };
  topStocks: { symbol: string; count: number }[];
  recentLogins: { email: string; device: string; createdAt: string }[];
}

const DEVICE_ICON: Record<string, string> = {
  mobile: '📱',
  tablet: '📟',
  desktop: '💻',
};

export default function AdminStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={pageStyle}><p style={{ color: '#888' }}>載入中...</p></div>;
  if (error) return <div style={pageStyle}><p style={{ color: 'red' }}>{error}</p></div>;
  if (!data) return null;

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>📊 使用統計</h1>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <StatCard title="今日活躍用戶" value={data.today.activeUsers} subtitle="過去 24 小時" />
        <StatCard title="本週活躍用戶" value={data.week.activeUsers} subtitle="過去 7 天" />
        <StatCard title="今日新帳號" value={data.today.newUsers} subtitle="首次登入" />
        <StatCard title="今日回訪" value={data.today.returningUsers} subtitle="非首次登入" />
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Top stocks */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>🔥 熱門股票 Top 10（30 天）</h2>
          {data.topStocks.length === 0 ? (
            <p style={{ color: '#888', fontSize: 13 }}>尚無資料</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1A1A1A', color: '#FFF' }}>
                  <th style={th}>#</th>
                  <th style={th}>股票</th>
                  <th style={th}>瀏覽次數</th>
                </tr>
              </thead>
              <tbody>
                {data.topStocks.map((s, i) => (
                  <tr key={s.symbol} style={{ background: i % 2 === 0 ? '#FFF' : '#F9F9F9' }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{s.symbol}</td>
                    <td style={td}>{s.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent logins */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>🕐 最近登入（10 筆）</h2>
          {data.recentLogins.length === 0 ? (
            <p style={{ color: '#888', fontSize: 13 }}>尚無紀錄</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1A1A1A', color: '#FFF' }}>
                  <th style={th}>Email</th>
                  <th style={th}>裝置</th>
                  <th style={th}>時間</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLogins.map((l, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#FFF' : '#F9F9F9' }}>
                    <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.email}
                    </td>
                    <td style={td}>{DEVICE_ICON[l.device] || '❓'} {l.device}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>
                      {new Date(l.createdAt).toLocaleString('zh-TW')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: number; subtitle: string }) {
  return (
    <div
      style={{
        background: '#FFF',
        border: '1px solid #E0E0E0',
        borderRadius: 8,
        padding: '20px 24px',
        minWidth: 160,
        flex: '1 1 160px',
      }}
    >
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: '#AAA' }}>{subtitle}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  fontFamily: "'Noto Sans TC', sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: '#FFF',
  border: '1px solid #E0E0E0',
  borderRadius: 8,
  padding: 20,
  flex: '1 1 300px',
  minWidth: 280,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 14,
  marginTop: 0,
};

const th: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '7px 12px',
  borderBottom: '1px solid #EEE',
};
