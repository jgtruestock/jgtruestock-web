'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface MentionRecord {
  _id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  mentionDate: string;
  priceAtMention: number;
  currentPrice: number;
  gainPct: number;
  mentionCount: number;
}

interface Stats {
  total: number;
  avgGainPct: number;
  positiveCount: number;
  positiveRate: number;
}

type SortKey = 'gainPct' | 'mentionDate' | 'symbol';

export default function StocksPage() {
  // Auth temporarily disabled for preview — TODO: re-enable before production
  // const { data: session, status } = useSession();
  const router = useRouter();
  const [records, setRecords] = useState<MentionRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('gainPct');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/mentions?sort=${sortKey}&order=${sortOrder}`);
      const data = await res.json();
      setRecords(data.records || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Failed to fetch mentions:', err);
    } finally {
      setLoading(false);
    }
  }, [sortKey, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateStr: string) => {
    return dateStr.slice(0, 10);
  };

  const formatGain = (pct: number) => {
    const pos = pct >= 0;
    const arrow = pos ? '▲' : '▼';
    const sign = pos ? '+' : '';
    return { label: `${arrow}${sign}${pct.toFixed(1)}%`, pos };
  };

  if (loading && records.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888', fontSize: 14 }}>載入中...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <Navbar />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 48px' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 22,
              fontWeight: 700,
              color: '#1A1A1A',
              letterSpacing: 0.5,
            }}
          >
            JG 提股記錄
          </h1>
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            JG 在會員頻道提到過的每一支股票，提到後的表現
          </p>
        </div>

        {/* Stats bar + Sort */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {stats && (
            <div style={{ fontSize: 12, color: '#666' }}>
              <span>共 {stats.total} 支</span>
              <span style={{ color: '#CCC', margin: '0 6px' }}>｜</span>
              <span>
                平均漲幅{' '}
                <span style={{ color: stats.avgGainPct >= 0 ? '#1A7340' : '#C0392B', fontWeight: 600 }}>
                  {stats.avgGainPct >= 0 ? '+' : ''}{stats.avgGainPct}%
                </span>
              </span>
              <span style={{ color: '#CCC', margin: '0 6px' }}>｜</span>
              <span>正報酬 {stats.positiveRate}%</span>
              <span style={{ color: '#CCC', margin: '0 6px' }}>｜</span>
              <span>每日收盤後自動更新</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            <SortButton active={sortKey === 'gainPct'} onClick={() => handleSort('gainPct')}>
              漲幅 {sortKey === 'gainPct' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}
            </SortButton>
            <SortButton active={sortKey === 'mentionDate'} onClick={() => handleSort('mentionDate')}>
              最新日期
            </SortButton>
            <SortButton active={sortKey === 'symbol'} onClick={() => handleSort('symbol')}>
              字母
            </SortButton>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#888', fontSize: 14 }}>
            載入中...
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#888', fontSize: 14 }}>
            目前尚無提股記錄
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <table
              className="stock-table"
              style={{ width: '100%', borderCollapse: 'collapse' }}
            >
              <thead>
                <tr>
                  {['代號', '公司名稱', '次數', '提到日期', '當時股價', '今日股價', '漲幅', ''].map(
                    (h, i) => (
                      <th
                        key={i}
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: '#999',
                          textAlign: i >= 4 && i <= 6 ? 'right' : i === 2 ? 'center' : 'left',
                          padding: '6px 8px',
                          borderBottom: '2px solid #E0DCD6',
                          whiteSpace: 'nowrap',
                          letterSpacing: 0.3,
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const gain = formatGain(rec.gainPct);
                  return (
                    <tr
                      key={rec._id}
                      style={{
                        borderBottom: '1px solid #EDEBE6',
                        cursor: navigating === rec.symbol ? 'wait' : 'pointer',
                        background: navigating === rec.symbol ? '#F5E6D0' : undefined,
                        opacity: navigating && navigating !== rec.symbol ? 0.5 : 1,
                        transition: 'background 0.1s, opacity 0.1s',
                      }}
                      onClick={() => { setNavigating(rec.symbol); router.push(`/stocks/${rec.symbol}`); }}
                      onMouseEnter={(e) => {
                        if (!navigating) (e.currentTarget as HTMLTableRowElement).style.background = '#F0EDE8';
                      }}
                      onMouseLeave={(e) => {
                        if (!navigating) (e.currentTarget as HTMLTableRowElement).style.background = '';
                      }}
                    >
                      <td
                        style={{
                          padding: '10px 8px',
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#D93025',
                          letterSpacing: 0.5,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rec.symbol}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          fontSize: 12,
                          color: '#888',
                          maxWidth: 160,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rec.companyName}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            background: '#F0EDE8',
                            color: '#555',
                            fontSize: 12,
                            fontWeight: 500,
                            padding: '1px 8px',
                            borderRadius: 2,
                          }}
                        >
                          {rec.mentionCount}次
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          fontSize: 13,
                          color: '#666',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDate(rec.mentionDate)}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          fontSize: 13,
                          fontVariantNumeric: 'tabular-nums',
                          color: '#444',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ${rec.priceAtMention.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          fontSize: 13,
                          fontVariantNumeric: 'tabular-nums',
                          color: '#444',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ${rec.currentPrice.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          fontSize: 13,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: gain.pos ? '#1A7340' : '#C0392B',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {gain.label}
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          textAlign: 'center',
                          width: 56,
                        }}
                      >
                        <span style={{
                          display: 'inline-block',
                          background: navigating === rec.symbol ? '#C0392B' : '#E8E3DC',
                          color: navigating === rec.symbol ? '#fff' : '#555',
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 4,
                          whiteSpace: 'nowrap',
                          transition: 'background 0.1s',
                        }}>
                          {navigating === rec.symbol ? '載入中...' : '查看 →'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile List */}
            <div className="stock-list-mobile">
              {records.map((rec) => {
                const gain = formatGain(rec.gainPct);
                return (
                  <div
                    key={rec._id}
                    style={{
                      borderBottom: '1px solid #EDEBE6',
                      padding: '10px 6px',
                      cursor: 'pointer',
                    }}
                    onClick={() => router.push(`/stocks/${rec.symbol}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#D93025',
                          minWidth: 56,
                        }}
                      >
                        {rec.symbol}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: '#555',
                          background: '#F0EDE8',
                          padding: '0 6px',
                          borderRadius: 2,
                        }}
                      >
                        {rec.mentionCount}次
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: '#888',
                          fontVariantNumeric: 'tabular-nums',
                          flex: 1,
                          textAlign: 'right',
                          marginRight: 8,
                        }}
                      >
                        {formatDate(rec.mentionDate)}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: gain.pos ? '#1A7340' : '#C0392B',
                          minWidth: 72,
                          textAlign: 'right',
                        }}
                      >
                        {gain.label}
                      </span>
                      <span style={{ color: '#BBB', fontSize: 13, marginLeft: 6 }}>→</span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#999',
                        marginTop: 3,
                        paddingLeft: 2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {rec.companyName} · ${rec.priceAtMention.toFixed(2)} → $
                      {rec.currentPrice.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .stock-table { display: table; }
        .stock-list-mobile { display: none; }

        @media (max-width: 768px) {
          .stock-table { display: none !important; }
          .stock-list-mobile { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Noto Sans TC', sans-serif",
        fontSize: 11,
        padding: '3px 10px',
        border: '1px solid #D5D0C8',
        background: active ? '#2D2D2D' : '#FAFAF8',
        color: active ? '#FAFAF8' : '#555',
        cursor: 'pointer',
        transition: 'all 0.15s',
        borderRadius: 0,
      }}
    >
      {children}
    </button>
  );
}
