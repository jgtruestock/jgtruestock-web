'use client';

import { useEffect, useState } from 'react';

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
  stock: { label: '股票情報', color: '#b91c1c', bg: '#fee2e2' },
  general: { label: '一般', color: '#374151', bg: '#f3f4f6' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/admin/feedback')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setFeedbacks(data.feedbacks);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#111' }}>
        💬 用戶留言
      </h1>

      {loading && <p style={{ color: '#888' }}>載入中…</p>}
      {error && <p style={{ color: '#dc2626' }}>錯誤：{error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>時間</th>
                <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>類型</th>
                <th style={{ padding: '8px 12px', color: '#6b7280', fontWeight: 600 }}>留言內容</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '16px 12px', color: '#9ca3af', textAlign: 'center' }}>
                    尚無留言
                  </td>
                </tr>
              )}
              {feedbacks.map(fb => {
                const isOpen = expanded.has(fb._id);
                const typeInfo = TYPE_LABELS[fb.type] ?? TYPE_LABELS.general;
                const preview = fb.message.length > 200 ? fb.message.slice(0, 200) + '…' : fb.message;

                return (
                  <tr
                    key={fb._id}
                    onClick={() => toggleExpand(fb._id)}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      backgroundColor: isOpen ? '#f9fafb' : '#fff',
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f9fafb'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = isOpen ? '#f9fafb' : '#fff'; }}
                  >
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#374151' }}>
                      {formatDate(fb.createdAt)}
                    </td>
                    <td style={{ padding: '10px 12px', color: fb.email ? '#374151' : '#9ca3af', fontStyle: fb.email ? 'normal' : 'italic' }}>
                      {fb.email ?? '匿名'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        color: typeInfo.color,
                        backgroundColor: typeInfo.bg,
                        whiteSpace: 'nowrap',
                      }}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 600 }}>
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
