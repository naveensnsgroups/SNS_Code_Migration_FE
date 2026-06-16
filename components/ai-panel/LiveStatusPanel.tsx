// =============================================================================
//  components/ai-panel/LiveStatusPanel.tsx
//
//  Real-time status dashboard shown inside the Operational Panel.
//
//  Design: Exact SNS IDE / Theia token system — no inline styles.
//          All CSS classes from globals.css (.live-status__*)
//
//  Data sources (all from existing useMigration state — no backend changes):
//    logs[]       → parse active tool, agent, stage, alerts, file count
//    status       → running/idle/complete/error badge
//    isRunning    → show/hide active sections
//    progress     → % bar
//    currentFile  → currently processing file
// =============================================================================

'use client';

import { useMemo } from 'react';
import { Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import type { LogEntry, MigrationStatus } from '@/types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  logs:        LogEntry[];
  status:      MigrationStatus;
  isRunning:   boolean;
  progress:    number;
  currentFile: string;
}

// ── Status Display Map ────────────────────────────────────────────────────────

const STATUS_TEXT: Record<MigrationStatus, string> = {
  idle:               'Ready',
  scanning:           'Scanning',
  planning:           'Running',
  discovery:          'Discovery',
  'file-analysis':    'File Analysis',
  'graph-resolution': 'Graph Resolution',
  'section-writing':  'Writing Sections',
  assembly:           'Assembly',
  complete:           'Complete',
  error:              'Error',
  paused:             'Paused',
};

const STATUS_DOT: Record<MigrationStatus, string> = {
  idle:               'live-status__dot--idle',
  scanning:           'live-status__dot--scanning',
  planning:           'live-status__dot--running',
  discovery:          'live-status__dot--running',
  'file-analysis':    'live-status__dot--running',
  'graph-resolution': 'live-status__dot--running',
  'section-writing':  'live-status__dot--running',
  assembly:           'live-status__dot--running',
  complete:           'live-status__dot--complete',
  error:              'live-status__dot--error',
  paused:             'live-status__dot--paused',
};

const STATUS_BADGE: Record<MigrationStatus, string> = {
  idle:               'live-status__badge--idle',
  scanning:           'live-status__badge--scanning',
  planning:           'live-status__badge--running',
  discovery:          'live-status__badge--running',
  'file-analysis':    'live-status__badge--running',
  'graph-resolution': 'live-status__badge--running',
  'section-writing':  'live-status__badge--running',
  assembly:           'live-status__badge--running',
  complete:           'live-status__badge--complete',
  error:              'live-status__badge--error',
  paused:             'live-status__badge--paused',
};

// ── Log Parsing Utilities ─────────────────────────────────────────────────────

/** Returns name of currently executing tool (last [Tool Call] with no [Tool Response] after it). */
function getActiveTool(logs: LogEntry[]): { name: string; args: string } | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].message.startsWith('[Tool Call]')) {
      // Check if there's a [Tool Response] after this index
      const hasResponse = logs.slice(i + 1).some(l =>
        l.message.startsWith('[Tool Response]')
      );
      if (!hasResponse) {
        const raw = logs[i].message.replace(/^\[Tool Call\]\s*/, '').trim();
        // Parse: "Executing tool \"toolName\"..." or "toolName(args)"
        const cleanRaw = raw.replace(/^Executing tool\s*"?/, '').replace(/"?\s*\.\.\.\s*$/, '').trim();
        const pi = cleanRaw.indexOf('(');
        if (pi === -1) return { name: cleanRaw, args: '' };
        const name = cleanRaw.slice(0, pi).trim();
        const rawArgs = cleanRaw.slice(pi + 1).replace(/\.\.\.?\)$|\)$/, '').trim();
        // Condense args
        let condensed = rawArgs;
        try {
          const parsed = JSON.parse(rawArgs) as Record<string, unknown>;
          const entries = Object.entries(parsed);
          if (entries.length > 0) {
            condensed = entries
              .map(([k, v]) => {
                const vs = typeof v === 'string' ? v : JSON.stringify(v);
                return `${k}: ${vs.length > 24 ? vs.slice(0, 24) + '\u2026' : vs}`;
              })
              .join(', ')
              .slice(0, 60);
          } else {
            condensed = '';
          }
        } catch { /* keep raw */ }
        return { name, args: condensed };
      }
      return null;
    }
    if (logs[i].message.startsWith('[Tool Response]')) {
      // There's a response before any call — no active tool
      return null;
    }
  }
  return null;
}

/** Returns the currently active agent name from recent logs. */
function getCurrentAgent(logs: LogEntry[]): string {
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = logs[i].message;
    if (m.startsWith('[PlannerAgent]'))   return 'Planner Agent';
    if (m.startsWith('[ScannerAgent]'))   return 'Scanner Agent';
    if (m.startsWith('[KnowledgeGraph]')) return 'Knowledge Builder';
    if (m.startsWith('[Context]'))        return 'Context Manager';
    if (m.startsWith('[Progress]'))       break; // stop at progress logs
  }
  return '';
}

/** Returns "Stage N / 5" parsed from planner logs. */
function getCurrentStage(logs: LogEntry[]): string {
  for (let i = logs.length - 1; i >= 0; i--) {
    const match = logs[i].message.match(/Stage\s+(\d+)[\s\/]+(\d+)/i);
    if (match) return `Stage ${match[1]} / ${match[2]}`;
  }
  return '';
}

