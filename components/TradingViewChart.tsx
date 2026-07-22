'use client';

import { useEffect } from 'react';

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TradingView: any;
  }
}

export default function TradingViewChart({ symbol, exchange = 'NASDAQ' }: TradingViewChartProps) {
  const containerId = `tv-chart-${symbol.toLowerCase()}`;

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const initWidget = () => {
      if (typeof window.TradingView === 'undefined') return;
      new window.TradingView.widget({
        autosize: true,
        symbol: `${exchange}:${symbol}`,
        interval: 'W',
        timezone: 'Asia/Taipei',
        theme: 'light',
        style: '1',
        locale: 'zh_TW',
        range: '24M',
        hide_side_toolbar: true,
        allow_symbol_change: false,
        container_id: containerId,
      });
    };

    // If tv.js already loaded (navigating between stocks), init directly
    if (typeof window.TradingView !== 'undefined') {
      initWidget();
      return;
    }

    const script = document.createElement('script');
    script.id = 'tradingview-tv-js';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = initWidget;
    document.head.appendChild(script);

    return () => {
      const existing = document.getElementById('tradingview-tv-js');
      if (existing) existing.remove();
      if (container) container.innerHTML = '';
    };
  }, [symbol, exchange, containerId]);

  return (
    <div
      style={{
        marginBottom: 28,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid #E0DCD6',
      }}
    >
      <div id={containerId} style={{ height: 450 }} />
      <style>{`
        @media (max-width: 768px) {
          #${containerId} { height: 320px !important; }
        }
      `}</style>
    </div>
  );
}
