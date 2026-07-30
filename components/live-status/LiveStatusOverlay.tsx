// Live Status overlay — all props come from useLiveStatus(), real-time and SSE-driven.
// No internal state, no polling.

'use client';

import { memo } from 'react';
import { Loader2, AlertTriangle, AlertCircle, X, Activity, Check, UserCheck, WifiOff, RefreshCw, Clock } from 'lucide-react';
import type { MigrationStatus, MigrationPhase, PlanApprovalStatus } from '@/types';
import type { LiveStatusData } from './types';
import { useNow, formatDuration } from '@/hooks/useNow';
import { detectCheckpoint } from '@/utils/checkpoint';

// No update from the server (not even a heartbeat) for this long while a run is
// supposedly active means the connection likely died silently, not that a stage
// is just slow. The backend sends a heartbeat every 25s (routes/stream.ts) — this
// MUST be comfortably larger than that, not equal to it. At 25s a single tick of
// network jitter would make this fire falsely on almost every heartbeat cycle,
// since there'd be zero margin. ~2.5x tolerates one missed/delayed heartbeat
// before concluding the connection is actually gone.
const STALE_CONNECTION_SECONDS = 65;

// Human-readable status for screen readers.
const STEP_STATUS_LABEL: Record<MigrationPhase['status'], string> = {
  done:    'completed',
  active:  'in progress',
  error:   'failed',
  pending: 'pending',
};

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_TEXT: Record<MigrationStatus, string> = {
  idle:                 'Ready',
  scanning:             'Scanning',
  planning:             'Running',
  discovery:            'Discovery',
  'file-analysis':      'File Analysis',
  'graph-resolution':   'Graph Resolution',
  'awaiting-graph-review': 'Awaiting Review',
  'section-writing':    'Writing Sections',
  assembly:             'Assembly',
  'migration-planning': 'Migration Planning',
  'code-generation':    'Code Generation',
  verification:         'Verification',
  'migration-assembly': 'Migration Report',
  complete:             'Complete',
  error:                'Error',
  paused:               'Paused',
};

const DOT_CLASS: Record<MigrationStatus, string> = {
  idle:                 'ls-overlay__dot--idle',
  scanning:             'ls-overlay__dot--scanning',
  planning:             'ls-overlay__dot--running',
  discovery:            'ls-overlay__dot--running',
  'file-analysis':      'ls-overlay__dot--running',
  'graph-resolution':   'ls-overlay__dot--running',
  // Distinct from 'paused' (--paused is amber, for "you clicked Pause") — this is
  // a HITL checkpoint waiting on a decision from you, not a run you stopped.
  'awaiting-graph-review': 'ls-overlay__dot--review',
  'section-writing':    'ls-overlay__dot--running',
  assembly:             'ls-overlay__dot--running',
  'migration-planning': 'ls-overlay__dot--running',
  'code-generation':    'ls-overlay__dot--running',
  verification:         'ls-overlay__dot--running',
  'migration-assembly': 'ls-overlay__dot--running',
  complete:             'ls-overlay__dot--complete',
  error:                'ls-overlay__dot--error',
  paused:               'ls-overlay__dot--paused',
};

