// Start / Pause / Stop / Resume buttons. "Start Analysis" doesn't need detectedStack —
// that's the scan itself; "Start Migration" does.
'use client';

import { Play, Pause, Square, CheckCircle2, AlertTriangle, Bot } from 'lucide-react';
import type { MigrationStatus, DetectedStack } from '@/types';
import { useNotifications } from '@/context/NotificationContext';

interface Props {
  status:        MigrationStatus;
  detectedStack: DetectedStack | null;
  hasProject:    boolean;
  planPhaseDone: boolean;
  onStart:  () => void;
  onStop:   () => void;
  onPause:  () => void;
  /** Separate external webhook, fired after the project is already
   * uploaded/saved — shown above Start Stage-1 Analysis. */
  isTriggeringScannerAgent?: boolean;
  onTriggerScannerAgent?: () => void;
  /** Stage 2 — enabled once Stage 1 is complete and the 4 target fields are filled in. */
  canStartMigration?:   boolean;
  migrationDisabledReason?: string;
  isPlanning?:          boolean;
  migrationPlanningDone?: boolean;
  onStartMigration?:    () => void;
  /** Stage 2 — Code Generation, enabled once a migration plan has been reviewed. */
  isGenerating?:         boolean;
  codeGenerationDone?:   boolean;
  generatedCount?:       number;
  failedCount?:          number;
  onStartGeneration?:    () => void;
  /** Stage 2 — Verification, enabled once at least one file has been generated. */
  isVerifying?:          boolean;
  verificationDone?:     boolean;
  verifiedCount?:        number;
  verificationFailedCount?: number;
  onStartVerification?:  () => void;
}

