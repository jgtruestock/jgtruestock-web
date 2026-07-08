'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function RegisterChannelPage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();

  const [channelUrl, setChannelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hintOpen, setHintOpen] = useState(false);

  const googleEmail =
    (session?.user as any)?.email || session?.user?.email || '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!channelUrl.trim()) {
      setError('請貼上你的 YouTube 頻道連結');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: channelUrl.trim(), googleEmail }),
      });
      const data = await res.json();

      if (data.ok) {
        // Re-trigger JWT refresh so isYTMember updates
        await updateSession();
        router.push('/stocks');
      } else if (data.error === 'not_member') {
        setError(
          '找不到你的頻道。請確認你是 JGTrueStock 的 YouTube 會員，或試試貼 /channel/UCxxxxx 格式的連結。'
        );
      } else if (data.error === 'handle_unsupported') {
        setError(
          '無法解析 @handle 格式，請改貼「/channel/UCxxxxx」格式的頻道連結。'
        );
      } else {
        setError(data.error || '發生錯誤，請稍後再試。');
      }
    } catch {
      setError('網路錯誤，請稍後再試。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center">
          最後一步：驗證你的 YouTube 頻道
        </h1>
        <p className="text-gray-400 text-sm text-center mb-6">
          請貼上你的 YouTube 頻道連結，系統會自動確認你是否為會員
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="channelUrl"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              你的 YouTube 頻道連結
            </label>
            <input
              id="channelUrl"
              type="url"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              placeholder="https://www.youtube.com/channel/UCxxxxxx"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              例：https://www.youtube.com/channel/UCxxxxxx
              <br />
              或：https://www.youtube.com/@yourname
            </p>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {loading ? '驗證中...' : '確認並進入'}
          </button>
        </form>

        {/* Collapsible hint */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setHintOpen((v) => !v)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span>{hintOpen ? '▾' : '▸'}</span>
            如何找到你的頻道連結？
          </button>
          {hintOpen && (
            <div className="mt-2 text-sm text-gray-400 bg-gray-800/60 rounded-lg p-4 space-y-2">
              <p>
                <span className="text-gray-200 font-medium">YouTube App：</span>
                點右下角頭像 → 你的頻道 → 點分享 → 複製連結
              </p>
              <p>
                <span className="text-gray-200 font-medium">電腦：</span>
                YouTube 右上角頭像 → 你的頻道 → 複製網址列的連結
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            用不同帳號登入
          </button>
        </div>
      </div>
    </main>
  );
}
