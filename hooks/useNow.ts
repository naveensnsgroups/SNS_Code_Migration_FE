// Shared ticking clock — re-renders the calling component every `intervalMs`,
// returning the current timestamp. A single hook backing both the elapsed-time
// display and the stale-connection detector, instead of two separate
// setInterval timers doing the same job.
'use client';

import { useEffect, useState } from 'react';

export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

// Formats a millisecond duration as "1m12s" / "45s" / "1h03m" — used for both
// per-stage durations and the overall elapsed-run timer.
export function formatDuration(ms: number): string {
  if (ms < 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0)   return `${hours}h${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}
