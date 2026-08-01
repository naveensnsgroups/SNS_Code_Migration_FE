// Pipeline controls. Only the NEXT action in the pipeline is surfaced as a
// button — every other runnable action (re-running an already-completed stage)
// moves into the "More actions" menu, so the panel shows one obvious next step
// instead of a stack of five equally-prominent blue buttons.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, CheckCircle2, AlertTriangle, Bot, MoreHorizontal, RotateCcw } from 'lucide-react';
import type { MigrationStatus, DetectedStack, MigrationPhase } from '@/types';
import { useNotifications } from '@/context/NotificationContext';

interface Props {
  status:        MigrationStatus;
  detectedStack: DetectedStack | null;
  hasProject:    boolean;
  planPhaseDone: boolean;
  /** Real pipeline phase statuses — the honest source for which stages are done. */
  phases:        MigrationPhase[];
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
  /** Stage 2 — Code Generation, enabled once a migration plan has been reviewed
   * AND explicitly approved by a human (see PlanApprovalCheckpoint). */
  isGenerating?:         boolean;
  codeGenerationDone?:   boolean;
  generatedCount?:       number;
  failedCount?:          number;
  /** Files written but flagged by the generator's own output check — counted in
   * generatedCount, surfaced separately so "complete" isn't overstated. */
  needsReviewCount?:     number;
  planApproved?:         boolean;
  generationDisabledReason?: string;
  onStartGeneration?:    () => void;
  /** Stage 2 — Verification, enabled once at least one file has been generated. */
  isVerifying?:          boolean;
  verificationDone?:     boolean;
  verifiedCount?:        number;
  verificationFailedCount?: number;
  onStartVerification?:  () => void;
}

// One runnable pipeline action, resolved from props below.
interface PipelineAction {
  id:        string;
  /** Label when this stage hasn't run yet — the "do it" phrasing. */
  label:     string;
  /** Label once it has run — the "do it again" phrasing. */
  rerunLabel: string;
  done:      boolean;
  /** In flight right now. */
  busy:      boolean;
  /** False = this action isn't reachable yet at all (hidden entirely). */
  available: boolean;
  disabled:  boolean;
  disabledReason: string;
  onRun:     () => void;
}

