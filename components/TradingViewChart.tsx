// Server Component — no 'use client' needed, iframe renders in SSR HTML directly

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
}

function normalizeTVExchange(exchange?: string): string {
  if (!exchange) return 'NASDAQ';
  const map: Record<string, string> = {
    NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ',
    NYQ: 'NYSE', ASE: 'AMEX', PCX: 'NYSEARCA',
    BTS: 'NASDAQ', NASDAQ: 'NASDAQ', NYSE: 'NYSE',
  };
  return map[exchange.toUpperCase()] || 'NASDAQ';
}

export default function TradingViewChart({ symbol, exchange }: TradingViewChartProps) {
  const tvExchange = normalizeTVExchange(exchange);
  const params = new URLSearchParams({
    autosize: '1',
    symbol: `${tvExchange}:${symbol}`,
    interval: 'W',
    timezone: 'Asia/Taipei',
    theme: 'light',
    style: '1',
    locale: 'zh_TW',
    range: '24M',
    hide_side_toolbar: '1',
    allow_symbol_change: '0',
    save_image: '0',
    calendar: '0',
    support_host: 'https://www.tradingview.com',
  });
  const src = `https://s.tradingview.com/widgetembed/?${params.toString()}`;

  return (
    <div
      style={{
        marginBottom: 28,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid #E0DCD6',
        height: 450,
      }}
    >
      <iframe
        src={src}
        width="100%"
        height="450"
        style={{ border: 'none', display: 'block' }}
        allowFullScreen
        title={`${symbol} K線圖`}
      />
    </div>
  );
}
