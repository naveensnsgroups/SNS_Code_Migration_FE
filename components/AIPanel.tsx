// Operational Panel orchestrator — manages provider/model/API-key state; rendering
// is delegated to focused sub-components in components/ai-panel/.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, CheckCircle2, ArrowDown } from 'lucide-react';
import type { DetectedStack, MigrationStatus, MigrationPhase, TargetStack, AIProvider, MigrationTaskEntry, RuleCoverageEntry, GraphResolutionSummary } from '@/types';
import type { LogEntry } from '@/types';

import { readSettings } from '@/hooks/useSettings';
import { useLiveStatus } from '@/hooks/useLiveStatus';
import { ALL_PROVIDERS } from '@/constants/models';

import StackBadge         from '@/components/ai-panel/StackBadge';
import TargetConfig       from '@/components/ai-panel/TargetConfig';
import PipelineProgress   from '@/components/ai-panel/PipelineProgress';
import ActionButtons      from '@/components/ai-panel/ActionButtons';
import MigrationTaskList  from '@/components/ai-panel/MigrationTaskList';
import GraphReviewCheckpoint from '@/components/ai-panel/GraphReviewCheckpoint';
import LiveStatusOverlay  from '@/components/live-status/LiveStatusOverlay';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  detectedStack:    DetectedStack | null;
  status:           MigrationStatus;
  phases:           MigrationPhase[];
  progress:         number;
  currentFile:      string;
  logs:             LogEntry[];
  hasProject:       boolean;
  activeTool:       { name: string; args: string } | null;  // ← SSE-driven from useMigration
  /** SSE-driven completed tool call history — newest first, max 20 */
  toolCallHistory:  import('@/components/live-status/types').ToolCallHistoryItem[];
  onStart:          (target: TargetStack) => void;
  onStop:           () => void;
  onPause:          () => void;
  // HITL graph-review checkpoint (status 'awaiting-graph-review')
  graphResolutionSummary?: GraphResolutionSummary | null;
  isCheckpointBusy?: boolean;
  onContinueAnalysis?: () => void;
  onSkipToStage2?:     () => void;
  // Live-panel time awareness + manual reconnect
  lastEventAt?:  number | null;
  runStartedAt?: number | null;
  phaseDurations?: Record<string, number>;
  onReconnect?:  () => void;
  settingsTrigger?: number;
  onSettingsSaved?: () => void;
  width?:           number;
  // Stage 2 — Migration Planning
  migrationTaskList?:  MigrationTaskEntry[] | null;
  ruleCoverageReport?: RuleCoverageEntry[] | null;
  isPlanning?:         boolean;
  onStartMigration?:   (target: TargetStack) => void;
  // Stage 2 — Code Generation
  isGenerating?:       boolean;
  onStartGeneration?:  (target: TargetStack) => void;
  // Stage 2 — Verification
  isVerifying?:        boolean;
  onStartVerification?: (target: TargetStack) => void;
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
  detectedStack, status, phases, progress, currentFile,
  logs, hasProject, activeTool, toolCallHistory,
  onStart, onStop, onPause,
  graphResolutionSummary, isCheckpointBusy, onContinueAnalysis, onSkipToStage2,
  lastEventAt = null, runStartedAt = null, phaseDurations = {}, onReconnect,
  settingsTrigger = 0, onSettingsSaved, width,
  migrationTaskList, ruleCoverageReport, isPlanning, onStartMigration,
  isGenerating, onStartGeneration,
  isVerifying, onStartVerification,
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
  const isRunning     = ['scanning', 'planning'].includes(status);
  const isComplete    = status === 'complete';
  // Gates the Stage-2 "Start Code Migration" button in ActionButtons.
  const scanPhaseDone = phases.find(p => p.id === 'scan')?.status === 'done';

  // Target Configuration (framework/database/language/test) is a Stage-2 concern
  // only — Stage-1 analysis never reads those 4 fields (resolveStreamingProvider
  // uses only provider+model), and Stage 2's /plan takes its own fresh targetStack.
  // So the panel appears only once code migration is the actual next step —
  // after Stage-1 analysis completes, or while any Stage-2 sub-stage is active —
  // never before/during analysis.
  const codeMigrationRelevant =
    isComplete || isPlanning || isGenerating || isVerifying ||
    (!!migrationTaskList && migrationTaskList.length > 0);

  // Stage-honesty: a phase can show a clean "done" checkmark while having
  // produced hollow output. graphResolutionSummary.primaryGraphsEmpty is real
  // data that previously only surfaced inside the Graph Review checkpoint card —
  // never in the Pipeline stepper you actually watch throughout the run. Now it
  // does, via a distinct warning icon instead of a plain green check.
  const stageWarnings: Record<string, string> = {};
  if (graphResolutionSummary?.primaryGraphsEmpty) {
    stageWarnings['graph-resolution'] =
      'Resolved graphs (symbol / entity / api) are empty — see Graph Review before continuing.';
  }

  // Stage 1 finished, Stage 2 not started yet — a human checkpoint: review the
  // analysis, configure the target below, then start code migration.
  const stage1Checkpoint =
    isComplete && (!migrationTaskList || migrationTaskList.length === 0);

  // ── Live Status Overlay toggle (manual only) ───────────────────────────
  const [liveOpen, setLiveOpen] = useState(false);

  // Derive real-time live status from logs
  const liveData = useLiveStatus(logs, progress, currentFile, activeTool, toolCallHistory);

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
    return ALL_PROVIDERS.some(p => {
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
      // Send exactly what the user typed — no hardcoded fallback, same
      // discipline as `hasModel` above. An empty value means "not specified".
      testFramework,
      outputMode:    'direct',
    });
  }, [provider, model, targetFramework, targetDb, targetLang, testFramework, onStart]);

  // ── Stage 2 — Start Migration Planning ─────────────────────────────────────
  const allTargetFieldsFilled =
    targetFramework.trim().length > 0 &&
    targetDb.trim().length > 0 &&
    targetLang.trim().length > 0 &&
    testFramework.trim().length > 0;

  const canStartMigration = hasApiKey && hasModel && allTargetFieldsFilled;
  const migrationDisabledReason = !allTargetFieldsFilled
    ? 'Fill in all 4 Target Configuration fields first'
    : !hasApiKey
    ? 'Add an API key in Settings first'
    : !hasModel
    ? 'Select a model in Settings first'
    : '';

  const handleStartMigration = useCallback(() => {
    onStartMigration?.({
      provider,
      model,
      framework:     targetFramework,
      database:      targetDb,
      language:      targetLang,
      testFramework,
      outputMode:    'direct',
    });
  }, [provider, model, targetFramework, targetDb, targetLang, testFramework, onStartMigration]);

  // ── Stage 2 — Start Code Generation ────────────────────────────────────────
  const generatedCount = (migrationTaskList ?? []).filter(t => t.status === 'generated' || t.status === 'verified').length;
  const failedCount    = (migrationTaskList ?? []).filter(t => t.status === 'failed').length;
  const codeGenerationDone =
    !!migrationTaskList && migrationTaskList.length > 0 &&
    migrationTaskList.every(t => t.status !== 'pending');

  const handleStartGeneration = useCallback(() => {
    onStartGeneration?.({
      provider,
      model,
      framework:     targetFramework,
      database:      targetDb,
      language:      targetLang,
      testFramework,
      outputMode:    'direct',
    });
  }, [provider, model, targetFramework, targetDb, targetLang, testFramework, onStartGeneration]);

  // ── Stage 2 — Start Verification ───────────────────────────────────────────
  const verifiedCount = (migrationTaskList ?? []).filter(t => t.status === 'verified').length;
  const verificationDone =
    verifiedCount > 0 ||
    (migrationTaskList ?? []).some(t => t.lastError?.includes('Unresolved cross-file reference'));

  const handleStartVerification = useCallback(() => {
    onStartVerification?.({
      provider,
      model,
      framework:     targetFramework,
      database:      targetDb,
      language:      targetLang,
      testFramework,
      outputMode:    'direct',
    });
  }, [provider, model, targetFramework, targetDb, targetLang, testFramework, onStartVerification]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <aside className="ai-panel" style={{ width: width ? `${width}px` : undefined }}>
      <div className="ai-panel__header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ flex: 1 }}>Operational Panel</span>

        {/* Live Activity toggle — SNS IDE CapabilityChip exact pattern */}
        <button
          className={`ls-toggle-btn ${liveOpen ? 'ls-toggle-btn--open' : ''}`}
          onClick={() => setLiveOpen(o => !o)}
          title={liveOpen ? 'Close Live Activity' : 'Open Live Activity'}
        >
          <Activity size={11} className="ls-toggle-btn__icon" />
          <span className="ls-toggle-btn__label">Live</span>
          {isRunning && !liveOpen && (
            <span className="ls-toggle-btn__dot" />
          )}
        </button>
      </div>

      {/* Live Activity and the Operational Panel's own content (Target
          Config, Pipeline Stages, Action Buttons, Migration Plan) are two
          DIFFERENT views — only one is ever mounted at a time. Toggling Live
          Activity fully unmounts the other panels instead of just visually
          covering them, so there's nothing left in the DOM that could ever
          leak/scroll into view underneath it. */}
      <div className="ai-panel__body" style={{ position: 'relative' }}>
        {liveOpen ? (
          <LiveStatusOverlay
            data={liveData}
            status={status}
            phases={phases}
            isRunning={isRunning}
            onClose={() => setLiveOpen(false)}
            lastEventAt={lastEventAt}
            runStartedAt={runStartedAt}
            phaseDurations={phaseDurations}
            onReconnect={onReconnect}
            stageWarnings={stageWarnings}
          />
        ) : (
          <>
            {/* Detected Stack */}
            <StackBadge detectedStack={detectedStack} />

            {/* Stage 1 → Stage 2 human checkpoint banner: makes it explicit that
                the run isn't "done" — it's the user's turn to review + configure
                + start code migration. Sits above Target Config so the order of
                next steps reads top-to-bottom. */}
            {stage1Checkpoint && (
              <div className="stage1-checkpoint">
                <div className="stage1-checkpoint__head">
                  <CheckCircle2 size={15} style={{ color: 'var(--text-success)', flexShrink: 0 }} />
                  <span>Stage 1 Analysis complete</span>
                </div>
                <p className="stage1-checkpoint__body">
                  Review <code>Stage1_Analysis.md</code> in the output workspace, then configure your
                  target below and start code migration.
                </p>
                <div className="stage1-checkpoint__next">
                  <ArrowDown size={11} /> Next: set Target Configuration
                </div>
              </div>
            )}

            {/* Target Config — Stage-2 only; shown once code migration is the next
                step, not before/during Stage-1 analysis. See codeMigrationRelevant. */}
            {detectedStack && codeMigrationRelevant && (
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

            {/* Live progress bar — stage-by-stage breakdown lives in Live Activity only */}
            <PipelineProgress
              progress={progress}
              currentFile={currentFile}
              isRunning={isRunning}
            />

            {/* HITL graph-review checkpoint — after Graph Resolution */}
            {status === 'awaiting-graph-review' && (
              <GraphReviewCheckpoint
                summary={graphResolutionSummary ?? null}
                isBusy={!!isCheckpointBusy}
                onContinue={() => onContinueAnalysis?.()}
                onSkip={() => onSkipToStage2?.()}
              />
            )}

            {/* Action Buttons */}
            <ActionButtons
              status={status}
              detectedStack={detectedStack}
              hasApiKey={hasApiKey}
              hasModel={hasModel}
              hasProject={hasProject}
              planPhaseDone={scanPhaseDone}
              onStart={handleStart}
              onStop={onStop}
              onPause={onPause}
              canStartMigration={canStartMigration}
              migrationDisabledReason={migrationDisabledReason}
              isPlanning={isPlanning}
              migrationPlanningDone={!!migrationTaskList && migrationTaskList.length > 0}
              onStartMigration={onStartMigration ? handleStartMigration : undefined}
              isGenerating={isGenerating}
              codeGenerationDone={codeGenerationDone}
              generatedCount={generatedCount}
              failedCount={failedCount}
              onStartGeneration={onStartGeneration ? handleStartGeneration : undefined}
              isVerifying={isVerifying}
              verificationDone={verificationDone}
              verifiedCount={verifiedCount}
              verificationFailedCount={failedCount}
              onStartVerification={onStartVerification ? handleStartVerification : undefined}
            />

            {/* Stage 2 — Migration Plan review (the human checkpoint) */}
            {migrationTaskList && migrationTaskList.length > 0 && (
              <MigrationTaskList tasks={migrationTaskList} ruleCoverage={ruleCoverageReport ?? []} />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
