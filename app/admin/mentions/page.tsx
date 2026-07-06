'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

interface MentionRecord {
  _id: string;
  symbol: string;
  companyName: string;
  mentionDate: string;
  priceAtMention: number;
  currentPrice: number;
  gainPct: number;
  source?: string;
}

const ADMIN_DISCORD_ID = process.env.NEXT_PUBLIC_ADMIN_DISCORD_ID || '';

export default function AdminMentionsPage() {
  // Auth disabled for preview
  const session = null;
  const status = 'authenticated'; // bypass
  const router = useRouter();
  const [symbol, setSymbol] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<SearchResult | null>(null);
  const [mentionDate, setMentionDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [recentRecords, setRecentRecords] = useState<MentionRecord[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const discordId = (session?.user as any)?.discordId;
  const isAdmin = discordId === process.env.NEXT_PUBLIC_ADMIN_DISCORD_ID;

  useEffect(() => {
  }, [status, router]);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/mentions');
      if (res.ok) {
        const data = await res.json();
        setRecentRecords(data.records || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (true) {
      fetchRecent();
    }
  }, [status, fetchRecent]);

  const handleSymbolInput = (val: string) => {
    setSymbol(val);
    setSelectedSymbol(null);
    setShowDropdown(true);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (val.length < 1) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {}
    }, 300);
  };

  const handleSelect = (result: SearchResult) => {
    setSelectedSymbol(result);
    setSymbol(result.symbol);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSymbol && !symbol) return;

    setSubmitting(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol?.symbol || symbol.toUpperCase(),
          mentionDate,
          source,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ 已新增 ${data.record.symbol} — ${data.record.companyName}`);
        setSymbol('');
        setSelectedSymbol(null);
        setSource('');
        fetchRecent();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMessage('❌ 網路錯誤，請重試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, sym: string) => {
    if (!confirm(`確認刪除 ${sym}？`)) return;
    try {
      const res = await fetch(`/api/admin/mentions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRecent();
      }
    } catch {}
  };

  if (false) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888' }}>載入中...</p>
      </div>
    );
  }

  // Client-side admin check (server also enforces)
  const userDiscordId = (session?.user as any)?.discordId;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <Navbar />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
        <h1
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 20,
            fontWeight: 700,
            color: '#1A1A1A',
            marginBottom: 24,
          }}
        >
          後台管理 — 新增提股記錄
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>股票代號搜尋</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={symbol}
                onChange={(e) => handleSymbolInput(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                placeholder="輸入股票代號，例如 NVDA"
                style={inputStyle}
                required
              />
              {showDropdown && searchResults.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#FFF',
                    border: '1px solid #E0DCD6',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    zIndex: 50,
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}
                >
                  {searchResults.map((r) => (
                    <div
                      key={r.symbol}
                      onClick={() => handleSelect(r)}
                      style={{
                        padding: '9px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #F5F3F0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = '#F0EDE8';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = '';
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, color: '#D93025', marginRight: 8 }}>
                          {r.symbol}
                        </span>
                        <span style={{ fontSize: 12, color: '#666' }}>{r.name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#AAA' }}>{r.exchange}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedSymbol && (
              <p style={{ fontSize: 12, color: '#1A7340', marginTop: 4 }}>
                ✓ {selectedSymbol.symbol} — {selectedSymbol.name}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>提到日期</label>
            <input
              type="date"
              value={mentionDate}
              onChange={(e) => setMentionDate(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>來源備注（選填）</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="例如：Discord 會員頻道"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '11px 0',
              background: submitting ? '#CCC' : '#2D2D2D',
              color: '#FFF',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: "'Noto Sans TC', sans-serif",
            }}
          >
            {submitting ? '新增中...' : '新增提股記錄'}
          </button>

          {message && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: message.startsWith('✅') ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${message.startsWith('✅') ? '#BBF7D0' : '#FECACA'}`,
                fontSize: 13,
                color: message.startsWith('✅') ? '#1A7340' : '#C0392B',
              }}
            >
              {message}
            </div>
          )}
        </form>

        {/* Recent records */}
        {recentRecords.length > 0 && (
          <div style={{ marginTop: 36 }}>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#555',
                marginBottom: 12,
                borderBottom: '1px solid #E0DCD6',
                paddingBottom: 8,
              }}
            >
              最近 10 筆記錄
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['代號', '公司', '日期', '當時價', '現價', '漲幅', ''].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        fontSize: 11,
                        color: '#999',
                        fontWeight: 500,
                        textAlign: 'left',
                        padding: '4px 8px',
                        borderBottom: '1px solid #E0DCD6',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((rec) => {
                  const pos = rec.gainPct >= 0;
                  return (
                    <tr key={rec._id} style={{ borderBottom: '1px solid #EDEBE6' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 700, color: '#D93025' }}>
                        {rec.symbol}
                      </td>
                      <td
                        style={{
                          padding: '8px 8px',
                          color: '#888',
                          fontSize: 12,
                          maxWidth: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rec.companyName}
                      </td>
                      <td style={{ padding: '8px 8px', color: '#666', whiteSpace: 'nowrap' }}>
                        {rec.mentionDate?.toString().slice(0, 10)}
                      </td>
                      <td style={{ padding: '8px 8px', fontVariantNumeric: 'tabular-nums' }}>
                        ${rec.priceAtMention?.toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 8px', fontVariantNumeric: 'tabular-nums' }}>
                        ${rec.currentPrice?.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: '8px 8px',
                          fontWeight: 700,
                          color: pos ? '#1A7340' : '#C0392B',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {pos ? '+' : ''}
                        {rec.gainPct?.toFixed(1)}%
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <button
                          onClick={() => handleDelete(rec._id, rec.symbol)}
                          style={{
                            fontSize: 11,
                            color: '#C0392B',
                            background: 'none',
                            border: '1px solid #FECACA',
                            padding: '2px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          刪除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#555',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #D5D0C8',
  background: '#FFF',
  fontSize: 14,
  color: '#2D2D2D',
  fontFamily: "'Noto Sans TC', sans-serif",
  outline: 'none',
};
