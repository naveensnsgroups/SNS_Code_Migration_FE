// =============================================================================
//  components/live-status/LiveStatusOverlay.tsx
//
//  Production-grade Live Status Overlay — SNS IDE / Theia exact style.
//
//  Position: absolute, inset: 0 — covers the ai-panel__body area.
//  The config panels (StackBadge, TargetConfig, etc.) remain mounted below.
//
//  Data: all props come from useLiveStatus() hook — real-time, SSE-driven.
//  No internal state, no polling, no intervals.
// =============================================================================

'use client';

import { Loader2, AlertTriangle, AlertCircle, X, Activity } from 'lucide-react';
import type { MigrationStatus } from '@/types';
import type { LiveStatusData } from './types';

// ── Status config ─────────────────────────────────────────────────────────────

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

const DOT_CLASS: Record<MigrationStatus, string> = {
  idle:               'ls-overlay__dot--idle',
  scanning:           'ls-overlay__dot--scanning',
  planning:           'ls-overlay__dot--running',
  discovery:          'ls-overlay__dot--running',
  'file-analysis':    'ls-overlay__dot--running',
  'graph-resolution': 'ls-overlay__dot--running',
  'section-writing':  'ls-overlay__dot--running',
  assembly:           'ls-overlay__dot--running',
  complete:           'ls-overlay__dot--complete',
  error:              'ls-overlay__dot--error',
  paused:             'ls-overlay__dot--paused',
};

const BADGE_CLASS: Record<MigrationStatus, string> = {
  idle:               'ls-overlay__badge--idle',
  scanning:           'ls-overlay__badge--scanning',
  planning:           'ls-overlay__badge--running',
  discovery:          'ls-overlay__badge--running',
  'file-analysis':    'ls-overlay__badge--running',
  'graph-resolution': 'ls-overlay__badge--running',
  'section-writing':  'ls-overlay__badge--running',
  assembly:           'ls-overlay__badge--running',
  complete:           'ls-overlay__badge--complete',
  error:              'ls-overlay__badge--error',
  paused:             'ls-overlay__badge--paused',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="ai-section__title" style={{ marginBottom: 6 }}>{children}</div>;
}

