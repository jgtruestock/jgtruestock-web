'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ActivityTracker from '@/components/ActivityTracker';
import WelcomeModal from '@/components/WelcomeModal';

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
  lastUpdatedAt?: string | null;
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
      <div style={{ minHeight: '100vh', background: '#f0f3f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888', fontSize: 14 }}>載入中...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f3f2' }}>
      <WelcomeModal />
      <Navbar />
      <ActivityTracker page="/stocks" />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 48px' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '3px', color: '#c9a84c', textTransform: 'uppercase' }}>Member Exclusive</span>
              <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, #c9a84c, transparent)' }} />
            </div>
            <h1
              style={{
                fontFamily: "'Noto Serif TC', serif",
                fontSize: 24,
                fontWeight: 900,
                color: '#cc1a22',
                letterSpacing: 0.5,
                lineHeight: 1.3,
              }}
            >
              J派反市場資料庫
              <span style={{ display: 'block', fontSize: 15, fontWeight: 400, color: '#555', fontFamily: "'Noto Sans TC', sans-serif", marginTop: 4, letterSpacing: 0 }}>
                每天更新最新情報
              </span>
            </h1>
          </div>
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
              <span>共 <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 800, color: '#c9a84c' }}>{stats.total}</span> 支</span>
              <span style={{ color: '#CCC', margin: '0 6px' }}>｜</span>
              <span>
                平均漲幅{' '}
                <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 800, color: stats.avgGainPct >= 0 ? '#2e7d52' : '#c0392b' }}>
                  {stats.avgGainPct >= 0 ? '+' : ''}{stats.avgGainPct}%
                </span>
              </span>
              <span style={{ color: '#CCC', margin: '0 6px' }}>｜</span>
              <span>正報酬 <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 800, color: '#c9a84c' }}>{stats.positiveRate}%</span></span>
              <span style={{ color: '#CCC', margin: '0 6px' }}>｜</span>
              <span>每日收盤後自動更新</span>
              {stats?.lastUpdatedAt && (
                <>
                  <span style={{ color: '#CCC', margin: '0 6px' }}>｜</span>
                  <span style={{ fontSize: 12, color: '#999' }}>
                    股價更新：{stats.lastUpdatedAt.slice(0, 10)}
                  </span>
                </>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label
              htmlFor="sort-select"
              style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}
            >
              排序方式
            </label>
            <select
              id="sort-select"
              value={`${sortKey}:${sortOrder}`}
              onChange={(e) => {
                const [key, order] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
                setSortKey(key);
                setSortOrder(order);
              }}
              style={{
                fontFamily: "'Noto Sans TC', sans-serif",
                fontSize: 12,
                padding: '5px 28px 5px 10px',
                border: '1px solid #D5D0C8',
                borderRadius: 4,
                background: '#FFFFFF',
                color: '#333',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
              }}
            >
              <option value="gainPct:desc">漲幅（高→低）</option>
              <option value="gainPct:asc">漲幅（低→高）</option>
              <option value="mentionDate:desc">提到日期（最新→舊）</option>
              <option value="mentionDate:asc">提到日期（最舊→新）</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#888', fontSize: 14 }}>
            載入中...
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#888', fontSize: 14 }}>
            目前尚無追蹤記錄
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
                          fontFamily: "'Raleway', sans-serif",
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#cc1a22',
                          letterSpacing: '0.5px',
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
                          fontFamily: "'Raleway', sans-serif",
                          fontSize: 13,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: gain.pos ? '#2e7d52' : '#c0392b',
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
                          background: 'transparent',
                          color: navigating === rec.symbol ? '#cc1a22' : '#c9a84c',
                          border: navigating === rec.symbol ? '1px solid #cc1a22' : '1px solid #c9a84c',
                          fontFamily: "'Raleway', sans-serif",
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 4,
                          whiteSpace: 'nowrap',
                          transition: 'border-color 0.1s, color 0.1s',
                          letterSpacing: '0.5px',
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
                      cursor: navigating === rec.symbol ? 'wait' : 'pointer',
                      background: navigating === rec.symbol ? '#F5E6D0' : undefined,
                      opacity: navigating && navigating !== rec.symbol ? 0.5 : 1,
                    }}
                    onClick={() => { setNavigating(rec.symbol); router.push(`/stocks/${rec.symbol}`); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: "'Raleway', sans-serif",
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#cc1a22',
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
                          fontFamily: "'Raleway', sans-serif",
                          fontSize: 13,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: gain.pos ? '#2e7d52' : '#c0392b',
                          minWidth: 72,
                          textAlign: 'right',
                        }}
                      >
                        {gain.label}
                      </span>
                      <span style={{
                          display: 'inline-block',
                          background: 'transparent',
                          color: navigating === rec.symbol ? '#cc1a22' : '#c9a84c',
                          border: navigating === rec.symbol ? '1px solid #cc1a22' : '1px solid #c9a84c',
                          fontFamily: "'Raleway', sans-serif",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 4,
                          marginLeft: 6,
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.5px',
                        }}>
                          {navigating === rec.symbol ? '載入...' : '查看→'}
                        </span>
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


