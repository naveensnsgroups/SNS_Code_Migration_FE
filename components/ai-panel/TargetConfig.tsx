// Target stack inputs — free-text, no hardcoded option arrays. Persisted to
// localStorage on every keystroke, sent to the backend on Start.
'use client';

import { Terminal } from 'lucide-react';
import type { DetectedStack } from '@/types';

interface Props {
  detectedStack:     DetectedStack;
  targetFramework:   string;
  targetDb:          string;
  targetLang:        string;
  testFramework:     string;
  disabled:          boolean;
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
  disabled, onFrameworkChange, onDbChange, onLangChange, onTestChange,
}: Props) {
  return (
    <div className="ai-section">
      <div className="ai-section__title">
        <Terminal size={12} />
        <span>Target Configuration</span>
      </div>

      <InputRow
        id="target-framework"
        label="Target Framework"
        value={targetFramework}
        placeholder="e.g. NestJS, FastAPI, Quarkus…"
        hint={detectedStack.framework}
        disabled={disabled}
        onChange={onFrameworkChange}
      />

      <InputRow
        id="target-database"
        label="Target Database"
        value={targetDb}
        placeholder="e.g. PostgreSQL, MongoDB, SQLite…"
        hint={detectedStack.database}
        disabled={disabled}
        onChange={onDbChange}
      />

      <InputRow
        id="target-language"
        label="Target Language"
        value={targetLang}
        placeholder="e.g. TypeScript, Python 3, Java 21…"
        hint={detectedStack.language}
        disabled={disabled}
        onChange={onLangChange}
      />

      <InputRow
        id="target-test-framework"
        label="Testing Framework"
        value={testFramework}
        placeholder="e.g. vitest, jest, pytest, junit…"
        disabled={disabled}
        onChange={onTestChange}
      />
    </div>
  );
}
