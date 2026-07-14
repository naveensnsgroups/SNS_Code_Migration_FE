// Target stack inputs — free-text, no hardcoded option arrays. Persisted to
// localStorage on every keystroke, sent to the backend on Start.
//
// Locking: once a migration plan exists, these values have already been
// "consumed" by that plan (and possibly by generated code). Leaving them freely
// editable afterward would let the displayed config silently drift out of sync
// with what's actually on disk. So past that point the fields go read-only,
// with an explicit Edit / Cancel affordance — the same pattern any settings
// form uses — rather than a permanent, unexplained lock.
'use client';

import { Terminal, Pencil, X, Loader2 } from 'lucide-react';
import type { DetectedStack } from '@/types';

interface Props {
  detectedStack:     DetectedStack;
  targetFramework:   string;
  targetDb:          string;
  targetLang:        string;
  testFramework:     string;
  /** A migration plan already exists — switches the section into locked/edit-explicitly mode. */
  hasPlan:           boolean;
  /** A Stage-2 sub-stage is actively running — fields are never editable regardless of hasPlan/locked. */
  isBusy:            boolean;
  /** Computed lock state: isBusy || (hasPlan && not explicitly unlocked). */
  locked:            boolean;
  onRequestEdit:     () => void;
  onCancelEdit:      () => void;
  onFrameworkChange: (v: string) => void;
  onDbChange:        (v: string) => void;
  onLangChange:      (v: string) => void;
  onTestChange:      (v: string) => void;
}

interface InputRowProps {
  label:       string;
  id:          string;
  value:       string;
  placeholder: string;
  disabled:    boolean;
  hint?:       string;
  onChange:    (v: string) => void;
}

function InputRow({ label, id, value, placeholder, disabled, hint, onChange }: InputRowProps) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      {hint && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Detected: <span style={{ color: 'var(--text-info)', fontFamily: 'var(--font-mono)' }}>{hint}</span>
        </div>
      )}
      <input
        id={id}
        type="text"
        className="form-select-premium"
        style={{ fontFamily: 'var(--font-mono)' }}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

export default function TargetConfig({
  detectedStack, targetFramework, targetDb, targetLang, testFramework,
  hasPlan, isBusy, locked,
  onRequestEdit, onCancelEdit,
  onFrameworkChange, onDbChange, onLangChange, onTestChange,
}: Props) {
  // Only meaningful once a plan exists to protect — before that, fields are
  // always plainly editable and no lock UI is shown at all.
  const showEditButton  = hasPlan && !isBusy && locked;
  const showCancelButton = hasPlan && !isBusy && !locked;

  return (
    <div className="ai-section">
      <div className="target-config__header">
        <div className="ai-section__title" style={{ marginBottom: 0 }}>
          <Terminal size={12} />
          <span>Target Configuration</span>
        </div>

        {isBusy && (
          <span className="target-config__status target-config__status--busy">
            <Loader2 size={11} className="spin" /> Running
          </span>
        )}
        {showEditButton && (
          <button
            type="button"
            className="target-config__edit-btn"
            onClick={onRequestEdit}
            title="Edit target configuration — this will require re-running Migration Planning"
          >
            <Pencil size={11} /> Edit
          </button>
        )}
        {showCancelButton && (
          <button
            type="button"
            className="target-config__cancel-btn"
            onClick={onCancelEdit}
            title="Discard changes and restore the values the current plan was built with"
          >
            <X size={11} /> Cancel
          </button>
        )}
      </div>

      {/* Once locked, the form itself adds nothing over a one-line summary — so
          it collapses entirely and only re-expands when the user asks to Edit.
          This must stay collapsed while busy too (Re-plan/Re-generate/Verify
          running against an existing plan) — busy is itself a form of locked,
          not a reason to re-expand the full form. The only case that genuinely
          needs the full form while "busy" is the very first Migration Planning
          run, before any plan exists yet — hasPlan is false then, so it falls
          through to the form below regardless of lock state. */}
      {hasPlan && locked && (
        <div className="target-config__summary">
          {[targetFramework, targetDb, targetLang, testFramework].filter(Boolean).join(' · ') || 'No values set'}
        </div>
      )}

      {!(hasPlan && locked) && (
        <>
          {hasPlan && !locked && !isBusy && (
            <div className="target-config__hint target-config__hint--editing">
              Editing — changes only take effect after you click Re-plan Migration below.
            </div>
          )}

          <InputRow
            id="target-framework"
            label="Target Framework"
            value={targetFramework}
            placeholder="e.g. NestJS, FastAPI, Quarkus…"
            // Layer Analysis annotates the "API / Bridge Layer" row (detectedStack.apiLayer)
            // with this same targetFramework value — the hint here must show the SAME
            // detected field, or the two disagree (e.g. "Detected: None" here next to
            // "CGI (Common Gateway Interface)" there, for the identical concept).
            hint={detectedStack.apiLayer}
            disabled={locked}
            onChange={onFrameworkChange}
          />

          <InputRow
            id="target-database"
            label="Target Database"
            value={targetDb}
            placeholder="e.g. PostgreSQL, MongoDB, SQLite…"
            hint={detectedStack.database}
            disabled={locked}
            onChange={onDbChange}
          />

          <InputRow
            id="target-language"
            label="Target Language"
            value={targetLang}
            placeholder="e.g. TypeScript, Python 3, Java 21…"
            hint={detectedStack.language}
            disabled={locked}
            onChange={onLangChange}
          />

          <InputRow
            id="target-test-framework"
            label="Testing Framework"
            value={testFramework}
            placeholder="e.g. vitest, jest, pytest, junit…"
            disabled={locked}
            onChange={onTestChange}
          />
        </>
      )}
    </div>
  );
}
