'use client';

import { useEffect } from 'react';

export default function StocksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging
    console.error('[stocks/error]', error.message, error.digest, error.stack);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f0f3f2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <p style={{ color: '#cc1a22', fontWeight: 700, fontSize: 16 }}>頁面載入失敗</p>
      <p style={{ color: '#666', fontSize: 13, maxWidth: 400, lineHeight: 1.6 }}>
        {error.message || '發生未知錯誤'}
        {error.digest && (
          <span style={{ display: 'block', fontSize: 11, color: '#999', marginTop: 4 }}>
            錯誤代碼：{error.digest}
          </span>
        )}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '8px 20px',
          background: '#cc1a22',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        重試
      </button>
    </div>
  );
}
