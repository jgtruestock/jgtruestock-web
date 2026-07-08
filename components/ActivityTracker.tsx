'use client';

import { useEffect } from 'react';

interface ActivityTrackerProps {
  page: string;
  symbol?: string;
  type?: 'page_view' | 'stock_view' | 'btn_click';
}

export default function ActivityTracker({ page, symbol, type }: ActivityTrackerProps) {
  // Determine event type: if symbol is provided, default to stock_view; else page_view
  const eventType = type ?? (symbol ? 'stock_view' : 'page_view');

  useEffect(() => {
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: eventType, page, symbol }),
    }).catch(() => {
      // silently ignore — tracking failure should not affect UX
    });
  }, [page, symbol, eventType]);

  return null;
}
