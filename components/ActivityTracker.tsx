'use client';

import { useEffect } from 'react';

interface ActivityTrackerProps {
  page: string;
  symbol?: string;
}

export default function ActivityTracker({ page, symbol }: ActivityTrackerProps) {
  useEffect(() => {
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, symbol }),
    }).catch(() => {
      // silently ignore — tracking failure should not affect UX
    });
  }, [page, symbol]);

  return null;
}
