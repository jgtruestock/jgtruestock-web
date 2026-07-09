'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsData {
  today: { activeUsers: number; newUsers: number; returningUsers: number };
  week: { activeUsers: number };
  topStocks: { symbol: string; count: number }[];
  recentLogins: { email: string; device: string; ip: string; createdAt: string }[];
  dailyTrend: { date: string; count: number }[];
  todayEventCount: number;
}

interface ActivityEvent {
  _id: string;
  email: string;
  type: string;
  page: string;
  symbol?: string;
  createdAt: string;
}

interface TopStock {
  symbol: string;
  viewCount: number;
  uniqueUsers: number;
}

interface UserSummary {
  totalLogins: number;
  firstSeen: string | null;
  lastSeen: string | null;
  totalEvents: number;
  topStocks: string[];
}

interface FeedbackItem {
  _id: string;
  email: string;
  type: string;
  message: string;
  createdAt: string;
}

const DEVICE_ICON: Record<string, string> = { mobile: '📱', tablet: '📟', desktop: '💻' };
const TYPE_COLOR: Record<string, string> = {
  page_view: '#3B82F6',
  stock_view: '#10B981',
  btn_click: '#F59E0B',
  feedback: '#8B5CF6',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLOR[type] || '#888';
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}55`,
      borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600,
    }}>
      {type}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={pageStyle}><p style={{ color: '#888' }}>載入中...</p></div>;
  if (error) return <div style={pageStyle}><p style={{ color: 'red' }}>{error}</p></div>;
  if (!data) return null;

  const TABS = ['📊 總覽', '🖱 頁面行為', '🔥 股票排行', '👤 用戶追蹤', '💬 Feedback'];

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>📊 使用統計</h1>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #E5E7EB' }}>
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none',
              background: 'none', cursor: 'pointer', borderBottom: activeTab === i ? '2px solid #1A1A1A' : '2px solid transparent',
              color: activeTab === i ? '#1A1A1A' : '#888', marginBottom: -2,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && <OverviewTab data={data} />}
      {activeTab === 1 && <ActivityTab />}
      {activeTab === 2 && <TopStocksTab />}
      {activeTab === 3 && <UserTrackerTab />}
      {activeTab === 4 && <FeedbackTab />}
    </div>
  );
}

// ─── Tab 1: Overview ──────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: StatsData }) {
  const maxTrend = Math.max(...(data.dailyTrend?.map(d => d.count) ?? [1]), 1);

  return (
    <div>
      {/* Stat Cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard title="今日活躍用戶" value={data.today.activeUsers} subtitle="過去 24 小時" />
        <StatCard title="本週活躍用戶" value={data.week.activeUsers} subtitle="過去 7 天" />
        <StatCard title="今日新帳號" value={data.today.newUsers} subtitle="首次登入" />
        <StatCard title="今日回訪" value={data.today.returningUsers} subtitle="非首次登入" />
        <StatCard title="今日總瀏覽" value={data.todayEventCount ?? 0} subtitle="頁面 + 股票" />
      </div>

      {/* Daily Login Trend */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h2 style={sectionTitle}>📈 每日登入趨勢（30 天）</h2>
        {(data.dailyTrend?.length ?? 0) === 0 ? (
          <p style={{ color: '#888', fontSize: 13 }}>尚無資料</p>
        ) : (
          <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {data.dailyTrend.map((d) => {
              const pct = Math.round((d.count / maxTrend) * 100);
              const dateShort = d.date.slice(5).replace('-', '/'); // MM/DD
              return (
                <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 40, color: '#888', flexShrink: 0 }}>{dateShort}</span>
                  <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 2, height: 14, position: 'relative' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', background: '#3B82F6',
                      borderRadius: 2, minWidth: d.count > 0 ? 4 : 0,
                    }} />
                  </div>
                  <span style={{ width: 28, textAlign: 'right', color: '#374151', flexShrink: 0 }}>{d.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Logins */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>🕐 最近登入（20 筆）</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1A1A1A', color: '#FFF' }}>
                <th style={th}>Email</th>
                <th style={th}>裝置</th>
                <th style={th}>IP</th>
                <th style={th}>時間</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLogins.map((l, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#FFF' : '#F9F9F9' }}>
                  <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email}</td>
                  <td style={td}>{DEVICE_ICON[l.device] || '❓'} {l.device}</td>
                  <td style={{ ...td, color: '#888', fontSize: 11 }}>{l.ip || '-'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{fmtTime(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Activity ──────────────────────────────────────────────────────────

function ActivityTab() {
  const [days, setDays] = useState(7);
  const [type, setType] = useState('all');
  const [email, setEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ events: ActivityEvent[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const pageSize = 30;

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({
      page: String(page), pageSize: String(pageSize),
      type, email: email || '', days: String(days),
    });
    fetch(`/api/admin/stats/activity?${p}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, type, email, days]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 7, 30].map(d => (
            <FilterBtn key={d} active={days === d} onClick={() => { setDays(d); setPage(1); }}>
              {d === 1 ? '今日' : d === 7 ? '7天' : '30天'}
            </FilterBtn>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'page_view', 'stock_view'].map(t => (
            <FilterBtn key={t} active={type === t} onClick={() => { setType(t); setPage(1); }}>
              {t === 'all' ? '全部' : t}
            </FilterBtn>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setEmail(emailInput); setPage(1); } }}
            placeholder="Email 搜尋..."
            style={{ ...inputStyle, width: 200 }}
          />
          <button onClick={() => { setEmail(emailInput); setPage(1); }} style={btnStyle}>搜尋</button>
          {email && <button onClick={() => { setEmail(''); setEmailInput(''); setPage(1); }} style={{ ...btnStyle, background: '#EEE', color: '#666' }}>清除</button>}
        </div>
        <span style={{ color: '#888', fontSize: 12 }}>共 {data?.total ?? 0} 筆</span>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        {loading ? <p style={{ color: '#888', fontSize: 13 }}>載入中...</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1A1A1A', color: '#FFF' }}>
                  <th style={th}>#</th>
                  <th style={th}>時間</th>
                  <th style={th}>Email</th>
                  <th style={th}>類型</th>
                  <th style={th}>頁面/股票</th>
                </tr>
              </thead>
              <tbody>
                {(data?.events ?? []).map((e, i) => (
                  <tr key={e._id || i} style={{ background: i % 2 === 0 ? '#FFF' : '#F9F9F9' }}>
                    <td style={{ ...td, color: '#AAA', fontSize: 11 }}>{(page - 1) * pageSize + i + 1}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{fmtTime(e.createdAt)}</td>
                    <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.email}</td>
                    <td style={td}><TypeBadge type={e.type} /></td>
                    <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#555', fontSize: 12 }}>
                      {e.symbol ? `$${e.symbol}` : e.page}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.events ?? []).length === 0 && <p style={{ color: '#888', fontSize: 13, padding: 12 }}>無資料</p>}
          </div>
        )}
        <Pagination page={page} total={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

// ─── Tab 3: Top Stocks ────────────────────────────────────────────────────────

function TopStocksTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{ stocks: TopStock[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/stats/top-stocks?days=${days}&limit=20`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [days]);

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[7, 30, 0].map(d => (
          <FilterBtn key={d} active={days === d} onClick={() => setDays(d)}>
            {d === 7 ? '7天' : d === 30 ? '30天' : '全部'}
          </FilterBtn>
        ))}
      </div>

      <div style={cardStyle}>
        <h2 style={sectionTitle}>🔥 熱門股票 Top 20</h2>
        {loading ? <p style={{ color: '#888', fontSize: 13 }}>載入中...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1A1A1A', color: '#FFF' }}>
                <th style={th}>排名</th>
                <th style={th}>股票代號</th>
                <th style={th}>瀏覽次數</th>
                <th style={th}>瀏覽人數</th>
              </tr>
            </thead>
            <tbody>
              {(data?.stocks ?? []).map((s, i) => (
                <tr key={s.symbol} style={{ background: i % 2 === 0 ? '#FFF' : '#F9F9F9' }}>
                  <td style={{ ...td, fontSize: 16 }}>{MEDALS[i] ?? i + 1}</td>
                  <td style={{ ...td, fontWeight: 700, color: '#1A1A1A' }}>{s.symbol}</td>
                  <td style={td}>{s.viewCount.toLocaleString()}</td>
                  <td style={{ ...td, color: '#555' }}>{s.uniqueUsers}</td>
                </tr>
              ))}
              {(data?.stocks ?? []).length === 0 && (
                <tr><td colSpan={4} style={{ ...td, color: '#888', textAlign: 'center' }}>無資料</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Tab 4: User Tracker ──────────────────────────────────────────────────────

function UserTrackerTab() {
  const [emailInput, setEmailInput] = useState('');
  const [email, setEmail] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ summary: UserSummary; events: ActivityEvent[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const pageSize = 30;

  const search = () => {
    if (!emailInput.trim()) return;
    setEmail(emailInput.trim());
    setPage(1);
  };

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    setErr('');
    fetch(`/api/admin/stats/user-activity?email=${encodeURIComponent(email)}&page=${page}&pageSize=${pageSize}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d); })
      .catch(() => setErr('Network error'))
      .finally(() => setLoading(false));
  }, [email, page]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={emailInput}
          onChange={e => setEmailInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="輸入 Email..."
          style={{ ...inputStyle, width: 280 }}
        />
        <button onClick={search} style={btnStyle}>搜尋</button>
      </div>

      {err && <p style={{ color: 'red', fontSize: 13 }}>{err}</p>}
      {loading && <p style={{ color: '#888', fontSize: 13 }}>載入中...</p>}

      {data && !loading && (
        <>
          {/* Summary Card */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <h2 style={sectionTitle}>👤 {email}</h2>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              <div><span style={{ color: '#888' }}>首次出現：</span>{data.summary.firstSeen ? fmtTime(data.summary.firstSeen) : '-'}</div>
              <div><span style={{ color: '#888' }}>最後活動：</span>{data.summary.lastSeen ? fmtTime(data.summary.lastSeen) : '-'}</div>
              <div><span style={{ color: '#888' }}>登入次數：</span><b>{data.summary.totalLogins}</b></div>
              <div><span style={{ color: '#888' }}>總事件：</span><b>{data.summary.totalEvents}</b></div>
              {data.summary.topStocks.length > 0 && (
                <div><span style={{ color: '#888' }}>常看股票：</span>{data.summary.topStocks.map(s => <span key={s} style={{ marginRight: 6, color: '#10B981', fontWeight: 600 }}>${s}</span>)}</div>
              )}
            </div>
          </div>

          {/* Events Table */}
          <div style={cardStyle}>
            <h2 style={sectionTitle}>行為歷史（共 {data.total} 筆）</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#1A1A1A', color: '#FFF' }}>
                    <th style={th}>時間</th>
                    <th style={th}>類型</th>
                    <th style={th}>頁面/股票</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e, i) => (
                    <tr key={e._id || i} style={{ background: i % 2 === 0 ? '#FFF' : '#F9F9F9' }}>
                      <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{fmtTime(e.createdAt)}</td>
                      <td style={td}><TypeBadge type={e.type} /></td>
                      <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#555', fontSize: 12 }}>
                        {e.symbol ? `$${e.symbol}` : e.page}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab 5: Feedback ──────────────────────────────────────────────────────────

function FeedbackTab() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ events: FeedbackItem[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const pageSize = 30;

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize), type: 'feedback', days: '365' });
    fetch(`/api/admin/stats/activity?${p}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;
  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div style={cardStyle}>
      <h2 style={sectionTitle}>💬 用戶 Feedback</h2>
      {loading ? <p style={{ color: '#888', fontSize: 13 }}>載入中...</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1A1A1A', color: '#FFF' }}>
                <th style={th}>時間</th>
                <th style={th}>Email</th>
                <th style={th}>類型</th>
                <th style={th}>內容</th>
              </tr>
            </thead>
            <tbody>
              {(data?.events ?? []).map((f, i) => {
                const id = f._id || String(i);
                const isExp = expanded.has(id);
                const msg = (f as any).meta?.message || f.message || f.page || '';
                return (
                  <tr key={id} style={{ background: i % 2 === 0 ? '#FFF' : '#F9F9F9' }}>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{fmtTime(f.createdAt)}</td>
                    <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.email}</td>
                    <td style={td}><TypeBadge type={f.type} /></td>
                    <td style={td}>
                      <span style={{ color: '#374151' }}>
                        {isExp ? msg : msg.slice(0, 100) + (msg.length > 100 ? '...' : '')}
                      </span>
                      {msg.length > 100 && (
                        <button onClick={() => toggleExpand(id)} style={{ marginLeft: 6, fontSize: 11, color: '#3B82F6', border: 'none', background: 'none', cursor: 'pointer' }}>
                          {isExp ? '收起' : '展開'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(data?.events ?? []).length === 0 && (
                <tr><td colSpan={4} style={{ ...td, color: '#888', textAlign: 'center' }}>無 Feedback 資料</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={totalPages} onChange={setPage} />
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle }: { title: string; value: number; subtitle: string }) {
  return (
    <div style={{
      background: '#FFF', border: '1px solid #E0E0E0', borderRadius: 8,
      padding: '20px 24px', minWidth: 160, flex: '1 1 160px',
    }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: '#AAA' }}>{subtitle}</div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
      border: `1px solid ${active ? '#1A1A1A' : '#DDD'}`,
      background: active ? '#1A1A1A' : '#FFF',
      color: active ? '#FFF' : '#555',
    }}>
      {children}
    </button>
  );
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14, alignItems: 'center' }}>
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} style={pageBtnStyle(page <= 1)}>‹</button>
      <span style={{ fontSize: 12, color: '#555' }}>{page} / {total}</span>
      <button disabled={page >= total} onClick={() => onChange(page + 1)} style={pageBtnStyle(page >= total)}>›</button>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = { padding: 24, fontFamily: "'Noto Sans TC', sans-serif" };

const cardStyle: React.CSSProperties = {
  background: '#FFF', border: '1px solid #E0E0E0', borderRadius: 8, padding: 20,
};

const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 600, marginBottom: 14, marginTop: 0 };

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' };

const td: React.CSSProperties = { padding: '7px 12px', borderBottom: '1px solid #EEE' };

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 13, border: '1px solid #DDD', borderRadius: 6,
  outline: 'none', fontFamily: 'inherit',
};

const btnStyle: React.CSSProperties = {
  padding: '6px 14px', fontSize: 13, fontWeight: 600, background: '#1A1A1A', color: '#FFF',
  border: 'none', borderRadius: 6, cursor: 'pointer',
};

const pageBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '4px 12px', fontSize: 16, border: '1px solid #DDD', borderRadius: 4,
  background: disabled ? '#F5F5F5' : '#FFF', color: disabled ? '#CCC' : '#333',
  cursor: disabled ? 'default' : 'pointer',
});
