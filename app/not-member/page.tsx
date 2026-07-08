'use client';

import { signOut } from 'next-auth/react';

const JG_CHANNEL_JOIN_URL =
  'https://www.youtube.com/channel/UCzY0ZSJO28AMIByZ640sQag/join';

export default function NotMemberPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Brand */}
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
          {/* Icon */}
          <div className="text-5xl mb-4">🔒</div>

          <h1 className="text-xl font-semibold text-gray-900 mb-3">
            你目前不是頻道會員
          </h1>

          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            此網站為 JG 頻道付費會員專屬。
            <br />
            如果你已加入會員，請確認登入帳號是否正確。
          </p>

          <div className="space-y-3">
            <a
              href={JG_CHANNEL_JOIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full text-white font-semibold py-3 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#cc1a22' }}
            >
              加入頻道會員
              <span>→</span>
            </a>

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full border border-gray-300 text-gray-600 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              重新登入
            </button>
          </div>

          <p className="text-gray-400 text-xs mt-6">
            需要協助？請聯繫{' '}
            <span style={{ color: '#c9a84c' }} className="font-medium">
              JG
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
