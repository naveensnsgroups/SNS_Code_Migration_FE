// =============================================================================
//  components/AIPanel.tsx  —  Operational Panel (right sidebar)
//
//  Orchestrator only: manages provider/model/API-key state and settings sync.
//  Rendering is delegated to focused sub-components in components/ai-panel/.
//
//  Sub-components:
//    StackBadge       — detected stack display
//    TargetConfig     — target framework/db/language/test free-text inputs
//    PipelineProgress — live progress bar + phase badges
//    ActionButtons    — Start / Pause / Stop / Resume
// =============================================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DetectedStack, MigrationStatus, MigrationPhase, TargetStack, AIProvider } from '@/types';

import { readSettings } from '@/hooks/useSettings';

import StackBadge       from '@/components/ai-panel/StackBadge';
import TargetConfig     from '@/components/ai-panel/TargetConfig';
import PipelineProgress from '@/components/ai-panel/PipelineProgress';
import ActionButtons    from '@/components/ai-panel/ActionButtons';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  detectedStack:    DetectedStack | null;
  status:           MigrationStatus;
  phases:           MigrationPhase[];
  progress:         number;
  currentFile:      string;
  hasProject:       boolean;
  onStart:          (target: TargetStack) => void;
  onStop:           () => void;
  onPause:          () => void;
  settingsTrigger?: number;
  onSettingsSaved?: () => void;
  width?:           number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getLocal(key: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return raw || fallback; }
}

function setLocal(key: string, value: string) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIPanel({
  detectedStack, status, phases, progress, currentFile, hasProject,
  onStart, onStop, onPause,
  settingsTrigger = 0, onSettingsSaved, width,
}: Props) {
  // Model and apiKey start as '' — readSettings() fills them immediately in useEffect below
  const [provider, setProvider] = useState<AIProvider>('google');
  const [model,    setModel]    = useState('');
  const [apiKey,   setApiKey]   = useState('');

  // ── User-typed target stack values (persisted to localStorage) ─────────────
  const [targetFramework, setTargetFramework] = useState('');
  const [targetDb,        setTargetDb]        = useState('');
  const [targetLang,      setTargetLang]      = useState('');
  const [testFramework,   setTestFramework]   = useState('');

  // ── Derived flags ──────────────────────────────────────────────────────────
  const isRunning     = ['scanning', 'planning', 'pseudocode', 'migrating', 'building', 'validating', 'testing'].includes(status);
  const isComplete    = status === 'complete';
  const planPhaseDone = phases.find(p => p.id === 'plan')?.status === 'done';

  // ── Sync settings from localStorage on trigger ────────────────────────────
  useEffect(() => {
    const s = readSettings();
    setProvider(s.provider);
    setModel(s.model);
    setApiKey(s.apiKey);

    setTargetFramework(getLocal('setting_target_framework'));
    setTargetDb(getLocal('setting_target_database'));
    setTestFramework(getLocal('setting_testing_framework'));
    setTargetLang(getLocal('setting_target_lang'));
  }, [settingsTrigger]);

  // ── Re-sync model + key when provider changes ─────────────────────────────
  useEffect(() => {
    const s = readSettings();
    setModel(s.model);
    setApiKey(s.apiKey);
  }, [provider]);

  // ── Setting save helper ───────────────────────────────────────────────────
  const save = useCallback((key: string, value: string) => {
    setLocal(key, value);
    onSettingsSaved?.();
  }, [onSettingsSaved]);

  // ── API key + model checks ──────────────────────────────────────────────────
  const hasApiKey = (() => {
    if (apiKey.trim()) return true;
    if (typeof window === 'undefined') return false;
    const providers = ['anthropic', 'openai', 'google', 'grok', 'groq', 'openrouter', 'huggingface'];
    return providers.some(p => {
      const raw = localStorage.getItem(`setting_${p}_api_key`);
      if (!raw) return false;
      try { return !!(JSON.parse(raw)?.trim()); } catch { return !!raw.trim(); }
    });
  })();

  // Model must be explicitly set by the user in Settings — no hardcoded fallback
  const hasModel = model.trim().length > 0;

  // ── Start handler — sends exactly what the user typed, no auto-fill ────────
  const handleStart = useCallback(() => {
    onStart({
      provider,
      model,
      framework:     targetFramework,
      database:      targetDb,
      language:      targetLang,
      testFramework: testFramework || 'vitest',
      outputMode:    'direct',
    });
  }, [provider, model, targetFramework, targetDb, targetLang, testFramework, onStart]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <aside className="ai-panel" style={{ width: width ? `${width}px` : undefined }}>
      <div className="ai-panel__header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>Operational Panel</span>
      </div>

      <div className="ai-panel__body">

        {/* Detected Stack */}
        <StackBadge detectedStack={detectedStack} />

        {/* Target Config — free-text inputs, visible after Stage-1 plan */}
        {detectedStack && planPhaseDone && (
          <TargetConfig
            detectedStack={detectedStack}
            targetFramework={targetFramework}
            targetDb={targetDb}
            targetLang={targetLang}
            testFramework={testFramework}
            disabled={isRunning}
            onFrameworkChange={v => { setTargetFramework(v); save('setting_target_framework', v); }}
            onDbChange={v        => { setTargetDb(v);        save('setting_target_database', v);  }}
            onLangChange={v      => { setTargetLang(v);      save('setting_target_lang', v);       }}
            onTestChange={v      => { setTestFramework(v);   save('setting_testing_framework', v); }}
          />
        )}

        {/* Live progress + phase badges */}
        <PipelineProgress
          phases={phases}
          progress={progress}
          currentFile={currentFile}
          isRunning={isRunning}
          isComplete={isComplete}
        />

        {/* Action Buttons */}
        <ActionButtons
          status={status}
          detectedStack={detectedStack}
          hasApiKey={hasApiKey}
          hasModel={hasModel}
          hasProject={hasProject}
          planPhaseDone={planPhaseDone}
          onStart={handleStart}
          onStop={onStop}
          onPause={onPause}
        />

      </div>
    </aside>
  );
}