const BADGE_CLASS: Record<MigrationStatus, string> = {
  idle:                 'ls-overlay__badge--idle',
  scanning:             'ls-overlay__badge--scanning',
  planning:             'ls-overlay__badge--running',
  discovery:            'ls-overlay__badge--running',
  'file-analysis':      'ls-overlay__badge--running',
  'graph-resolution':   'ls-overlay__badge--running',
  'awaiting-graph-review': 'ls-overlay__badge--review',
  'section-writing':    'ls-overlay__badge--running',
  assembly:             'ls-overlay__badge--running',
  'migration-planning': 'ls-overlay__badge--running',
  'code-generation':    'ls-overlay__badge--running',
  verification:         'ls-overlay__badge--running',
  'migration-assembly': 'ls-overlay__badge--running',
  complete:             'ls-overlay__badge--complete',
  error:                'ls-overlay__badge--error',
  paused:               'ls-overlay__badge--paused',
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

// Vertical pipeline stepper — reflects the SSE-driven phase statuses
// (pending | active | done | error), giving an at-a-glance "where are we
// in the migration" view rather than a single status word.
//
// Memoized on phases/phaseDurations/stageWarnings — NOT on the ticking clock, so
// the live panel's once-a-second re-render (for the elapsed timer) doesn't force
// every completed stage row to re-render too. Durations are static once a stage
// finishes, so this stays a cheap, correct memoization boundary.
interface StageStepperProps {
  phases: MigrationPhase[];
  /** Completed stage durations in ms, keyed by phase id. Absent = not timed (e.g. restored from a reload mid-stage). */
  phaseDurations: Record<string, number>;
  /** Real caveats for a stage that finished but produced something hollow/incomplete — see AIPanel's stageWarnings derivation. */
  stageWarnings: Record<string, string>;
}
const StageStepper = memo(function StageStepper({ phases, phaseDurations, stageWarnings }: StageStepperProps) {
  return (
    <div className="ls-overlay__stepper" role="list" aria-label="Migration pipeline stages">
      {phases.map((p, i) => {
        const isLast = i === phases.length - 1;
        const warning = p.status === 'done' ? stageWarnings[p.id] : undefined;
        const duration = phaseDurations[p.id];
        return (
          <div
            key={p.id}
            className={`ls-overlay__step ls-overlay__step--${p.status} ${warning ? 'ls-overlay__step--warning' : ''}`}
            role="listitem"
            aria-label={`${p.label}: ${warning ? `completed with a caveat — ${warning}` : STEP_STATUS_LABEL[p.status]}`}
            title={warning}
          >
            <div className="ls-overlay__step-rail" aria-hidden="true">
              <span className="ls-overlay__step-icon">
                {p.status === 'done' && warning  && <AlertTriangle size={12} />}
                {p.status === 'done' && !warning && <Check size={13} />}
                {p.status === 'active'  && <Loader2 size={12} className="spin" />}
                {p.status === 'error'   && <AlertCircle size={12} />}
                {p.status === 'pending' && <span className="ls-overlay__step-dot" />}
              </span>
              {!isLast && <span className="ls-overlay__step-line" />}
            </div>
            <span className="ls-overlay__step-label">{p.label}</span>
            {duration !== undefined && (
              <span className="ls-overlay__step-duration">{formatDuration(duration)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  data:      LiveStatusData;
  status:    MigrationStatus;
  phases:    MigrationPhase[];
  isRunning: boolean;
  onClose:   () => void;
  /** Timestamp (ms) of the most recent SSE event of any kind — null before a run's first event. */
  lastEventAt?:  number | null;
  /** Timestamp (ms) the current run began — null until handleStart/handleUpload sets it for real. */
  runStartedAt?: number | null;
  /** Completed stage durations in ms, keyed by phase id. */
  phaseDurations?: Record<string, number>;
  /** Re-opens the SSE stream — wired to the "Reconnect" button in the connection-lost banner. */
  onReconnect?: () => void;
  /** Real caveats for a stage that finished but produced something hollow/incomplete. */
  stageWarnings?: Record<string, string>;
  /** Plan sign-off state — distinguishes "plan ready, go generate" from
   *  "plan ready, but nobody has approved it yet". See detectCheckpoint. */
  approvalStatus?: PlanApprovalStatus | null;
}

export default function LiveStatusOverlay({
  data, status, phases, isRunning, onClose,
  lastEventAt = null, runStartedAt = null, phaseDurations = {}, onReconnect, stageWarnings = {},
  approvalStatus = null,
}: Props) {
  const {
    realPct, fileCount, currentFile,
    activeTool, currentAgent, currentStage,
    alerts, recentActivity,
  } = data;

  // Ticks once a second — powers both the elapsed-run timer and the
  // stale-connection check below. A single shared clock, not two timers.
  const now = useNow(1000);

  // Fix: if status says idle but realPct > 0 and < 100, there's active work
  // (happens when status state lags behind SSE progress events).
  //
  // Must check `status === 'idle'` literally, NOT `!isRunning` as a stand-in for
  // it — isRunning is also false during legitimate non-running-but-meaningful
  // statuses like 'awaiting-graph-review' (a HITL checkpoint, paused on purpose)
  // or 'complete'/'error'/'paused'. Using !isRunning here previously forced ALL
  // of those into 'planning' ("Running") the moment realPct held a stale 0-100
  // value, masking the real "Awaiting Review" status and falsely showing an
  // "Active Tool: Generating response…" section while the pipeline sat idle.
  const effectiveStatus: MigrationStatus =
    (status === 'idle' && realPct > 0 && realPct < 100) ? 'planning' : status;

  // HITL checkpoint: the backend reverts status to 'complete' at the END of every
  // user-gated stage (Stage-1 done, plan ready, code generated), not just the true
  // end — so a bare 'complete' is ambiguous. detectCheckpoint resolves it by the
  // next pending phase, returning the right "awaiting your action" label/hint, or
  // null when the run is genuinely finished. Shared with the Operational Panel's
  // banner so both frame the same pause identically.
  const checkpoint = detectCheckpoint(status, phases, approvalStatus);

  // The plan-approval gate is a real pause in the pipeline, but it isn't a
  // backend phase — no agent runs during it, so nothing reports it. Injected here
  // as a derived step so the stepper doesn't jump straight from "Migration
  // Planning ✓" to "Code Generation ○" while actually waiting on a human click.
  // Only shown once approvalStatus exists at all: sessions predating the gate
  // must not sprout a step that never applied to them.
  const displayPhases: MigrationPhase[] = (() => {
    if (!approvalStatus) return phases;
    const planningIdx = phases.findIndex(p => p.id === 'migration-planning');
    if (planningIdx === -1) return phases;
    const approvalStep: MigrationPhase = {
      id: '__plan-approval__',
      label: 'Plan Approval',
      status: approvalStatus === 'approved' ? 'done'
            : approvalStatus === 'disapproved' ? 'error'
            : 'active',
    };
    return [
      ...phases.slice(0, planningIdx + 1),
      approvalStep,
      ...phases.slice(planningIdx + 1),
    ];
  })();

  const dotClass   = DOT_CLASS[effectiveStatus]   ?? DOT_CLASS.idle;
  const badgeClass = checkpoint ? 'ls-overlay__badge--review' : (BADGE_CLASS[effectiveStatus] ?? BADGE_CLASS.idle);
  const statusText = checkpoint ? checkpoint.label : (STATUS_TEXT[effectiveStatus] ?? 'Ready');
  const showReviewIcon = effectiveStatus === 'awaiting-graph-review' || !!checkpoint;
  const effectiveRunning = isRunning || (status === 'idle' && realPct > 0 && realPct < 100);
  // Defensive: "Complete" can never coexist with anything but 100%, no matter what
  // realPct's source data says — a completed run showing 98% reads as a bug even
  // if it's cosmetic. Guards against any future path that leaves realPct stale.
  const displayPct = status === 'complete' ? 100 : realPct;

  // Stale-connection detection: a run that's supposedly active but hasn't sent
  // ANY event (not even a heartbeat) in a while has likely lost its connection
  // silently — previously indistinguishable from "a stage is just slow".
  const secondsSinceLastEvent = lastEventAt !== null ? Math.floor((now - lastEventAt) / 1000) : null;
  const connectionStale =
    effectiveRunning && secondsSinceLastEvent !== null && secondsSinceLastEvent > STALE_CONNECTION_SECONDS;

  // Elapsed-run timer. null while no real run has started this session (see the
  // "not restored on reload" note at runStartedAt's source in useMigration.ts) —
  // rendered as "not shown" rather than faked as 0s or omitted silently.
  const elapsedMs = runStartedAt !== null ? now - runStartedAt : null;

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
        {/* aria-live: announces status changes (Running → Awaiting Review → Complete)
            to screen readers even when focus isn't already inside this panel. */}
        <div className="ls-overlay__status-row" aria-live="polite" aria-atomic="true">
          <span className={`ls-overlay__badge ${badgeClass}`}>
            {showReviewIcon
              ? <UserCheck size={12} className="ls-overlay__review-icon" />
              : <span className={`ls-overlay__dot ${dotClass}`} />}
            {statusText}
          </span>
          {displayPct >= 0 && (
            <span className="ls-overlay__pct">{displayPct}%</span>
          )}
        </div>

        {/* Elapsed-run timer — only while there's a real start time to measure from. */}
        {elapsedMs !== null && (elapsedMs > 0) && (
          <div className="ls-overlay__elapsed">
            <Clock size={11} />
            <span>{formatDuration(elapsedMs)} elapsed</span>
          </div>
        )}

        {/* Connection-lost banner — distinct from "a stage is just slow": no event
            of ANY kind (not even a heartbeat) in over STALE_CONNECTION_SECONDS
            while a run is supposedly active. Previously invisible entirely; the
            status badge would just keep showing its last state forever. */}
        {connectionStale && (
          <div className="ls-overlay__conn-lost">
            <WifiOff size={12} style={{ flexShrink: 0 }} />
            <span className="ls-overlay__conn-lost-text">
              No updates in {secondsSinceLastEvent}s — the live connection may have been lost.
            </span>
            {onReconnect && (
              <button className="ls-overlay__reconnect-btn" onClick={onReconnect}>
                <RefreshCw size={11} /> Reconnect
              </button>
            )}
          </div>
        )}

        {/* Next-step hint at any HITL checkpoint (Stage-1 → Stage-2, plan ready, code generated) */}
        {checkpoint && (
          <div className="ls-overlay__next-step">
            {checkpoint.hint}
          </div>
        )}

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

      {/* ── Pipeline Stepper ────────────────────────────────────────────── */}
      {displayPhases.length > 0 && (
        <>
          <div className="ls-overlay__section">
            <SectionTitle>Pipeline</SectionTitle>
            <StageStepper phases={displayPhases} phaseDurations={phaseDurations} stageWarnings={stageWarnings} />
          </div>
          <Divider />
        </>
      )}

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
                    {item.success ? <Check size={11} /> : <X size={11} />}
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
