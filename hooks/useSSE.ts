// =============================================================================
//  hooks/useSSE.ts
//  Server-Sent Events lifecycle manager.
//
//  Handles: open, event dispatch, connection loss, cleanup on unmount.
//  Extracted from handleStart() inline SSE code in page.tsx.
//
//  Usage:
//    const { openSSE, closeSSE } = useSSE(onEvent, onError);
//    // in handleStart: openSSE(`${backendUrl}/api/stream/${sessionId}`);
//    // cleanup is automatic on unmount
// =============================================================================

import { useCallback, useEffect, useRef } from 'react';

export interface SSEEventPayload {
  type: string;
  data: Record<string, unknown>;
}

export interface UseSSEOptions {
  /** Called for every parsed SSE message. */
  onEvent: (event: SSEEventPayload) => void;
  /** Called when connection is lost. */
  onError?: (msg: string) => void;
}

export interface UseSSEReturn {
  /** Open an SSE connection to the given URL. Closes any existing connection first. */
  openSSE: (url: string) => void;
  /** Close the current SSE connection if open. */
  closeSSE: () => void;
}

export function useSSE({ onEvent, onError }: UseSSEOptions): UseSSEReturn {
  const sseRef = useRef<EventSource | null>(null);

  // Cleanup on unmount
  useEffect(() => () => sseRef.current?.close(), []);

  const closeSSE = useCallback(() => {
    sseRef.current?.close();
    sseRef.current = null;
  }, []);

  const openSSE = useCallback(
    (url: string) => {
      // Close existing connection before opening new one
      closeSSE();

      const sse = new EventSource(url);
      sseRef.current = sse;

      sse.onmessage = (e) => {
        try {
          const event: SSEEventPayload = JSON.parse(e.data);
          onEvent(event);
        } catch {
          /* ignore malformed frames */
        }
      };

      sse.onerror = () => {
        onError?.('Stream connection lost. Migration may still be running on server.');
      };
    },
    [onEvent, onError, closeSSE]
  );

  return { openSSE, closeSSE };
}
