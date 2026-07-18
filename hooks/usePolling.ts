// Polling lifecycle manager — replaces the old SSE (EventSource) transport.
// n8n webhooks can't hold a stream open, so live progress now comes from
// repeatedly calling a status endpoint instead of a push connection.

import { useCallback, useEffect, useRef } from 'react';

export interface UsePollingOptions {
  /** Called on every poll tick with the session id being polled. */
  onTick: (sessionId: string) => void | Promise<void>;
  /** Called when a poll request fails (network error, non-2xx, etc). */
  onError?: (msg: string) => void;
  /** Milliseconds between ticks. Defaults to 3000. */
  intervalMs?: number;
}

export interface UsePollingReturn {
  /** Start polling the given session id. Restarts (from tick 0) if already polling. */
  startPolling: (sessionId: string) => void;
  /** Stop polling. */
  stopPolling: () => void;
}

export function usePolling({ onTick, onError, intervalMs = 3000 }: UsePollingOptions): UsePollingReturn {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  const startPolling = useCallback((sessionId: string) => {
    stopPolling();

    const tick = async () => {
      try {
        await onTick(sessionId);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Poll request failed.');
      }
    };

    // Fire immediately — don't make the UI wait a full interval for the first update.
    tick();
    timerRef.current = setInterval(tick, intervalMs);
  }, [onTick, onError, intervalMs, stopPolling]);

  return { startPolling, stopPolling };
}
