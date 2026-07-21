'use client';

import { useEffect, useState, useMemo } from 'react';

interface Feedback {
  _id: string;
  type: 'feature' | 'stock' | 'general';
  message: string;
  email: string | null;
  createdAt: string;
  userAgent: string | null;
}

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  feature: { label: '功能建議', color: '#1d4ed8', bg: '#dbeafe' },
  stock:   { label: '股票情報', color: '#b91c1c', bg: '#fee2e2' },
  general: { label: '一般',     color: '#374151', bg: '#f3f4f6' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  const hh   = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function toDateInputValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function escapeCsvCell(val: string) {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks]   = useState<Feedback[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

  // 篩選狀態：預設本月
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate]   = useState(toDateInputValue(firstOfMonth));
  const [endDate, setEndDate]       = useState(toDateInputValue(now));
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/admin/feedback')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setFeedbacks(data.feedbacks);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // 篩選邏輯（純 client-side）
  const filtered = useMemo(() => {
    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end   = endDate   ? new Date(endDate   + 'T23:59:59') : null;
    return feedbacks.filter(fb => {
      const d = new Date(fb.createdAt);
      if (start && d < start) return false;
      if (end   && d > end)   return false;
      if (typeFilter !== 'all' && fb.type !== typeFilter) return false;
      return true;
    });
  }, [feedbacks, startDate, endDate, typeFilter]);

  // 統計
  const stats = useMemo(() => {
    const counts: Record<string, number> = { feature: 0, stock: 0, general: 0 };
    filtered.forEach(fb => { counts[fb.type] = (counts[fb.type] ?? 0) + 1; });
    return counts;
  }, [filtered]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const BOM = '\uFEFF';
    const header = ['時間', 'Email', '類型', '留言內容'].join(',');
    const rows = filtered.map(fb => [
      escapeCsvCell(formatDate(fb.createdAt)),
      escapeCsvCell(fb.email ?? '匿名'),
      escapeCsvCell(TYPE_LABELS[fb.type]?.label ?? fb.type),
      escapeCsvCell(fb.message),
    ].join(','));
    const csv = BOM + [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const rangeLabel = `${startDate}_${endDate}`;
    a.href     = url;
    a.download = `feedback_${rangeLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* 標題 */}
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: '#111' }}>
        💬 用戶留言
      </h1>

      {/* 篩選列 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
        padding: '16px 18px', backgroundColor: '#f9fafb', borderRadius: 10,
        border: '1px solid #e5e7eb', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>開始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, color: '#111' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>結束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, color: '#111' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>類型</label>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, color: '#111', backgroundColor: '#fff' }}
          >
            <option value="all">全部類型</option>
            <option value="feature">功能建議</option>
            <option value="stock">股票情報</option>
            <option value="general">一般</option>
          </select>
        </div>

        {/* 快捷按鈕 */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
          {[
            { label: '本月', fn: () => { const n = new Date(); setStartDate(toDateInputValue(new Date(n.getFullYear(), n.getMonth(), 1))); setEndDate(toDateInputValue(n)); } },
            { label: '上月', fn: () => { const n = new Date(); const f = new Date(n.getFullYear(), n.getMonth() - 1, 1); const l = new Date(n.getFullYear(), n.getMonth(), 0); setStartDate(toDateInputValue(f)); setEndDate(toDateInputValue(l)); } },
            { label: '全部', fn: () => { setStartDate('2024-01-01'); setEndDate(toDateInputValue(new Date())); } },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.fn}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, backgroundColor: '#fff', cursor: 'pointer', color: '#374151' }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* 匯出按鈕 */}
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          style={{
            marginLeft: 'auto', padding: '8px 18px', borderRadius: 7, border: 'none',
            backgroundColor: filtered.length === 0 ? '#d1d5db' : '#1d4ed8',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          ⬇ 匯出 CSV（{filtered.length} 筆）
        </button>
      </div>

      {/* 統計摘要 */}
      {!loading && !error && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <StatChip label="合計" count={filtered.length} color="#374151" bg="#f3f4f6" />
          <StatChip label="功能建議" count={stats.feature} color="#1d4ed8" bg="#dbeafe" />
          <StatChip label="股票情報" count={stats.stock}   color="#b91c1c" bg="#fee2e2" />
          <StatChip label="一般"     count={stats.general} color="#374151" bg="#f3f4f6" />
        </div>
      )}

      {loading && <p style={{ color: '#888' }}>載入中…</p>}
      {error   && <p style={{ color: '#dc2626' }}>錯誤：{error}</p>}

      {/* 表格 */}
      {!loading && !error && (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>時間</th>
                <th style={{ padding: '10px 14px', color: '#6b7280', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '10px 14px', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>類型</th>
                <th style={{ padding: '10px 14px', color: '#6b7280', fontWeight: 600 }}>留言內容</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px 14px', color: '#9ca3af', textAlign: 'center' }}>
                    此區間沒有留言
                  </td>
                </tr>
              )}
              {filtered.map(fb => {
                const isOpen   = expanded.has(fb._id);
                const typeInfo = TYPE_LABELS[fb.type] ?? TYPE_LABELS.general;
                const preview  = fb.message.length > 200 ? fb.message.slice(0, 200) + '…' : fb.message;
                return (
                  <tr
                    key={fb._id}
                    onClick={() => toggleExpand(fb._id)}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      backgroundColor: isOpen ? '#f9fafb' : '#fff',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f9fafb'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = isOpen ? '#f9fafb' : '#fff'; }}
                  >
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>
                      {formatDate(fb.createdAt)}
                    </td>
                    <td style={{ padding: '10px 14px', color: fb.email ? '#374151' : '#9ca3af', fontStyle: fb.email ? 'normal' : 'italic', whiteSpace: 'nowrap' }}>
                      {fb.email ?? '匿名'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        fontSize: 12, fontWeight: 600,
                        color: typeInfo.color, backgroundColor: typeInfo.bg, whiteSpace: 'nowrap',
                      }}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 600 }}>
                      {isOpen ? fb.message : preview}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, backgroundColor: bg }}>
      <span style={{ fontSize: 13, color, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color, fontWeight: 700 }}>{count}</span>
    </div>
  );
}
