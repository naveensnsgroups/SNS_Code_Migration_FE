// =============================================================================
//  hooks/useLiveStatus.ts
//
//  Real-time Live Status hook.
//  Derives actionable status from logs[] (SSE-driven, updates every event).
//
//  Performance: only scans last 150 logs for derived state.
//               All logs scanned for alerts (to catch old errors).
//
//  Returns LiveStatusData — consumed by LiveStatusOverlay.
// =============================================================================

'use client';

import { useMemo } from 'react';
import type { LogEntry, MigrationStatus } from '@/types';
import type { LiveStatusData, AlertItem } from '@/components/live-status/types';

// ── Parsing utilities (scan recentLogs only) ──────────────────────────────────

/**
 * Returns the currently executing tool — the last [Tool Call] that has no
 * [Tool Response] after it. Returns null if all calls are finished.
 */
function deriveActiveTool(logs: LogEntry[]): { name: string; args: string } | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const msg = logs[i].message;

    if (msg.startsWith('[Tool Call]')) {
      const hasResponse = logs.slice(i + 1).some(l =>
        l.message.startsWith('[Tool Response]')
      );
      if (hasResponse) return null;

      // Parse tool name and args from "[Tool Call] Executing tool "name"(args)..."
      const raw       = msg.replace(/^\[Tool Call\]\s*/, '').trim();
      const cleanRaw  = raw
        .replace(/^Executing tool\s*"?/, '')
        .replace(/"?\s*\.+\s*$/, '')
        .trim();

      const pi = cleanRaw.indexOf('(');
      if (pi === -1) return { name: cleanRaw, args: '' };

      const name    = cleanRaw.slice(0, pi).trim();
      const rawArgs = cleanRaw.slice(pi + 1).replace(/\.+\)$|\)$/, '').trim();

      // Condense args to readable short form
      let condensed = rawArgs;
      try {
        const parsed = JSON.parse(rawArgs) as Record<string, unknown>;
        const entries = Object.entries(parsed);
        condensed = entries.length > 0
          ? entries.map(([k, v]) => {
              const vs = typeof v === 'string' ? v : JSON.stringify(v);
              return `${k}: ${vs.length > 32 ? vs.slice(0, 32) + '\u2026' : vs}`;
            }).join('  ·  ').slice(0, 90)
          : '';
      } catch { /* keep raw */ }

      return { name, args: condensed };
    }

    if (msg.startsWith('[Tool Response]')) return null;
  }
  return null;
}

/** Returns the most recently active agent label. */
function deriveAgent(logs: LogEntry[]): string {
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = logs[i].message;
    if (m.startsWith('[PlannerAgent]'))   return 'Planner Agent';
    if (m.startsWith('[ScannerAgent]'))   return 'Scanner Agent';
    if (m.startsWith('[KnowledgeGraph]')) return 'Knowledge Builder';
    if (m.startsWith('[Context]'))        return 'Context Manager';
  }
  return '';
}

/** Returns "Stage N / 5" from the most recent planner stage log. */
function deriveStage(logs: LogEntry[]): string {
  for (let i = logs.length - 1; i >= 0; i--) {
    const match = logs[i].message.match(/Stage\s+(\d+)[\s/]+(\d+)/i);
    if (match) return `Stage ${match[1]} / ${match[2]}`;
  }
  return '';
}

/** Returns { done, total, pct } from the most recent [Progress] log. */
function deriveFileCount(logs: LogEntry[]): { done: number; total: number; pct: number } | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = logs[i].message;
    if (m.startsWith('[Progress]')) {
      const match = m.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        const done  = parseInt(match[1]);
        const total = parseInt(match[2]);
        return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
      }
    }
  }
  return null;
}

/**
 * Returns last 5 warnings/errors (most recent first).
 * Scans ALL logs (not just recent slice) to never miss errors.
 */
function deriveAlerts(allLogs: LogEntry[]): AlertItem[] {
  return allLogs
    .filter(l => l.level === 'warning' || l.level === 'error')
    .slice(-5)
    .reverse()
    .map(l => ({
      id:        l.id,
      level:     l.level as 'warning' | 'error',
      message:   l.message.replace(/^\[[^\]]+\]\s*/, '').trim(),
      timestamp: l.timestamp,
    }));
}

/**
 * Returns last 5 meaningful human-readable activity messages.
 * Excludes: Tool Call/Response/Data, AI Request/Response internals.
 */
function deriveRecentActivity(logs: LogEntry[]): string[] {
  const SKIP_PREFIXES = [
    '[Tool Call]', '[Tool Response]', '[Tool Data]',
    '[AI Request]', '[AI Response]',
  ];
  return logs
    .filter(l =>
      (l.level === 'info' || l.level === 'success') &&
      !SKIP_PREFIXES.some(p => l.message.startsWith(p))
    )
    .slice(-8)
    .reverse()
    .map(l => l.message.replace(/^\[[^\]]+\]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveStatus(
  logs:        LogEntry[],
  status:      MigrationStatus,
  isRunning:   boolean,
  progress:    number,
  currentFile: string,
): LiveStatusData {
  // Only scan the last 150 logs for derived UI state — prevents O(n) slowdown
  // on long sessions with 500+ log entries.
  const recent = useMemo(() => logs.slice(-150), [logs]);

  const activeTool     = useMemo(() => deriveActiveTool(recent),      [recent]);
  const currentAgent   = useMemo(() => deriveAgent(recent),           [recent]);
  const currentStage   = useMemo(() => deriveStage(recent),           [recent]);
  const fileCount      = useMemo(() => deriveFileCount(recent),        [recent]);
  const alerts         = useMemo(() => deriveAlerts(logs),            [logs]);
  const recentActivity = useMemo(() => deriveRecentActivity(recent),  [recent]);

  // Real progress — no mock, no increment
  // Priority: SSE progress% (Phase 2) → log-derived% (Phase 1) → -1 (indeterminate)
  const realPct = useMemo((): number => {
    if (progress > 0) return progress;
    if (fileCount)    return fileCount.pct;
    return -1;
  }, [progress, fileCount]);

  return {
    realPct,
    fileCount,
    currentFile,
    activeTool,
    currentAgent,
    currentStage,
    alerts,
    recentActivity,
  };
}
