'use client';

import dynamic from 'next/dynamic';

const TradingViewChart = dynamic(() => import('./TradingViewChart'), { ssr: false });

interface TradingViewChartWrapperProps {
  symbol: string;
  exchange?: string;
}

export default function TradingViewChartWrapper({ symbol, exchange }: TradingViewChartWrapperProps) {
  return <TradingViewChart symbol={symbol} exchange={exchange} />;
}
