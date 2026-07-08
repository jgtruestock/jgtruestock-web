'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

export default function VerifyPage() {
  const router = useRouter();
  const { update } = useSession();
  const [channelUrl, setChannelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        // Force session refresh so middleware sees new isYTMember=true
        await update();
        setTimeout(() => router.push('/stocks'), 1500);
      } else {
        setError(data.error ?? '發生錯誤，請稍後再試');
      }
    } catch {
      setError('無法連線，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-block text-3xl font-bold mb-2"
            style={{ color: '#cc1a22' }}
          >
            JG TrueStock
          </div>
          <p className="text-gray-500 text-sm">頻道會員專屬平台</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            確認你的頻道會員身份
          </h1>
          <p className="text-gray-500 text-sm mb-4">
            貼上你的 YouTube 頻道連結，系統會自動確認你是否為頻道會員
          </p>

          {/* 步驟式說明 */}
          <div
            style={{ background: '#f5f5f5', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}
          >
            <p className="text-sm font-semibold text-gray-700 mb-3">怎麼找到我的頻道連結？</p>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                '打開 YouTube（手機或電腦）',
                '點右上角的頭像 / 大頭照',
                '點「查看頻道」',
                '複製網址列的連結，貼到下面的輸入框',
              ].map((step, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#cc1a22',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-600">{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm mt-3" style={{ color: '#c9a84c', fontWeight: 600 }}>
              👉 連結通常長這樣：youtube.com/@yourname
            </p>
          </div>

          {success ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-green-600 font-semibold text-lg">確認成功！正在進入...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  placeholder="貼上你的頻道連結，例如：youtube.com/@yourname 或 @yourname"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#cc1a22' } as React.CSSProperties}
                  disabled={loading}
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !channelUrl.trim()}
                className="w-full text-white font-semibold py-3 rounded-lg transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#cc1a22' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    驗證中...
                  </span>
                ) : (
                  '確認'
                )}
              </button>
            </form>
          )}

          <p className="text-gray-400 text-xs mt-6 text-center">
            如果確認你是頻道會員但仍無法通過，請聯繫{' '}
            <span style={{ color: '#c9a84c' }} className="font-medium">
              JG
            </span>
          </p>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-gray-400 text-xs hover:text-gray-600 transition-colors"
          >
            登出並換帳號
          </button>
        </div>
      </div>
    </div>
  );
}