export default function ActionButtons({
  status, hasProject, detectedStack, planPhaseDone,
  onStart, onStop, onPause,
  isTriggeringScannerAgent, onTriggerScannerAgent,
  canStartMigration, migrationDisabledReason, isPlanning, migrationPlanningDone,
  onStartMigration,
  isGenerating, codeGenerationDone, generatedCount, failedCount, onStartGeneration,
  isVerifying, verificationDone, verifiedCount, verificationFailedCount, onStartVerification,
}: Props) {
  // Must match useMigration.ts's own isRunning exactly — see AIPanel.tsx's
  // matching comment for why the narrower ['scanning','planning'] list was wrong.
  const isRunning  = ['scanning', 'planning', 'discovery', 'file-analysis', 'graph-resolution', 'section-writing', 'assembly'].includes(status);
  const isIdle     = status === 'idle';
  const isComplete = status === 'complete';
  const isPaused   = status === 'paused';
  const isError    = status === 'error';

  const buttonLabel = isComplete ? 'Re-run Stage-1 Analysis' : 'Start Stage-1 Analysis';
  const canStart = hasProject;

  const disabledReason = !hasProject ? 'Open a project folder first' : '';

  const { notify } = useNotifications();

  // When user clicks while disabled — show warning toast (SNS IDE pattern)
  const handleStartClick = () => {
    if (!canStart) {
      notify({ type: 'warning', message: disabledReason });
      return;
    }
    onStart();
  };

  return (
    <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Scanner Agent — separate external webhook, shown once a project is
          open, before Stage-1 Analysis. Fires after upload/save already
          happened — this just tells the AgentBuilder workflow which session
          to work on. */}
      {hasProject && onTriggerScannerAgent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            className="btn-premium btn-premium--primary"
            onClick={onTriggerScannerAgent}
            disabled={isTriggeringScannerAgent}
            style={{ opacity: isTriggeringScannerAgent ? 0.45 : 1 }}
          >
            <Bot size={13} />
            <span>{isTriggeringScannerAgent ? 'Triggering Scanner Agent...' : 'Scanner Agent'}</span>
          </button>
        </div>
      )}

      {/* Start / Re-run — shown when idle, complete, or error, AND only once
          Scanner Agent has actually completed stack detection (planPhaseDone).
          Stays hidden before that — Stage-1 Analysis isn't meaningful to run
          against a project whose stack hasn't been detected yet. */}
      {(isIdle || isComplete || isError) && planPhaseDone && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            className="btn-premium btn-premium--primary"
            onClick={handleStartClick}
            title={!canStart ? disabledReason : buttonLabel}
            style={{ opacity: canStart ? 1 : 0.45 }}
          >
            <Play size={13} />
            <span>{isError ? 'Retry Analysis' : buttonLabel}</span>
          </button>

          {/* Explain why disabled — inline hint stays, toast fires on click */}
          {!canStart && disabledReason && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '11px', color: 'var(--text-warning)',
              background: 'rgba(204,167,0,0.08)', border: '1px solid rgba(204,167,0,0.2)',
              borderRadius: '4px', padding: '5px 8px'
            }}>
              <AlertTriangle size={11} />
              <span>{disabledReason}</span>
            </div>
          )}
        </div>
      )}

      {/* Pause + Stop (while running) */}
      {isRunning && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-premium btn-premium--secondary" onClick={onPause} style={{ flex: 1 }}>
            <Pause size={13} />
            <span>Pause</span>
          </button>
          <button className="btn-premium btn-premium--danger" onClick={onStop} style={{ flex: 1 }}>
            <Square size={12} />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* Resume (while paused) */}
      {isPaused && (
        <button className="btn-premium btn-premium--primary" onClick={onStart}>
          <Play size={13} />
          <span>Resume</span>
        </button>
      )}

      {/* Completion badge */}
      {isComplete && (
        <div className="completion-badge-premium">
          <CheckCircle2 size={16} />
          <span>Stage-1 Analysis complete!</span>
        </div>
      )}

      {/* Stage 2 — Start Migration Planning (shown once Stage 1 is complete) */}
      {detectedStack && planPhaseDone && (isComplete || isPlanning || migrationPlanningDone) && onStartMigration && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
          <button
            className="btn-premium btn-premium--primary"
            onClick={onStartMigration}
            disabled={!canStartMigration || isPlanning}
            title={!canStartMigration ? migrationDisabledReason : undefined}
            style={{ opacity: canStartMigration && !isPlanning ? 1 : 0.45 }}
          >
            <Play size={13} />
            <span>{isPlanning ? 'Planning Migration...' : migrationPlanningDone ? 'Re-plan Migration' : 'Start Code Migration'}</span>
          </button>

          {!canStartMigration && !isPlanning && migrationDisabledReason && (
            // Neutral card + colored left-border/icon/text, not a same-hue wash —
            // text-warning on an 8%-opacity tint of that SAME color read as murky/
            // low-contrast even though the raw luminance ratio technically passed.
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '11.5px', fontWeight: 600, color: 'var(--text-warning)',
              background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--text-warning)',
              borderRadius: '0 4px 4px 0', padding: '6px 10px'
            }}>
              <AlertTriangle size={12} style={{ flexShrink: 0 }} />
              <span>{migrationDisabledReason}</span>
            </div>
          )}

          {migrationPlanningDone && !isPlanning && (
            <div className="completion-badge-premium">
              <CheckCircle2 size={16} />
              <span>Migration plan ready — review below.</span>
            </div>
          )}
        </div>
      )}

      {/* Stage 2 — Start Code Generation (shown once a plan exists to generate from) */}
      {migrationPlanningDone && !isPlanning && onStartGeneration && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
          <button
            className="btn-premium btn-premium--primary"
            onClick={onStartGeneration}
            disabled={isGenerating}
            style={{ opacity: isGenerating ? 0.45 : 1 }}
          >
            <Play size={13} />
            <span>{isGenerating ? 'Generating Code...' : codeGenerationDone ? 'Re-generate Code' : 'Generate Code'}</span>
          </button>

          {codeGenerationDone && !isGenerating && (
            <div className="completion-badge-premium">
              <CheckCircle2 size={16} />
              <span>
                Code generation complete — {generatedCount ?? 0} generated
                {failedCount ? `, ${failedCount} failed` : ''}.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stage 2 — Start Verification (shown once at least one file is generated) */}
      {(generatedCount ?? 0) > 0 && !isGenerating && onStartVerification && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
          <button
            className="btn-premium btn-premium--primary"
            onClick={onStartVerification}
            disabled={isVerifying}
            style={{ opacity: isVerifying ? 0.45 : 1 }}
          >
            <Play size={13} />
            <span>{isVerifying ? 'Verifying...' : verificationDone ? 'Re-verify' : 'Verify Code'}</span>
          </button>

          {verificationDone && !isVerifying && (
            <div className="completion-badge-premium">
              <CheckCircle2 size={16} />
              <span>
                Verification complete — {verifiedCount ?? 0} verified
                {verificationFailedCount ? `, ${verificationFailedCount} still failing` : ''}.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
