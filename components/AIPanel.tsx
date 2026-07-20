// Operational Panel orchestrator — manages provider/model + target-config state;
// rendering is delegated to focused sub-components in components/ai-panel/.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, CheckCircle2, ArrowDown, AlertTriangle } from 'lucide-react';
import type { DetectedStack, MigrationStatus, MigrationPhase, TargetStack, AIProvider, MigrationTaskEntry, RuleCoverageEntry, GraphResolutionSummary } from '@/types';
import type { LogEntry } from '@/types';
import type { ReportedIssue, VerificationReport } from '@/services/api';

import { readSettings } from '@/hooks/useSettings';
import { useLiveStatus } from '@/hooks/useLiveStatus';
import { detectCheckpoint } from '@/utils/checkpoint';

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
  validFileCount?:  number;
  emptyFileCount?:  number;
  emptyFiles?:      Array<{ path: string; reason: string }>;
  /** Cross-check of the analysis report against actual source files — null
   * until the Verification Agent runs. */
  verificationReport?: VerificationReport | null;
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
  // Scanner Agent — separate external webhook, fired after the project is
  // already uploaded/saved, before Stage-1 Analysis.
  isTriggeringScannerAgent?: boolean;
  onTriggerScannerAgent?: () => void;
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
  planSanityWarning?: string | null;
  reportedIssues?: ReportedIssue[];
  onReportIssue?: (stage: string, text: string) => Promise<void>;
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
  detectedStack, validFileCount, emptyFileCount, emptyFiles, verificationReport, status, phases, progress, currentFile,
  logs, hasProject, activeTool, toolCallHistory,
  onStart, onStop, onPause,
  isTriggeringScannerAgent, onTriggerScannerAgent,
  graphResolutionSummary, isCheckpointBusy, onContinueAnalysis, onSkipToStage2,
  lastEventAt = null, runStartedAt = null, phaseDurations = {}, onReconnect,
  settingsTrigger = 0, onSettingsSaved, width,
  migrationTaskList, ruleCoverageReport, planSanityWarning, reportedIssues, onReportIssue,
  isPlanning, onStartMigration,
  isGenerating, onStartGeneration,
  isVerifying, onStartVerification,
}: Props) {
  // Model starts as '' — readSettings() fills it immediately in useEffect below
  const [provider, setProvider] = useState<AIProvider>('google');
  const [model,    setModel]    = useState('');

  // ── User-typed target stack values (persisted to localStorage) ─────────────
  // Split frontend/backend framework — a migration targets each independently
  // (e.g. React -> Next.js, Express -> NestJS), so one shared field can't
  // represent both. See the TargetStack type comment for the full reasoning.
  const [targetFrontendFramework, setTargetFrontendFramework] = useState('');
  const [targetBackendFramework,  setTargetBackendFramework]  = useState('');
  const [targetDb,        setTargetDb]        = useState('');
  const [targetLang,      setTargetLang]      = useState('');
  const [testFramework,   setTestFramework]   = useState('');

  // ── Derived flags ──────────────────────────────────────────────────────────
  const isRunning     = ['scanning', 'planning'].includes(status);
  const isComplete    = status === 'complete';
  // Gates the Stage-2 "Start Code Migration" button in ActionButtons.
  const scanPhaseDone = phases.find(p => p.id === 'scan')?.status === 'done';

  // ── Target Configuration lock ───────────────────────────────────────────────
  // Once a migration plan exists, the values in Target Configuration have already
  // been "consumed" — the plan (and any generated code) was built against exactly
  // those values. Leaving the fields freely editable after that point lets the
  // displayed config silently drift out of sync with what's actually on disk:
  // change "Target Framework" after code was generated for Fastapi, and it's no
  // longer clear what "Verify Code" is even checking against.
  //
  // targetConfigUnlocked is a deliberate, explicit opt-in (via the section's Edit
  // affordance) — not tied to component state that could reset unexpectedly, since
  // an accidental unlock defeats the whole point of locking.
  const [targetConfigUnlocked, setTargetConfigUnlocked] = useState(false);
  // Snapshot taken at the moment of unlocking, restored verbatim on Cancel — the
  // same "edit / save / cancel" pattern as any settings form.
  const targetConfigSnapshotRef = useRef<{ frontendFramework: string; backendFramework: string; db: string; lang: string; test: string } | null>(null);

  const targetConfigHasPlan = !!migrationTaskList && migrationTaskList.length > 0;
  const targetConfigBusy    = !!isPlanning || !!isGenerating || !!isVerifying;
  // Locked = busy (never editable while a sub-stage is actually running, no
  // matter what) OR (a plan exists AND the user hasn't explicitly unlocked it).
  const targetConfigLocked  = targetConfigBusy || (targetConfigHasPlan && !targetConfigUnlocked);

  // New Project wipes hasProject back to false — without this, a stale "unlocked"
  // flag from the previous project would carry over and let the NEXT project's
  // freshly-created plan start out incorrectly editable.
  useEffect(() => {
    if (!hasProject) {
      setTargetConfigUnlocked(false);
      targetConfigSnapshotRef.current = null;
    }
  }, [hasProject]);

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

  // HITL checkpoint banner — the same shared detector the Live Activity panel uses,
  // so both frame every pause (Stage 1 done, plan ready, code generated) identically.
  // Returns null mid-run and when the migration is genuinely complete.
  const checkpoint = detectCheckpoint(status, phases);

  // ── Live Status Overlay toggle (manual only) ───────────────────────────
  const [liveOpen, setLiveOpen] = useState(false);

  // Derive real-time live status from logs
  const liveData = useLiveStatus(logs, progress, currentFile, activeTool, toolCallHistory);

  // ── Sync settings from localStorage on trigger ────────────────────────────
  useEffect(() => {
    const s = readSettings();
    setProvider(s.provider);
    setModel(s.model);

    setTargetFrontendFramework(getLocal('setting_target_frontend_framework'));
    setTargetBackendFramework(getLocal('setting_target_backend_framework'));
    setTargetDb(getLocal('setting_target_database'));
    setTestFramework(getLocal('setting_testing_framework'));
    setTargetLang(getLocal('setting_target_lang'));
  }, [settingsTrigger]);

  // ── Re-sync model when provider changes ────────────────────────────────────
  useEffect(() => {
    const s = readSettings();
    setModel(s.model);
  }, [provider]);

  // ── Setting save helper ───────────────────────────────────────────────────
  const save = useCallback((key: string, value: string) => {
    setLocal(key, value);
    onSettingsSaved?.();
  }, [onSettingsSaved]);

  // ── Start handler — sends exactly what the user typed, no auto-fill ────────
  const handleStart = useCallback(() => {
    onStart({
      provider,
      model,
      frontendFramework: targetFrontendFramework,
      backendFramework:  targetBackendFramework,
      database:      targetDb,
      language:      targetLang,
      // Send exactly what the user typed — no hardcoded fallback, same
      // discipline as `hasModel` above. An empty value means "not specified".
      testFramework,
      outputMode:    'direct',
    });
  }, [provider, model, targetFrontendFramework, targetBackendFramework, targetDb, targetLang, testFramework, onStart]);

  // ── Stage 2 — Start Migration Planning ─────────────────────────────────────
  const allTargetFieldsFilled =
    targetFrontendFramework.trim().length > 0 &&
    targetBackendFramework.trim().length > 0 &&
    targetDb.trim().length > 0 &&
    targetLang.trim().length > 0 &&
    testFramework.trim().length > 0;

  const canStartMigration = allTargetFieldsFilled;
  const migrationDisabledReason = !allTargetFieldsFilled
    ? 'Fill in all 5 Target Configuration fields first'
    : '';

  const handleStartMigration = useCallback(() => {
    onStartMigration?.({
      provider,
      model,
      frontendFramework: targetFrontendFramework,
      backendFramework:  targetBackendFramework,
      database:      targetDb,
      language:      targetLang,
      testFramework,
      outputMode:    'direct',
    });
    // Submitting starts a fresh planning run against whatever values are
    // current right now — re-lock immediately so the section reflects "this is
    // what's being planned with", not an editable state mid-run.
    setTargetConfigUnlocked(false);
  }, [provider, model, targetFrontendFramework, targetBackendFramework, targetDb, targetLang, testFramework, onStartMigration]);

  // ── Target Configuration edit / cancel (only relevant once a plan exists —
  // see targetConfigLocked above) ─────────────────────────────────────────────
  const handleRequestEditTargetConfig = useCallback(() => {
    targetConfigSnapshotRef.current = {
      frontendFramework: targetFrontendFramework, backendFramework: targetBackendFramework,
      db: targetDb, lang: targetLang, test: testFramework,
    };
    setTargetConfigUnlocked(true);
  }, [targetFrontendFramework, targetBackendFramework, targetDb, targetLang, testFramework]);

  const handleCancelEditTargetConfig = useCallback(() => {
    const snap = targetConfigSnapshotRef.current;
    if (snap) {
      setTargetFrontendFramework(snap.frontendFramework); save('setting_target_frontend_framework', snap.frontendFramework);
      setTargetBackendFramework(snap.backendFramework);   save('setting_target_backend_framework', snap.backendFramework);
      setTargetDb(snap.db);               save('setting_target_database', snap.db);
      setTargetLang(snap.lang);           save('setting_target_lang', snap.lang);
      setTestFramework(snap.test);        save('setting_testing_framework', snap.test);
    }
    setTargetConfigUnlocked(false);
  }, [save]);

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
      frontendFramework: targetFrontendFramework,
      backendFramework:  targetBackendFramework,
      database:      targetDb,
      language:      targetLang,
      testFramework,
      outputMode:    'direct',
    });
  }, [provider, model, targetFrontendFramework, targetBackendFramework, targetDb, targetLang, testFramework, onStartGeneration]);

  // ── Stage 2 — Start Verification ───────────────────────────────────────────
  const verifiedCount = (migrationTaskList ?? []).filter(t => t.status === 'verified').length;
  const verificationDone =
    verifiedCount > 0 ||
    (migrationTaskList ?? []).some(t => t.lastError?.includes('Unresolved cross-file reference'));

  const handleStartVerification = useCallback(() => {
    onStartVerification?.({
      provider,
      model,
      frontendFramework: targetFrontendFramework,
      backendFramework:  targetBackendFramework,
      database:      targetDb,
      language:      targetLang,
      testFramework,
      outputMode:    'direct',
    });
  }, [provider, model, targetFrontendFramework, targetBackendFramework, targetDb, targetLang, testFramework, onStartVerification]);

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
            <StackBadge
              detectedStack={detectedStack}
              validFileCount={validFileCount}
              emptyFileCount={emptyFileCount}
              emptyFiles={emptyFiles}
              targetFrontendFramework={targetFrontendFramework}
              targetBackendFramework={targetBackendFramework}
              targetDb={targetDb}
              targetLang={targetLang}
              targetTestFramework={testFramework}
            />

            {/* HITL checkpoint banner: makes it explicit that the run isn't "done"
                — it's the user's turn to review and start the next stage. Consistent
                framing at every checkpoint (Stage 1 done, plan ready, code generated),
                driven by the shared detector. Sits above the controls so the order
                of next steps reads top-to-bottom. */}
            {checkpoint && (
              <div className="stage1-checkpoint">
                <div className="stage1-checkpoint__head">
                  <CheckCircle2 size={15} style={{ color: 'var(--text-success)', flexShrink: 0 }} />
                  <span>{checkpoint.label}</span>
                </div>
                <p className="stage1-checkpoint__body">{checkpoint.hint}</p>
                <div className="stage1-checkpoint__next">
                  <ArrowDown size={11} /> Your turn — review, then continue below
                </div>
              </div>
            )}

            {/* Verification Agent warning: the analysis report/knowledge graph
                completed, but its claims didn't all check out against the actual
                source files. Distinct from the checkpoint banner above — that one
                says "your turn to continue", this one says "double-check before
                you trust what you're continuing with". Only critical-severity
                issues are listed here; minor ones are still in verificationReport
                for anyone who opens the raw file in Explorer. */}
            {verificationReport && verificationReport.verdict === 'needs-review' && (
              <div className="stage1-checkpoint" style={{ borderColor: 'var(--text-warning)' }}>
                <div className="stage1-checkpoint__head">
                  <AlertTriangle size={15} style={{ color: 'var(--text-warning)', flexShrink: 0 }} />
                  <span>Verification found issues — review before trusting the report</span>
                </div>
                <p className="stage1-checkpoint__body">{verificationReport.summary}</p>
                {verificationReport.issues.filter(i => i.severity === 'critical').length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {verificationReport.issues.filter(i => i.severity === 'critical').map((issue, idx) => (
                      <div key={idx} style={{ fontSize: '12px', padding: '6px 8px', borderRadius: '4px', background: 'var(--bg-warning-subtle, rgba(255,170,0,0.08))' }}>
                        <span
                          style={{
                            display: 'inline-block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
                            textTransform: 'uppercase', padding: '1px 6px', borderRadius: '3px', marginBottom: '4px',
                            color: issue.severity === 'critical' ? '#fff' : 'var(--text-warning)',
                            background: issue.severity === 'critical' ? 'var(--text-error, #d33)' : 'transparent',
                            border: issue.severity === 'critical' ? 'none' : '1px solid var(--text-warning)',
                          }}
                        >
                          {issue.severity}
                        </span>
                        <div style={{ color: 'var(--text-warning)', fontWeight: 600 }}>Claimed: {issue.claim}</div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>Actual: {issue.actualSourceFinding}</div>
                        <div style={{ color: 'var(--text-secondary)', opacity: 0.7, marginTop: '2px', wordBreak: 'break-all' }}>{issue.file}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Target Config — Stage-2 only; shown once code migration is the next
                step, not before/during Stage-1 analysis. See codeMigrationRelevant. */}
            {detectedStack && codeMigrationRelevant && (
              <TargetConfig
                detectedStack={detectedStack}
                targetFrontendFramework={targetFrontendFramework}
                targetBackendFramework={targetBackendFramework}
                targetDb={targetDb}
                targetLang={targetLang}
                testFramework={testFramework}
                hasPlan={targetConfigHasPlan}
                isBusy={targetConfigBusy}
                locked={targetConfigLocked}
                onRequestEdit={handleRequestEditTargetConfig}
                onCancelEdit={handleCancelEditTargetConfig}
                onFrontendFrameworkChange={v => { setTargetFrontendFramework(v); save('setting_target_frontend_framework', v); }}
                onBackendFrameworkChange={v  => { setTargetBackendFramework(v);  save('setting_target_backend_framework', v);  }}
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
              hasProject={hasProject}
              isTriggeringScannerAgent={isTriggeringScannerAgent}
              onTriggerScannerAgent={onTriggerScannerAgent}
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
              <MigrationTaskList
                tasks={migrationTaskList}
                ruleCoverage={ruleCoverageReport ?? []}
                sanityWarning={planSanityWarning ?? null}
                reportedIssues={reportedIssues ?? []}
                onReportIssue={onReportIssue}
                stage="migration-planning"
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