/** Returns { done, total, pct } from the most recent [Progress] log. */
function getFileCount(logs: LogEntry[]): { done: number; total: number; pct: number } | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = logs[i].message;
    if (m.startsWith('[Progress]')) {
      const match = m.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        const done  = parseInt(match[1]);
        const total = parseInt(match[2]);
        const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
        return { done, total, pct };
      }
    }
  }
  return null;
}

/** Returns last 3 warning/error logs (most recent first). */
function getRecentAlerts(logs: LogEntry[]): LogEntry[] {
  return logs
    .filter(l => l.level === 'warning' || l.level === 'error')
    .slice(-3)
    .reverse();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveStatusPanel({
  logs, status, isRunning, progress, currentFile,
}: Props) {

  const activeTool   = useMemo(() => getActiveTool(logs),   [logs]);
  const currentAgent = useMemo(() => getCurrentAgent(logs), [logs]);
  const currentStage = useMemo(() => getCurrentStage(logs), [logs]);
  const fileCount    = useMemo(() => getFileCount(logs),    [logs]);
  const alerts       = useMemo(() => getRecentAlerts(logs), [logs]);

  // ── Real progress — no mock, no increment ────────────────────────────────
  // Priority: SSE progress% (Phase 2) > log-derived% (Phase 1) > indeterminate
  // -1 = indeterminate (work is happening but no count yet)
  const realPct: number = useMemo(() => {
    if (progress > 0)  return progress;           // Phase 2: SSE-driven, exact
    if (fileCount)     return fileCount.pct;      // Phase 1: computed from X/Y logs
    return -1;                                    // -1 = indeterminate
  }, [progress, fileCount]);

  // Hide when completely idle with nothing to show
  const hasContent = isRunning || status === 'complete' || status === 'error'
    || alerts.length > 0 || activeTool !== null;

  if (!hasContent) return null;

  const dotClass   = STATUS_DOT[status]   ?? STATUS_DOT.idle;
  const badgeClass = STATUS_BADGE[status] ?? STATUS_BADGE.idle;
  const statusText = STATUS_TEXT[status]  ?? 'Ready';

  return (
    <div className="ai-section">

      {/* Section Title — matches existing ai-section__title pattern */}
      <div className="ai-section__title">
        Live Status
      </div>

      {/* Status badge */}
      <div className="live-status__header">
        <span className={`live-status__badge ${badgeClass}`}>
          <span className={`live-status__dot ${dotClass}`} />
          {statusText}
        </span>
        {isRunning && progress > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {progress}%
          </span>
        )}
      </div>

      {/* Progress bar — shown when running */}
      {isRunning && (
        <div className="live-status__progress">
          <div className="live-status__progress-label">
            <span>
              {fileCount
                ? `${fileCount.done} / ${fileCount.total} files`
                : 'Processing…'}
            </span>
            {realPct >= 0 && <span>{realPct}%</span>}
          </div>
          <div className="live-status__progress-bar">
            {realPct >= 0 ? (
              /* Determinate — real % from SSE or log */
              <div
                className="live-status__progress-fill"
                style={{ width: `${Math.min(realPct, 100)}%` }}
              />
            ) : (
              /* Indeterminate — work is happening, no count yet */
              <div className="live-status__progress-fill live-status__progress-fill--indeterminate" />
            )}
          </div>
        </div>
      )}

      {/* Key-value rows */}
      <div className="live-status__rows">

        {/* Agent */}
        {currentAgent && (
          <div className="live-status__row">
            <span className="live-status__key">Agent</span>
            <span className="live-status__val">{currentAgent}</span>
          </div>
        )}

        {/* Stage */}
        {currentStage && (
          <div className="live-status__row">
            <span className="live-status__key">Stage</span>
            <span className="live-status__val">{currentStage}</span>
          </div>
        )}

        {/* Current file */}
        {currentFile && isRunning && (
          <div className="live-status__row">
            <span className="live-status__key">File</span>
            <span className="live-status__val live-status__val--file" title={currentFile}>
              {currentFile.split('/').pop() ?? currentFile}
            </span>
          </div>
        )}

      </div>

      {/* Active Tool block — shown while tool is executing */}
      {activeTool && (
        <div className="live-status__tool">
          <span className="live-status__tool-label">Active Tool</span>
          <span className="live-status__tool-name">
            <Loader2 size={11} className="spin" />
            {activeTool.name}
          </span>
          {activeTool.args && (
            <span className="live-status__tool-args" title={activeTool.args}>
              {activeTool.args}
            </span>
          )}
        </div>
      )}

      {/* Recent alerts — last 3 warnings / errors */}
      {alerts.length > 0 && (
        <>
          <div className="ai-section__title" style={{ marginTop: 6 }}>
            Alerts
          </div>
          <div className="live-status__alerts">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`live-status__alert live-status__alert--${alert.level === 'error' ? 'error' : 'warn'}`}
              >
                <span className="live-status__alert-icon">
                  {alert.level === 'error'
                    ? <AlertCircle   size={10} />
                    : <AlertTriangle size={10} />
                  }
                </span>
                <span className="live-status__alert-msg" title={alert.message}>
                  {alert.message.replace(/^\[[^\]]+\]\s*/, '')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
