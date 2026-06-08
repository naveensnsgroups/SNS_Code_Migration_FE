// =============================================================================
//  components/ai-panel/PipelineProgress.tsx
//  Live migration progress bar + phase status badges.
//  Shown while migration is running or complete.
// =============================================================================
'use client';

import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import type { MigrationPhase } from '@/types';

// ── Phase icon helper ─────────────────────────────────────────────────────────

function PhaseIcon({ status }: { status: MigrationPhase['status'] }) {
  switch (status) {
    case 'done':   return <CheckCircle2 className="phase-item__icon-svg text-success" size={14} />;
    case 'active': return <RefreshCw    className="phase-item__icon-svg spin text-blue" size={14} />;
    case 'error':  return <AlertCircle  className="phase-item__icon-svg text-error" size={14} />;
    default:       return <div className="phase-item__icon-dot" />;
  }
}

// ── Progress bar ──────────────────────────────────────────────────────────────

interface ProgressBarProps {
  progress: number;
  currentFile: string;
}

function ProgressBar({ progress, currentFile }: ProgressBarProps) {
  return (
    <div className="ai-section progress-section-premium">
      <div className="progress-header">
        <span>Modernisation Pipeline</span>
        <span className="progress-percentage">{progress}%</span>
      </div>
      <div className="progress-bar-container">
        <div className="progress-bar-fill-premium" style={{ width: `${progress}%` }} />
      </div>
      {currentFile && (
        <div className="progress-current-file">
          <span className="pulse-indicator" />
          <span className="file-name-text">Processing: {currentFile}</span>
        </div>
      )}
    </div>
  );
}

// ── Phase List ────────────────────────────────────────────────────────────────

function PhaseList({ phases }: { phases: MigrationPhase[] }) {
  return (
    <div className="ai-section">
      <div className="ai-section__title">
        <span>Pipeline Stages</span>
      </div>
      <div className="phase-list-premium">
        {phases.map(p => (
          <div key={p.id} className={`phase-item-premium ${p.status}`}>
            <span className="phase-item-icon-wrapper"><PhaseIcon status={p.status} /></span>
            <span className="phase-item-label-text">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

interface Props {
  phases: MigrationPhase[];
  progress: number;
  currentFile: string;
  isRunning: boolean;
  isComplete: boolean;
}

export default function PipelineProgress({ phases, progress, currentFile, isRunning, isComplete }: Props) {
  return (
    <>
      {isRunning && <ProgressBar progress={progress} currentFile={currentFile} />}
      {(isRunning || isComplete) && <PhaseList phases={phases} />}
    </>
  );
}
