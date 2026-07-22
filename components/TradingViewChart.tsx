'use client';

import { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
}

export default function TradingViewChart({ symbol, exchange = 'NASDAQ' }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = `tv-chart-${symbol.toLowerCase()}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
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
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });
    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [symbol, exchange]);

  return (
    <div
      style={{
        marginBottom: 28,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid #E0DCD6',
      }}
    >
      <div
        id={containerId}
        ref={containerRef}
        className="tradingview-widget-container"
      />
      <style>{`
        #${containerId} {
          height: 450px;
        }
        @media (max-width: 768px) {
          #${containerId} {
            height: 320px;
          }
        }
      `}</style>
    </div>
  );
}
