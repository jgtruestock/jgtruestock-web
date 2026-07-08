'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Member {
  _id: string;
  channelId: string;
  channelName: string;
  tier: string;
  status: string;
  importedAt: string;
  updatedAt: string;
}

interface MemberStat {
  userId: string;
  userEmail: string;
  totalViews: number;
  lastSeen: string;
  topStocks: string[];
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<MemberStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'activity'>('members');
  const [importResult, setImportResult] = useState<{
    imported?: number;
    updated?: number;
    errors?: string[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/members');
      const data = await res.json();
      if (data.members) setMembers(data.members);
      else setError(data.error || 'Failed to load');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/members/stats');
      const data = await res.json();
      if (data.stats) setStats(data.stats);
      else setStatsError(data.error || 'Failed to load stats');
    } catch {
      setStatsError('Network error');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
    fetchStats();
  }, [fetchMembers, fetchStats]);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      alert('請選擇 CSV 檔案');
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/members/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setImportResult(data);
      fetchMembers();
    } catch {
      setImportResult({ errors: ['Network error'] });
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(channelId: string) {
    if (!confirm(`確定刪除 ${channelId}？`)) return;
    setDeletingId(channelId);
    try {
      const res = await fetch(
        `/api/admin/members?channelId=${encodeURIComponent(channelId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.ok) {
        setMembers((prev) => prev.filter((m) => m.channelId !== channelId));
      } else {
        alert(data.error || 'Delete failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "'Noto Sans TC', sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        YT 會員管理
      </h1>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #E0E0E0' }}>
        {(['members', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #1A1A1A' : '2px solid transparent',
              fontWeight: activeTab === tab ? 700 : 400,
              fontSize: 14,
              cursor: 'pointer',
              color: activeTab === tab ? '#1A1A1A' : '#888',
            }}
          >
            {tab === 'members' ? '📋 會員列表' : '📊 會員動態'}
          </button>
        ))}
      </div>

      {activeTab === 'activity' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>會員瀏覽統計</h2>
          {statsLoading ? (
            <p>載入中...</p>
          ) : statsError ? (
            <p style={{ color: 'red' }}>{statsError}</p>
          ) : stats.length === 0 ? (
            <p style={{ color: '#888' }}>尚無紀錄</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#1A1A1A', color: '#FFF' }}>
                    <th style={th}>Email</th>
                    <th style={th}>總瀏覽數</th>
                    <th style={th}>最後上線</th>
                    <th style={th}>常看股票</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={s.userId} style={{ background: i % 2 === 0 ? '#FFF' : '#F9F9F9' }}>
                      <td style={td}>{s.userEmail}</td>
                      <td style={td}>{s.totalViews}</td>
                      <td style={td}>
                        {s.lastSeen ? new Date(s.lastSeen).toLocaleString('zh-TW') : '-'}
                      </td>
                      <td style={td}>
                        {s.topStocks.length > 0 ? s.topStocks.join(', ') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <>
      {/* Import section — only shown when members tab is active */}
      <div
        style={{
          background: '#F8F8F8',
          border: '1px solid #E0E0E0',
          borderRadius: 6,
          padding: '20px 24px',
          marginBottom: 28,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          匯入 CSV
        </h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept=".csv" ref={fileRef} />
          <button
            onClick={handleImport}
            disabled={importing}
            style={{
              padding: '8px 20px',
              background: '#1A1A1A',
              color: '#FFF',
              border: 'none',
              cursor: importing ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 4,
            }}
          >
            {importing ? '匯入中...' : '開始匯入'}
          </button>
        </div>

        {importResult && (
          <div style={{ marginTop: 12 }}>
            {importResult.imported !== undefined && (
              <p style={{ color: '#2D7D46', fontSize: 13 }}>
                ✅ 新增 {importResult.imported} 筆，更新 {importResult.updated} 筆
              </p>
            )}
            {importResult.errors && importResult.errors.length > 0 && (
              <div
                style={{
                  background: '#FFF3CD',
                  border: '1px solid #FFEAA7',
                  borderRadius: 4,
                  padding: 10,
                  marginTop: 8,
                  maxHeight: 160,
                  overflowY: 'auto',
                }}
              >
                {importResult.errors.map((e, i) => (
                  <p key={i} style={{ fontSize: 12, color: '#856404', margin: '2px 0' }}>
                    {e}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Members table */}
      {loading ? (
        <p>載入中...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            共 {members.length} 位會員
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: '#1A1A1A', color: '#FFF' }}>
                  <th style={th}>名稱</th>
                  <th style={th}>Channel ID</th>
                  <th style={th}>方案</th>
                  <th style={th}>狀態</th>
                  <th style={th}>匯入時間</th>
                  <th style={th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr
                    key={m.channelId}
                    style={{ background: i % 2 === 0 ? '#FFF' : '#F9F9F9' }}
                  >
                    <td style={td}>{m.channelName}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>
                      <a
                        href={`https://www.youtube.com/channel/${m.channelId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#D93025' }}
                      >
                        {m.channelId}
                      </a>
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          background: m.tier === '450' ? '#D93025' : '#4285F4',
                          color: '#FFF',
                          padding: '2px 8px',
                          borderRadius: 3,
                          fontSize: 11,
                        }}
                      >
                        {m.tier} 元
                      </span>
                    </td>
                    <td style={td}>{m.status}</td>
                    <td style={td}>
                      {m.importedAt
                        ? new Date(m.importedAt).toLocaleDateString('zh-TW')
                        : '-'}
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => handleDelete(m.channelId)}
                        disabled={deletingId === m.channelId}
                        style={{
                          padding: '3px 10px',
                          background: '#DC3545',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: 3,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #EEE',
};