function Row({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  if (!value) return null;
  return (
    <div className="ls-overlay__row">
      <span className="ls-overlay__key">{label}</span>
      <span className={`ls-overlay__val ${valueClass}`} title={value}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="ls-overlay__divider" />;
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  data:      LiveStatusData;
  status:    MigrationStatus;
  isRunning: boolean;
  onClose:   () => void;
}

export default function LiveStatusOverlay({ data, status, isRunning, onClose }: Props) {
  const {
    realPct, fileCount, currentFile,
    activeTool, currentAgent, currentStage,
    alerts, recentActivity,
  } = data;

  // Fix: if status says idle but realPct > 0 and < 100, there's active work
  // (happens when status state lags behind SSE progress events)
  const effectiveStatus: MigrationStatus =
    (!isRunning && realPct > 0 && realPct < 100) ? 'planning' : status;

  const dotClass   = DOT_CLASS[effectiveStatus]   ?? DOT_CLASS.idle;
  const badgeClass = BADGE_CLASS[effectiveStatus] ?? BADGE_CLASS.idle;
  const statusText = STATUS_TEXT[effectiveStatus] ?? 'Ready';
  const effectiveRunning = isRunning || (realPct > 0 && realPct < 100);

  return (
    <div className="ls-overlay">

      {/* ── Sticky Header ───────────────────────────────────────────────── */}
      <div className="ls-overlay__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={12} style={{ color: 'var(--text-muted)' }} />
          <span className="ls-overlay__header-title">Live Activity</span>
        </div>
        <button className="ls-overlay__close" onClick={onClose} title="Close">
          <X size={12} />
        </button>
      </div>

      {/* ── Status Badge + Progress ──────────────────────────────────────── */}
      <div className="ls-overlay__section">
        <div className="ls-overlay__status-row">
          <span className={`ls-overlay__badge ${badgeClass}`}>
            <span className={`ls-overlay__dot ${dotClass}`} />
            {statusText}
          </span>
          {realPct >= 0 && (
            <span className="ls-overlay__pct">{realPct}%</span>
          )}
        </div>

        {/* Progress bar */}
        {effectiveRunning && (
          <div style={{ marginTop: 8 }}>
            <div className="ls-overlay__progress-label">
              <span>
                {fileCount
                  ? `${fileCount.done} / ${fileCount.total} files`
                  : 'Processing…'}
              </span>
              {realPct >= 0 && <span>{realPct}%</span>}
            </div>
            <div className="ls-overlay__progress-track">
              {realPct >= 0 ? (
                <div
                  className="ls-overlay__progress-fill"
                  style={{ width: `${Math.min(realPct, 100)}%` }}
                />
              ) : (
                <div className="ls-overlay__progress-fill ls-overlay__progress-fill--indeterminate" />
              )}
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* ── Active Tool / Thinking ──────────────────────────────────────── */}
      {effectiveRunning && (
        <>
          <div className="ls-overlay__section">
            <SectionTitle>Active Tool</SectionTitle>
            {activeTool ? (
              <div className="ls-overlay__tool">
                <div className="ls-overlay__tool-name">
                  <Loader2 size={11} className="spin" style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                  <span>{activeTool.name}</span>
                </div>
                {activeTool.args && (
                  <div className="ls-overlay__tool-args">{activeTool.args}</div>
                )}
              </div>
            ) : (
              // LLM is between tool calls — generating next response
              <div className="ls-overlay__thinking">
                <Loader2 size={10} className="spin" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span>Generating response…</span>
              </div>
            )}
          </div>
          <Divider />
        </>
      )}

      {/* ── Session Info ────────────────────────────────────────── */}
      {(currentAgent || currentStage || (currentFile && effectiveRunning)) && (
        <>
          <div className="ls-overlay__section">
            <SectionTitle>Session</SectionTitle>
            <div className="ls-overlay__rows">
              <Row label="Agent" value={currentAgent} />
              <Row label="Stage" value={currentStage} />
              {effectiveRunning && currentFile && (
                <Row
                  label="File"
                  value={currentFile.split('/').pop() ?? currentFile}
                  valueClass="ls-overlay__val--file"
                />
              )}
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* ── Tool Call Feed ───────────────────────────────────────────────── */}
      {data.toolCallHistory.length > 0 && (
        <>
          <div className="ls-overlay__section">
            <SectionTitle>Tool Calls ({data.toolCallHistory.length})</SectionTitle>
            <div className="ls-overlay__tool-feed">
              {data.toolCallHistory.map(item => (
                <div
                  key={item.id}
                  className={`ls-overlay__feed-item ${item.success ? 'ls-overlay__feed-item--ok' : 'ls-overlay__feed-item--err'}`}
                >
                  <span className="ls-overlay__feed-icon">
                    {item.success ? '✓' : '✗'}
                  </span>
                  <span className="ls-overlay__feed-name" title={item.name}>
                    {item.name}
                  </span>
                  {item.args && (
                    <span className="ls-overlay__feed-args" title={item.args}>
                      {item.args}
                    </span>
                  )}
                  <span className="ls-overlay__feed-ts">{item.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
          {(recentActivity.length > 0 || alerts.length > 0) && <Divider />}
        </>
      )}

      {/* ── Recent Activity ─────────────────────────────────────────────────
          Was computed by useLiveStatus (last 5 meaningful log messages) but
          never actually rendered anywhere — silently dropped data. Mirrors
          the Alerts section's structure/styling below. */}
      {recentActivity.length > 0 && (
        <>
          <div className="ls-overlay__section">
            <SectionTitle>Recent Activity</SectionTitle>
            <div className="ls-overlay__alerts">
              {recentActivity.map((message, i) => (
                <div key={i} className="ls-overlay__alert">
                  <span className="ls-overlay__alert-msg" title={message}>
                    {message}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {alerts.length > 0 && <Divider />}
        </>
      )}

      {/* ── Alerts ───────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="ls-overlay__section">
          <SectionTitle>Alerts ({alerts.length})</SectionTitle>
          <div className="ls-overlay__alerts">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`ls-overlay__alert ls-overlay__alert--${alert.level}`}
              >
                <span className="ls-overlay__alert-icon">
                  {alert.level === 'error'
                    ? <AlertCircle   size={10} />
                    : <AlertTriangle size={10} />
                  }
                </span>
                <span className="ls-overlay__alert-msg" title={alert.message}>
                  {alert.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────── */}
      {!effectiveRunning && status === 'idle' && alerts.length === 0 && (
        <div className="ls-overlay__section">
          <span className="ls-overlay__empty">
            No active migration. Start a migration to see live status.
          </span>
        </div>
      )}

    </div>
  );
}