export default function ActionButtons({
  status, hasProject, detectedStack, planPhaseDone, phases,
  onStart, onStop, onPause,
  isTriggeringScannerAgent, onTriggerScannerAgent,
  canStartMigration, migrationDisabledReason, isPlanning, migrationPlanningDone,
  onStartMigration,
  isGenerating, codeGenerationDone, generatedCount, failedCount, needsReviewCount,
  planApproved, generationDisabledReason, onStartGeneration,
  isVerifying, verificationDone, verifiedCount, verificationFailedCount, onStartVerification,
}: Props) {
  // Must match useMigration.ts's own isRunning exactly — see AIPanel.tsx's
  // matching comment for why the narrower ['scanning','planning'] list was wrong.
  const isRunning  = ['scanning', 'planning', 'discovery', 'file-analysis', 'graph-resolution', 'section-writing', 'assembly'].includes(status);
  const isIdle     = status === 'idle';
  const isComplete = status === 'complete';
  const isPaused   = status === 'paused';
  const isError    = status === 'error';

  const { notify } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click / Escape — same popover behaviour as AccountMenu.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const phaseDone = (id: string) => phases.find(p => p.id === id)?.status === 'done';

  // Stage-1 spans scan → assembly; 'assembly' finishing is what actually means
  // "the analysis is done", not status === 'complete' (which the backend also
  // reports at the end of every Stage-2 sub-stage).
  const stage1Done = phaseDone('assembly');
  const stage1Reachable = (isIdle || isComplete || isError) && planPhaseDone;

  const noProjectReason = !hasProject ? 'Open a project folder first' : '';

  const actions: PipelineAction[] = [
    {
      id: 'scanner',
      label: 'Scanner Agent',
      rerunLabel: 'Re-run Scanner Agent',
      done: planPhaseDone,
      busy: !!isTriggeringScannerAgent,
      available: hasProject && !!onTriggerScannerAgent,
      disabled: !!isTriggeringScannerAgent,
      disabledReason: '',
      onRun: () => onTriggerScannerAgent?.(),
    },
    {
      id: 'stage1',
      label: isError ? 'Retry Analysis' : 'Start Stage-1 Analysis',
      rerunLabel: 'Re-run Stage-1 Analysis',
      done: stage1Done,
      busy: isRunning,
      available: stage1Reachable,
      disabled: !hasProject,
      disabledReason: noProjectReason,
      onRun: () => {
        if (!hasProject) { notify({ type: 'warning', message: noProjectReason }); return; }
        onStart();
      },
    },
    {
      id: 'planning',
      label: 'Start Code Migration',
      rerunLabel: 'Re-plan Migration',
      done: !!migrationPlanningDone,
      busy: !!isPlanning,
      available: !!detectedStack && planPhaseDone && (isComplete || !!isPlanning || !!migrationPlanningDone) && !!onStartMigration,
      disabled: !canStartMigration || !!isPlanning,
      disabledReason: migrationDisabledReason ?? '',
      onRun: () => onStartMigration?.(),
    },
    {
      id: 'generation',
      label: 'Generate Code',
      rerunLabel: 'Re-generate Code',
      done: !!codeGenerationDone,
      busy: !!isGenerating,
      available: !!migrationPlanningDone && !isPlanning && !!onStartGeneration,
      disabled: !!isGenerating || planApproved === false,
      disabledReason: planApproved === false ? (generationDisabledReason ?? '') : '',
      onRun: () => onStartGeneration?.(),
    },
    {
      id: 'verification',
      label: 'Verify Code',
      rerunLabel: 'Re-verify',
      done: !!verificationDone,
      busy: !!isVerifying,
      available: (generatedCount ?? 0) > 0 && !isGenerating && !!onStartVerification,
      disabled: !!isVerifying,
      disabledReason: '',
      onRun: () => onStartVerification?.(),
    },
  ];

  const availableActions = actions.filter(a => a.available);
  // The next step = the earliest available stage that hasn't completed yet.
  // Everything else available (already-done stages, re-runs) goes in the menu.
  const primary = availableActions.find(a => !a.done) ?? null;
  const menuActions = availableActions.filter(a => a.id !== primary?.id);

  const busyLabel: Record<string, string> = {
    scanner: 'Triggering Scanner Agent...',
    stage1: 'Analyzing...',
    planning: 'Planning Migration...',
    generation: 'Generating Code...',
    verification: 'Verifying...',
  };

  // Only the furthest-along completion badge is shown. Stacking one per finished
  // stage turned the panel into a wall of green cards that pushed the actual
  // next step below the fold.
  const latestBadge =
    verificationDone && !isVerifying ? (
      <span>
        Verification complete — {verifiedCount ?? 0} verified
        {verificationFailedCount ? `, ${verificationFailedCount} still failing` : ''}.
      </span>
    ) : codeGenerationDone && !isGenerating ? (
      <span>
        Code generation complete — {generatedCount ?? 0} generated
        {needsReviewCount ? `, ${needsReviewCount} need review` : ''}
        {failedCount ? `, ${failedCount} failed` : ''}.
      </span>
    ) : migrationPlanningDone && !isPlanning ? (
      <span>Migration plan ready — review below.</span>
    ) : stage1Done && isComplete ? (
      <span>Stage-1 Analysis complete!</span>
    ) : null;

  return (
    <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Pause + Stop (while running) — never collapsed into the menu; stopping
          a run has to stay one click away. */}
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

      {/* The one next step */}
      {!isRunning && !isPaused && primary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            className="btn-premium btn-premium--primary"
            onClick={primary.onRun}
            disabled={primary.disabled}
            title={primary.disabled ? primary.disabledReason : undefined}
            style={{ opacity: primary.disabled ? 0.45 : 1 }}
          >
            {primary.id === 'scanner' ? <Bot size={13} /> : <Play size={13} />}
            <span>{primary.busy ? busyLabel[primary.id] : primary.label}</span>
          </button>

          {primary.disabled && primary.disabledReason && (
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
              <span>{primary.disabledReason}</span>
            </div>
          )}
        </div>
      )}

      {/* Everything else that can be run — collapsed by default */}
      {!isRunning && !isPaused && menuActions.length > 0 && (
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            className="btn-premium btn-premium--secondary"
            onClick={() => setMenuOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={13} />
            <span>More actions ({menuActions.length})</span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
              }}
            >
              {menuActions.map(action => (
                <button
                  key={action.id}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    if (action.disabled) {
                      if (action.disabledReason) notify({ type: 'warning', message: action.disabledReason });
                      return;
                    }
                    action.onRun();
                  }}
                  title={action.disabled ? action.disabledReason : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px', width: '100%',
                    background: 'transparent', border: 'none', cursor: action.disabled ? 'default' : 'pointer',
                    color: action.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontSize: '12px', textAlign: 'left', padding: '7px 9px', borderRadius: '4px',
                    opacity: action.disabled ? 0.55 : 1,
                  }}
                  onMouseEnter={e => { if (!action.disabled) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {action.done ? <RotateCcw size={12} /> : <Play size={12} />}
                  <span>{action.done ? action.rerunLabel : action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Latest completion badge */}
      {latestBadge && (
        <div className="completion-badge-premium">
          <CheckCircle2 size={16} />
          {latestBadge}
        </div>
      )}
    </div>
  );
}
