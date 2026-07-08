'use client';

import { useEffect, useState, useCallback } from 'react';

interface Binding {
  _id: string;
  email: string;
  channelId: string;
  channelUrl: string;
  boundAt: string;
}

export default function AdminBindingsPage() {
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  const fetchBindings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/bindings?${params}`);
      const data = await res.json();
      setBindings(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchBindings();
  }, [fetchBindings]);

  async function handleDelete(email: string) {
    if (!confirm(`確定解除 ${email} 的頻道綁定？`)) return;
    setDeletingEmail(email);
    try {
      await fetch(`/api/admin/bindings?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
      await fetchBindings();
    } finally {
      setDeletingEmail(null);
    }
  }

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">頻道綁定管理</h1>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="搜尋 email 或 channelId..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          onClick={fetchBindings}
          className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors"
        >
          搜尋
        </button>
      </div>

      {/* Stats */}
      <p className="text-sm text-gray-500 mb-4">
        共 <span className="font-semibold text-gray-700">{total}</span> 筆綁定
      </p>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Channel ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">綁定時間</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">
                  載入中...
                </td>
              </tr>
            ) : bindings.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">
                  {search ? '找不到符合的綁定' : '尚無任何綁定'}
                </td>
              </tr>
            ) : (
              bindings.map((b) => (
                <tr key={b._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-800">{b.email}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    <a
                      href={b.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 transition-colors"
                      title={b.channelUrl}
                    >
                      {b.channelId}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(b.boundAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(b.email)}
                      disabled={deletingEmail === b.email}
                      className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors disabled:opacity-40"
                    >
                      {deletingEmail === b.email ? '解除中...' : '解除綁定'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border text-sm disabled:opacity-40"
          >
            上一頁
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded border text-sm disabled:opacity-40"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
