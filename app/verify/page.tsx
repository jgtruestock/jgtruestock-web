'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function VerifyPage() {
  const router = useRouter();
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
          <p className="text-gray-500 text-sm mb-6">
            請貼上你加入會員的 YouTube 頻道連結或 @handle，例如：
            <span className="font-medium text-gray-700"> youtube.com/@yourname</span>
          </p>

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
                  placeholder="youtube.com/@yourhandle 或 @yourhandle"
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
