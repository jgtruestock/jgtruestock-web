'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface CommentaryRecord {
  symbol: string;
  companyName: string;
  mentionDate: string | null;
  status: 'draft' | 'published' | 'stale' | null;
  draftGeneratedAt: string | null;
  publishedAt: string | null;
  draftTitle: string | null;
  publishedTitle: string | null;
  updatedAt: string | null;
}

interface Stats {
  total: number;
  published: number;
  draft: number;
  stale: number;
  none: number;
}

const STATUS_COLORS: Record<string, string> = {
  published: '#1A7340',
  draft: '#c9a84c',
  stale: '#E67E22',
};

const STATUS_LABELS: Record<string, string> = {
  published: '已發布',
  draft: '草稿',
  stale: '待更新',
};

function StatusDot({ status }: { status: string | null }) {
  const color = status ? (STATUS_COLORS[status] ?? '#999') : '#ccc';
  const label = status ? (STATUS_LABELS[status] ?? status) : '無';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ color, fontWeight: 500 }}>{label}</span>
    </span>
  );
}

export default function AdminCommentaryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [records, setRecords] = useState<CommentaryRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'stale' | 'none'>('all');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingStatus, setGeneratingStatus] = useState<string>('');
  const [message, setMessage] = useState('');

  const discordId = (session?.user as any)?.discordId;
  const email = (session?.user as any)?.email?.toLowerCase();
  const adminId = process.env.NEXT_PUBLIC_ADMIN_DISCORD_ID;
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'jgdady@gmail.com').toLowerCase();
  const userIsAdmin = (!!discordId && !!adminId && discordId === adminId) || email === adminEmail;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/commentary');
      if (!res.ok) {
        if (res.status === 403) { router.push('/'); return; }
        throw new Error('failed');
      }
      const data = await res.json();
      setRecords(data.records ?? []);
      setStats(data.stats ?? null);
    } catch (err) {
      console.error('fetch commentary list:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, fetchData]);

  const filtered = records.filter((r) => {
    if (filter !== 'all') {
      if (filter === 'none' && r.status !== null) return false;
      if (filter !== 'none' && r.status !== filter) return false;
    }
    if (search) {
      return r.symbol.toLowerCase().includes(search.toLowerCase()) ||
        r.companyName?.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleGenerate = async (symbol: string) => {
    setGenerating(symbol);
    setGeneratingStatus('⏳ 排隊中...');
    setMessage('');
    try {
      // Step 1: 建立 async job
      const res = await fetch(`/api/admin/commentary/${symbol}/generate-async`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`❌ ${symbol} 建立任務失敗：${data.error ?? 'unknown'}`);
        return;
      }
      const { jobId } = data;

      // Step 2: 輪詢 job 狀態（每 3 秒，最多 3 分鐘）
      const maxWaitMs = 3 * 60 * 1000;
      const pollIntervalMs = 3000;
      const startTime = Date.now();

      while (true) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));

        if (Date.now() - startTime > maxWaitMs) {
          setMessage(`⏰ ${symbol} 逾時，請稍後重試`);
          return;
        }

        try {
          const statusRes = await fetch(`/api/admin/commentary/${symbol}/job-status?jobId=${jobId}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            setMessage(`✅ ${symbol} 草稿已生成：${statusData.result?.title ?? ''}`);
            await fetchData();
            return;
          } else if (statusData.status === 'failed') {
            setMessage(`❌ ${symbol} 生成失敗：${statusData.error ?? 'unknown'}`);
            return;
          } else if (statusData.status === 'processing') {
            setGeneratingStatus('⚙️ 生成中...');
          }
          // pending: 繼續等
        } catch (pollErr) {
          // 網路短暫錯誤，繼續輪詢
        }
      }
    } catch (err: any) {
      setMessage(`❌ ${symbol} 錯誤：${err?.message}`);
    } finally {
      setGenerating(null);
      setGeneratingStatus('');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F3EE' }}>
        <Navbar />
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>載入中...</div>
      </div>
    );
  }

  if (!userIsAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F3EE' }}>
        <Navbar />
        <div style={{ padding: 40, textAlign: 'center', color: '#c00' }}>無管理員權限</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EE' }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }}>
        {/* Header */}
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
          JG點評管理
        </h1>
        {stats && (
          <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
            已發布 {stats.published} ／ 草稿 {stats.draft} ／ 待更新 {stats.stale} ／ 無 {stats.none} ／ 共 {stats.total} 支
          </p>
        )}

        {/* Message */}
        {message && (
          <div
            style={{
              background: message.startsWith('✅') ? '#f0fff4' : '#fff5f5',
              border: `1px solid ${message.startsWith('✅') ? '#c6f6d5' : '#fed7d7'}`,
              borderRadius: 6,
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 14,
              color: message.startsWith('✅') ? '#276749' : '#c53030',
            }}
          >
            {message}
          </div>
        )}

        {/* Filters + Search */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          {(['all', 'draft', 'published', 'stale', 'none'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                background: filter === f ? '#1A1A1A' : '#E8E4DC',
                color: filter === f ? '#fff' : '#333',
                fontWeight: filter === f ? 600 : 400,
              }}
            >
              {f === 'all' ? '全部' : f === 'none' ? '無點評' : STATUS_LABELS[f]}
            </button>
          ))}
          <input
            type="text"
            placeholder="🔍 搜尋股票代號或公司"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              marginLeft: 'auto',
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #D5D0C5',
              fontSize: 13,
              width: 220,
              background: '#fff',
            }}
          />
        </div>

        {/* Table */}
        <style>{`
          @media (max-width: 640px) {
            .commentary-col-hide { display: none !important; }
            .commentary-row { cursor: pointer; }
            .commentary-row:active { background: #F0EDE8 !important; }
          }
        `}</style>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E4DC', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 340 }}>
            <thead>
              <tr style={{ background: '#F5F3EE', borderBottom: '1px solid #E8E4DC' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#666' }}>代號</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#666' }}>公司</th>
                <th className="commentary-col-hide" style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#666' }}>提股日</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#666' }}>狀態</th>
                <th className="commentary-col-hide" style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#666' }}>草稿時間</th>
                <th className="commentary-col-hide" style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#666' }}>發布時間</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#666' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#aaa' }}>
                    無資料
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => (
                <tr
                  key={r.symbol}
                  className="commentary-row"
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid #F0EDE6' : 'none',
                    background: i % 2 === 0 ? '#fff' : '#FAFAF8',
                    cursor: 'pointer',
                  }}
                  onClick={() => router.push(`/admin/commentary/${r.symbol}`)}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1A1A1A' }}>{r.symbol}</td>
                  <td style={{ padding: '12px 16px', color: '#333', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.companyName}
                  </td>
                  <td className="commentary-col-hide" style={{ padding: '12px 16px', color: '#666' }}>{r.mentionDate?.slice(0, 10) ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusDot status={r.status} />
                  </td>
                  <td className="commentary-col-hide" style={{ padding: '12px 16px', color: '#888', fontSize: 12 }}>
                    {r.draftGeneratedAt ? r.draftGeneratedAt.slice(0, 10) : '—'}
                  </td>
                  <td className="commentary-col-hide" style={{ padding: '12px 16px', color: '#888', fontSize: 12 }}>
                    {r.publishedAt ? r.publishedAt.slice(0, 10) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGenerate(r.symbol); }}
                        disabled={generating === r.symbol}
                        title="重新生成 AI 草稿"
                        style={{
                          padding: '5px 10px',
                          borderRadius: 5,
                          border: '1px solid #c9a84c',
                          background: generating === r.symbol ? '#f5f5f5' : '#fffbf0',
                          color: '#a07830',
                          cursor: generating === r.symbol ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {generating === r.symbol ? (generatingStatus || '⏳ 排隊中...') : '🤖 生成草稿'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/admin/commentary/${r.symbol}`); }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 5,
                          border: '1px solid #D5D0C5',
                          background: '#fff',
                          color: '#333',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        ✏️ 編輯
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
