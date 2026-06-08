// =============================================================================
//  components/ai-panel/ActionButtons.tsx
//  Start / Pause / Stop / Resume action buttons for the pipeline.
//
//  Button enable logic:
//    Stage-1 "Start Analysis"  → enabled when hasProject && hasApiKey
//                                (does NOT need detectedStack — this IS the scan)
//    Stage-2 "Start Migration" → enabled when detectedStack && hasApiKey
//    Pause / Stop              → shown only while running
//    Resume                    → shown only when paused
// =============================================================================
'use client';

import { Play, Pause, Square, CheckCircle2, AlertCircle } from 'lucide-react';
import type { MigrationStatus, DetectedStack } from '@/types';

interface Props {
  status:        MigrationStatus;
  detectedStack: DetectedStack | null;
  hasApiKey:     boolean;
  hasModel:      boolean;
  hasProject:    boolean;
  planPhaseDone: boolean;
  onStart:  () => void;
  onStop:   () => void;
  onPause:  () => void;
}

export default function ActionButtons({
  status, detectedStack, hasApiKey, hasModel, hasProject, planPhaseDone,
  onStart, onStop, onPause,
}: Props) {
  const isRunning  = ['scanning', 'planning', 'pseudocode', 'migrating', 'building', 'validating', 'testing'].includes(status);
  const isIdle     = status === 'idle';
  const isComplete = status === 'complete';
  const isPaused   = status === 'paused';
  const isError    = status === 'error';

  // Stage determines label and enable condition
  const isStage1 = !planPhaseDone;  // before plan is done → Stage-1 scan/analysis
  const buttonLabel = isStage1 ? 'Start Stage-1 Analysis' : 'Start Modernisation';

  // Stage-1: need project + API key + model
  // Stage-2: additionally need detectedStack
  const canStart = isStage1
    ? (hasProject && hasApiKey && hasModel)
    : (hasProject && hasApiKey && hasModel && !!detectedStack);

  // Clear message for each missing condition
  const disabledReason = !hasProject
    ? 'Open a project folder first'
    : !hasApiKey
    ? 'Add an API key in Settings first'
    : !hasModel
    ? 'Select a model in Settings first'
    : !canStart && !isStage1
    ? 'Complete Stage-1 scan first'
    : '';

  return (
    <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Start / Re-run — shown when idle, complete, or error */}
      {(isIdle || isComplete || isError) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            className="btn-premium btn-premium--primary"
            onClick={onStart}
            disabled={!canStart}
            title={!canStart ? disabledReason : buttonLabel}
            style={{ opacity: canStart ? 1 : 0.45 }}
          >
            <Play size={13} />
            <span>{isError ? 'Retry Analysis' : buttonLabel}</span>
          </button>

          {/* Explain why disabled */}
          {!canStart && disabledReason && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '11px', color: 'var(--text-warning)',
              background: 'rgba(204,167,0,0.08)', border: '1px solid rgba(204,167,0,0.2)',
              borderRadius: '4px', padding: '5px 8px'
            }}>
              <AlertCircle size={11} />
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
          <span>Modernisation complete!</span>
        </div>
      )}
    </div>
  );
}
