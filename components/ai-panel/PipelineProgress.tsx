// Live migration progress bar. The stage-by-stage breakdown lives exclusively in
// the Live Activity panel (StageStepper in LiveStatusOverlay.tsx) — it was
// duplicated here too and just added clutter/redundancy to an already-long panel.
'use client';

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

// ── Main Export ───────────────────────────────────────────────────────────────

interface Props {
  progress: number;
  currentFile: string;
  isRunning: boolean;
}

export default function PipelineProgress({ progress, currentFile, isRunning }: Props) {
  return isRunning ? <ProgressBar progress={progress} currentFile={currentFile} /> : null;
}
