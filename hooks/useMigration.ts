// Migration state, poll dispatch, and handlers. Migration Planning / Code
// Generation / Verification live in useCodeMigration.ts (reuses this hook's polling).
//
// Transport note: this used to be Server-Sent Events (a push connection). It's
// now polling — the backend can't hold a stream open (see usePolling.ts) — so
// every tick re-fetches the full session state and this file reduces that into
// UI state, instead of reducing individual pushed event frames.

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DetectedStack,
  FileNode,
  LogEntry,
  MigrationPhase,
  MigrationStatus,
  TargetStack,
  MIGRATION_PHASES,
  MigrationTaskEntry,
  RuleCoverageEntry,
  GraphResolutionSummary,
  STAGE1_ANALYSIS_VIRTUAL_PATH,
  KNOWLEDGE_GRAPH_FOLDER,
  KNOWLEDGE_GRAPH_CATEGORIES,
  knowledgeGraphVirtualPath,
} from '@/types';
import type { ToolCallHistoryItem } from '@/components/live-status/types';
import type { ReportedIssue, SessionStateResponse } from '@/services/api';
import {
  scanProject,
  triggerScannerAgent,
  triggerStage1Analysis,
  writeLocalOutput,
  cloneFromGithub,
  stopMigration,
  pauseMigration,
  fetchFileContent,
  fetchModernTree,
  fetchSessionTokens,
  fetchSessionState,
  fetchGraphSummary,
  continueAnalysis,
  skipToStage2,
  downloadFile,
} from '@/services/api';

import { readSettings } from '@/hooks/useSettings';
import { usePolling } from '@/hooks/usePolling';
import { useCodeMigration, UseCodeMigrationReturn } from '@/hooks/useCodeMigration';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// Runtime guards for poll payload fields — the backend's response shape can drift,
// so an unrecognized value falls back to a known-good default instead of an
// unchecked cast.
const VALID_LOG_LEVELS = new Set<LogEntry['level']>(['info', 'success', 'error', 'warning', 'command', 'stream']);
const VALID_MIGRATION_STATUSES = new Set<MigrationStatus>([
  'idle', 'scanning', 'planning', 'discovery', 'file-analysis',
  'graph-resolution', 'awaiting-graph-review', 'section-writing', 'assembly',
  'migration-planning', 'code-generation', 'verification', 'migration-assembly',
  'complete', 'error', 'paused',
]);
const VALID_PHASE_STATUSES = new Set<MigrationPhase['status']>(['pending', 'active', 'done', 'error']);

function safeLogLevel(value: unknown): LogEntry['level'] {
  return VALID_LOG_LEVELS.has(value as LogEntry['level']) ? (value as LogEntry['level']) : 'info';
}

// Statuses that mean "nothing will change server-side until the user (or a new
// handler call) does something" — polling stops here instead of re-fetching an
// unchanged response every tick. Mirrors what used to close the SSE connection.
const TERMINAL_STATUSES = new Set<MigrationStatus>(['idle', 'complete', 'error', 'paused', 'awaiting-graph-review']);

// Statuses the mount-restore effect will resume polling for — a session reloaded
// mid-run needs its poll loop restarted. code-generation/verification are
// deliberately excluded here, matching the same gap the old SSE reconnect had:
// neither sub-stage resumes live polling after a hard reload.
const RESUMABLE_STATUSES: MigrationStatus[] = [
  'scanning', 'planning', 'discovery', 'file-analysis',
  'graph-resolution', 'section-writing', 'assembly', 'migration-planning',
];

// Reconciles a phases array into a self-consistent state. The backend's persisted
// session phases can be internally inconsistent (e.g. 'discovery' left 'active'
// while later phases are 'done', on a checkpoint-resumed Stage 1), and that stuck
// state gets restored verbatim on page reload — showing a spinner that never stops.
//   1. Monotonicity: every phase before the furthest-progressed one must be 'done'.
//   2. If the whole run is 'complete', no phase may remain 'active'.
function reconcilePhases(phases: MigrationPhase[], status: MigrationStatus): MigrationPhase[] {
  const lastProgressedIdx = phases.reduce(
    (last, p, i) => (p.status === 'done' || p.status === 'active') ? i : last, -1
  );
  let result = phases.map((p, i) =>
    (i < lastProgressedIdx && p.status !== 'done') ? { ...p, status: 'done' as const } : p
  );
  if (status === 'complete') {
    result = result.map(p => p.status === 'active' ? { ...p, status: 'done' as const } : p);
  }
  return result;
}

// ── Token Usage State Type ────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  readCachedInputTokens?: number;
  totalTokens: number;
  /** null = no pricing rate configured for the model(s) used — never a guessed number. */
  estimatedCost: number | null;
  /** true = estimatedCost is a real but PARTIAL sum (some models used had no rate configured). */
  costIncomplete?: boolean;
  model?: string;
}

// ── Hook Return Type ──────────────────────────────────────────────────────────

export interface UseMigrationReturn {
  // State
  status: MigrationStatus;
  sessionId: string | null;
  fileTree: FileNode[];
  detectedStack: DetectedStack | null;
  selectedFile: string | null;
  legacyCode: string | null;
  modernCode: string | null;
  logs: LogEntry[];
  progress: number;
  currentFile: string;
  phases: MigrationPhase[];
  modernFileTree: FileNode[];
  modernFolderBasename: string;
  tokenUsage: TokenUsage | null;
  /** Stage-1 Analysis report (markdown) — null until the agent completes. Also
   * readable as a virtual Stage1_Analysis.md file via handleSelectFile. */
  analysisReport: string | null;
  /** Structured entities/relationships from Stage-1 Analysis — null until the
   * agent completes. Also readable as a virtual Stage1_KnowledgeGraph.json file. */
  knowledgeGraph: unknown;
  /** Validation counts, written alongside analysisReport — undefined/[] until
   * Stage-1 analysis actually completes, never a premature "0". */
  validFileCount: number | undefined;
  emptyFileCount: number | undefined;
  emptyFiles: { path: string; reason: string }[];
  isRunning: boolean;
  hasProject: boolean;
  activeTool: { name: string; args: string } | null;  // ← poll-driven, no log parsing
  /** Poll-driven completed tool call history — newest first, max 20 entries */
  toolCallHistory: ToolCallHistoryItem[];
  // Stage 2 — Migration Planning task list + rule coverage manifest, populated
  // once the 'migration-planning' phase reports 'done'. Null until then.
  migrationTaskList: MigrationTaskEntry[] | null;
  ruleCoverageReport: RuleCoverageEntry[] | null;
  planSanityWarning: string | null;
  reportedIssues: ReportedIssue[];
  handleReportIssue: (stage: string, text: string) => Promise<void>;
  isPlanning: boolean;
  isGenerating: boolean;
  isVerifying: boolean;
  // HITL graph-review checkpoint (status 'awaiting-graph-review')
  graphResolutionSummary: GraphResolutionSummary | null;
  isCheckpointBusy: boolean;
  // Live-panel time awareness — see the state declarations below for what each means.
  lastEventAt: number | null;
  runStartedAt: number | null;
  phaseDurations: Record<string, number>;
  reconnect: () => void;
  // Handlers
  handleUpload: (files: FileList | File[], explicitPaths?: string[]) => Promise<void>;
  // Scanner Agent — separate external webhook, fired after the project is
  // already uploaded/saved. isTriggeringScannerAgent is its own in-flight
  // flag, distinct from isRunning (no phase/status changes while it runs).
  isTriggeringScannerAgent: boolean;
  handleTriggerScannerAgent: () => Promise<void>;
  handleCloneFromGithub: (repoUrl: string, branch?: string) => Promise<void>;
  handleStart: (target: TargetStack) => Promise<void>;
  handleContinueAnalysis: () => Promise<void>;
  handleSkipToStage2: () => Promise<void>;
  handleStartMigrationPlanning: (target: TargetStack) => Promise<void>;
  handleStartCodeGeneration: (target: TargetStack) => Promise<void>;
  handleStartVerification: (target: TargetStack) => Promise<void>;
  handleStop: () => Promise<void>;
  handlePause: () => Promise<void>;
  handleSelectFile: (path: string, setActiveEditorTab: (t: 'code') => void) => Promise<void>;
  clearSelectedFile: () => void;
  handleDownload: (fileName: string) => void;
  handleNewProject: () => void;
}

// ── Main Hook ─────────────────────────────────────────────────────────────────

export function useMigration(
  backendUrl: string,
  onNotify?: (opts: { type: 'info' | 'success' | 'warning' | 'error'; message: string; persistent?: boolean }) => void
): UseMigrationReturn {
  const [status, setStatus]               = useState<MigrationStatus>('idle');
  const [sessionId, setSessionId]         = useState<string | null>(null);
  const [fileTree, setFileTree]           = useState<FileNode[]>([]);
  const [detectedStack, setDetectedStack] = useState<DetectedStack | null>(null);
  const [selectedFile, setSelectedFile]   = useState<string | null>(null);
  const [legacyCode, setLegacyCode]       = useState<string | null>(null);
  const [modernCode, setModernCode]       = useState<string | null>(null);
  const [logs, setLogs]                   = useState<LogEntry[]>([]);
  const [progress, setProgress]           = useState(0);
  const [currentFile, setCurrentFile]     = useState('');
  const [phases, setPhases]               = useState<MigrationPhase[]>(MIGRATION_PHASES);
  const [modernFileTree, setModernFileTree]           = useState<FileNode[]>([]);
  const [modernFolderBasename, setModernFolderBasename] = useState<string>('');
  const [tokenUsage, setTokenUsage]       = useState<TokenUsage | null>(null);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<unknown>(null);
  // Written alongside analysisReport by the same Stage-1 Update Document call —
  // stay undefined/[] until that point instead of showing a premature "0" during
  // the scan-only stage (see the analysisReport gate in applyPollResult below).
  const [validFileCount, setValidFileCount] = useState<number | undefined>(undefined);
  const [emptyFileCount, setEmptyFileCount] = useState<number | undefined>(undefined);
  const [emptyFiles, setEmptyFiles] = useState<{ path: string; reason: string }[]>([]);
  const [activeTool, setActiveTool]       = useState<{ name: string; args: string } | null>(null);
  // HITL graph-review checkpoint — the resolved-graph summary + an in-flight flag
  // for the continue/skip actions.
  const [graphResolutionSummary, setGraphResolutionSummary] = useState<GraphResolutionSummary | null>(null);
  const [isCheckpointBusy, setIsCheckpointBusy] = useState(false);
  // Tool call history — poll-driven, newest first, capped at 20
  const [toolCallHistory, setToolCallHistory] = useState<ToolCallHistoryItem[]>([]);
  // Ids of log entries already appended, so re-fetched backlogs from the backend
  // (see SessionStateResponse.logs) don't get duplicated into the client list.
  const seenLogIdsRef = React.useRef<Set<string>>(new Set());
  // Previous status, to detect transitions (poll ticks re-deliver the same
  // status repeatedly while nothing changes — only act once, on the edge).
  const prevStatusRef = React.useRef<MigrationStatus>('idle');
  // Previous phases snapshot for per-stage timing edges. A ref, not the `phases`
  // state itself — applyPollResult is handed to setInterval once per startPolling()
  // call, so if it read `phases` via closure it would see whatever value was
  // current AT THAT MOMENT forever, not the latest, on every later tick.
  const phasesRef = React.useRef<MigrationPhase[]>(MIGRATION_PHASES);
  // Last analysisReport text actually shown in the Terminal — content-keyed,
  // not transition-keyed. A transition-only check misses a report that lands
  // in MongoDB *after* status had already reached 'complete' once before
  // (e.g. re-running the agent after fixing a workflow bug) — status never
  // transitions again, so a transition-gated log would never fire for it.
  const lastLoggedAnalysisReportRef = React.useRef<string | null>(null);
  // Same content-keyed dedupe, for the knowledge graph's local-output write.
  const lastWrittenKnowledgeGraphRef = React.useRef<string | null>(null);

  // ── Live-panel time awareness ────────────────────────────────────────────
  // lastEventAt: timestamp of the most recent successful poll — lets the UI tell
  // "a stage is just slow" apart from "polling silently died", which previously
  // looked identical.
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  // runStartedAt: when the current run began — powers the elapsed-time display.
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  // Completed per-phase durations in ms, keyed by phase id. Best-effort: timed
  // client-side, so a page reload mid-run loses in-progress timing for that one
  // phase (no per-phase timestamps are persisted server-side) — not faked.
  const [phaseDurations, setPhaseDurations] = useState<Record<string, number>>({});
  // When each currently-active phase started (ms epoch), keyed by phase id.
  // A ref, not state — it's write-only bookkeeping for duration math, never
  // rendered directly, so it doesn't need to trigger re-renders on its own.
  const phaseStartedAtRef = React.useRef<Record<string, number>>({});

  // Ref bridge: applyPollResult must exist before useCodeMigration can be called (it
  // needs startPolling), so it can't reference useCodeMigration's return value
  // directly. Populated below.
  const codeMigrationRef = useRef<UseCodeMigrationReturn | null>(null);

  const isRunning     = ['scanning', 'planning', 'discovery', 'file-analysis', 'graph-resolution', 'section-writing', 'assembly'].includes(status);
  // Separate from isRunning — Pause/Stop don't affect this run, so they shouldn't show here.
  const isPlanning    = status === 'migration-planning';
  const isGenerating  = status === 'code-generation';
  const isVerifying   = status === 'verification';
  const hasProject    = fileTree.length > 0;

  // Capped client-side scrollback — TerminalPanel re-renders the full list on every
  // entry with no virtualization, so an unbounded array caused the platform to hang.
  const MAX_CLIENT_LOGS = 1500;
  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info', phase?: string) => {
    setLogs(prev => {
      const next = [...prev, { id: generateId(), timestamp: timestamp(), level, message, phase }];
      return next.length > MAX_CLIENT_LOGS ? next.slice(next.length - MAX_CLIENT_LOGS) : next;
    });
  }, []);

  // Merge backend-reported log lines in without duplicating ones already shown —
  // the backend is free to return its whole backlog every tick, or just new lines.
  const mergeBackendLogs = useCallback((incoming: LogEntry[] | undefined) => {
    if (!incoming || incoming.length === 0) return;
    const fresh = incoming.filter(l => !seenLogIdsRef.current.has(l.id));
    if (fresh.length === 0) return;
    fresh.forEach(l => seenLogIdsRef.current.add(l.id));
    setLogs(prev => {
      const next = [...prev, ...fresh.map(l => ({ ...l, level: safeLogLevel(l.level) }))];
      return next.length > MAX_CLIENT_LOGS ? next.slice(next.length - MAX_CLIENT_LOGS) : next;
    });
  }, []);

  // ── Modern file tree refresh ────────────────────────────────────────────────
  const refreshModernTree = useCallback(async (sid: string) => {
    try {
      const data = await fetchModernTree(backendUrl, sid);
      setModernFileTree(data.fileTree || []);
      if (data.modernPath) {
        const clean = data.modernPath.replace(/\\/g, '/');
        const parts = clean.split('/');
        setModernFolderBasename(parts[parts.length - 1] || data.modernPath);
      }
    } catch {
      setModernFileTree([]);
    }
  }, [backendUrl]);

  // Persist sessionId to localStorage so page refresh restores session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionId) {
      localStorage.setItem('last_session_id', sessionId);
    }
  }, [sessionId]);

  // Refresh modern tree whenever session changes
  useEffect(() => {
    if (sessionId) {
      refreshModernTree(sessionId);
    } else {
      setModernFileTree([]);
      setModernFolderBasename('');
    }
  }, [sessionId, refreshModernTree]);

  // Load persisted token usage so it survives a page refresh.
  useEffect(() => {
    if (!sessionId) {
      setTokenUsage(null);
      return;
    }
    fetchSessionTokens(backendUrl, sessionId)
      .then(data => {
        if (data.tokenUsage && data.tokenUsage.totalTokens > 0) {
          setTokenUsage(data.tokenUsage);
        }
      })
      .catch(() => { /* non-critical — next poll tick will populate */ });
  }, [sessionId, backendUrl]);

  // ── Poll-result reducer ─────────────────────────────────────────────────────
  // Applies one SessionStateResponse snapshot to UI state. Used both by the
  // mount-restore fetch and by every live poll tick — a poll tick is just
  // "fetch the same state endpoint again, apply it the same way."
  const applyPollResult = useCallback((state: SessionStateResponse, opts: { isInitialRestore: boolean }) => {
    const nextStatus = VALID_MIGRATION_STATUSES.has(state.status as MigrationStatus)
      ? (state.status as MigrationStatus)
      : null;
    if (!nextStatus) {
      addLog(`Received unrecognized migration status "${String(state.status)}" — ignored.`, 'warning');
      return;
    }

    const prevStatus = prevStatusRef.current;
    const transitioned = prevStatus !== nextStatus;

    // Guard against restored backend state that doesn't persist the scan phase
    // status — a detected stack definitionally means Phase 0 (scan) is complete.
    const rawPhases = (state.phases && state.phases.length > 0 ? state.phases : MIGRATION_PHASES) as MigrationPhase[];
    const validatedPhases = rawPhases.map(p =>
      VALID_PHASE_STATUSES.has(p.status) ? p : { ...p, status: 'pending' as const }
    );
    const scanFixedPhases = state.detectedStack
      ? validatedPhases.map(p => p.id === 'scan' && p.status === 'pending' ? { ...p, status: 'done' as const } : p)
      : validatedPhases;
    const reconciled = reconcilePhases(scanFixedPhases, nextStatus);

    // Per-stage timing — best-effort, derived from phase status edges since no
    // per-phase timestamps are persisted server-side.
    if (!opts.isInitialRestore) {
      reconciled.forEach(p => {
        const prevPhase = phasesRef.current.find(pp => pp.id === p.id);
        if (!prevPhase || prevPhase.status === p.status) return;
        if (p.status === 'active') {
          phaseStartedAtRef.current[p.id] = Date.now();
        } else if (p.status === 'done' || p.status === 'error') {
          const startedAt = phaseStartedAtRef.current[p.id];
          if (startedAt) {
            setPhaseDurations(prev => ({ ...prev, [p.id]: Date.now() - startedAt }));
            delete phaseStartedAtRef.current[p.id];
          }
        }
      });
    }
    phasesRef.current = reconciled;

    setStatus(nextStatus);
    setPhases(reconciled);
    // The backend only ever persists whatever the last real progress value was
    // (e.g. 98%, the last value before completion) — force 100 in-memory once
    // the run is genuinely complete instead of showing a stuck 98%.
    setProgress(nextStatus === 'complete' ? 100 : state.progress);
    setCurrentFile(state.currentFile);
    setFileTree(state.fileTree || []);
    setDetectedStack(state.detectedStack ?? null);
    codeMigrationRef.current?.setMigrationTaskList(state.migrationTaskList ?? null);
    codeMigrationRef.current?.setRuleCoverageReport(state.ruleCoverageReport ?? null);
    setGraphResolutionSummary(state.graphResolutionSummary ?? null);
    setAnalysisReport(state.analysisReport ?? null);
    setKnowledgeGraph(state.knowledgeGraph ?? null);
    // Gated on analysisReport, not just presence in the response — the backend
    // always returns validFileCount/emptyFileCount (default 0) even before
    // Stage-1 analysis has run, and showing "0 valid files" during the
    // scan-only stage would misrepresent files that simply haven't been
    // validated yet as files that failed validation.
    if (state.analysisReport) {
      setValidFileCount(state.validFileCount);
      setEmptyFileCount(state.emptyFileCount);
      setEmptyFiles(state.emptyFiles ?? []);
    } else {
      setValidFileCount(undefined);
      setEmptyFileCount(undefined);
      setEmptyFiles([]);
    }

    mergeBackendLogs(state.logs);
    // Only overwrite if the backend actually reports these — an omitted field
    // means "this backend hasn't implemented live tool activity yet", not
    // "there is none right now".
    if (state.activeTool !== undefined) setActiveTool(state.activeTool);
    if (state.toolCallHistory !== undefined) setToolCallHistory(state.toolCallHistory);

    // Content-keyed, not transition-keyed — runs every tick (and on restore)
    // so a report that lands in MongoDB after status already reached
    // 'complete' once before still gets pointed at. The full text lives in
    // Stage1_Analysis.md (see STAGE1_ANALYSIS_VIRTUAL_PATH) — just a pointer here.
    if (state.analysisReport && state.analysisReport !== lastLoggedAnalysisReportRef.current) {
      lastLoggedAnalysisReportRef.current = state.analysisReport;
      addLog(`Analysis report ready — open ${STAGE1_ANALYSIS_VIRTUAL_PATH} in the Explorer to read it.`, 'success');

      // Also write it to disk if the user configured a Local Output Workspace
      // Path — this backend runs locally, so it's the one piece that actually
      // can reach the filesystem (AgentBuilder's workflows can't).
      const localOutputPath = readSettings().localOutputPath.trim();
      if (localOutputPath) {
        writeLocalOutput(backendUrl, localOutputPath, STAGE1_ANALYSIS_VIRTUAL_PATH, state.analysisReport)
          .then(result => addLog(`Analysis report also saved to ${result.path}`, 'success'))
          .catch(err => addLog(`Could not save report locally: ${err instanceof Error ? err.message : 'Unknown error'}`, 'warning'));
      }
    }

    // Same content-keyed pattern for the knowledge graph — fanned out into
    // one file per category (entity/db/callFlow/imports/rule/integration/
    // architecture/api/middleware/security/symbol/config) instead of one
    // combined blob, mirroring the multi-graph analysis output this reflects.
    if (state.knowledgeGraph && typeof state.knowledgeGraph === 'object') {
      const graphJson = JSON.stringify(state.knowledgeGraph, null, 2);
      if (graphJson !== lastWrittenKnowledgeGraphRef.current) {
        lastWrittenKnowledgeGraphRef.current = graphJson;
        const kg = state.knowledgeGraph as Record<string, unknown>;
        const presentCategories = KNOWLEDGE_GRAPH_CATEGORIES.filter(({ key }) => kg[key] !== undefined);
        addLog(`Knowledge graph ready — ${presentCategories.length} graph files under ${KNOWLEDGE_GRAPH_FOLDER}/ in the Explorer.`, 'success');

        const localOutputPath = readSettings().localOutputPath.trim();
        if (localOutputPath) {
          for (const { key, fileName } of presentCategories) {
            writeLocalOutput(backendUrl, localOutputPath, fileName, JSON.stringify(kg[key], null, 2), KNOWLEDGE_GRAPH_FOLDER)
              .then(result => addLog(`${fileName} saved to ${result.path}`, 'success'))
              .catch(err => addLog(`Could not save ${fileName} locally: ${err instanceof Error ? err.message : 'Unknown error'}`, 'warning'));
          }
        }
      }
    }

    if (!opts.isInitialRestore && transitioned) {
      if (prevStatus === 'scanning' && nextStatus === 'idle' && state.detectedStack) {
        // The initial fast "just scan the files" step finished — ready for the
        // user to click Start Stage-1 Analysis. Not the same as a full run
        // completing (that lands on 'complete', not 'idle').
        addLog(`Scanned ${state.detectedStack.fileCount} files`, 'success');
        addLog(`Detected: ${state.detectedStack.language} / ${state.detectedStack.framework} / ${state.detectedStack.database}`, 'info');
        onNotify?.({
          type: 'info',
          message: `Project loaded: ${state.detectedStack.fileCount} files · ${state.detectedStack.language} / ${state.detectedStack.framework}`,
        });
      } else if (nextStatus === 'complete') {
        addLog('Stage-1 Analysis complete.', 'success');
      } else if (nextStatus === 'error') {
        setActiveTool(null);
        const msg = state.errorMessage || 'Pipeline error — see backend logs for details.';
        addLog(msg, 'error');
        onNotify?.({ type: 'error', message: `Pipeline error: ${msg}`, persistent: true });
      }

      // These sub-stages have no dedicated "done" signal beyond the phase
      // status itself — pull results from session state on the same edge.
      const donePhaseIds = reconciled
        .filter(p => p.status === 'done')
        .map(p => p.id);
      if (
        donePhaseIds.includes('migration-planning') || donePhaseIds.includes('code-generation') || donePhaseIds.includes('verification')
      ) {
        codeMigrationRef.current?.refreshFromSession(state.sessionId);
      }
    }

    if (!opts.isInitialRestore && nextStatus === 'awaiting-graph-review' && transitioned) {
      fetchGraphSummary(backendUrl, state.sessionId)
        .then(setGraphResolutionSummary)
        .catch(() => { /* non-critical — the checkpoint UI will show empty */ });
    }

    // 'idle' alone isn't enough to stop polling anymore — a freshly-scanned
    // project also sits at 'idle' while the Scanner Agent's external webhook
    // is still working in the background (it updates detectedStack + the
    // 'scan' phase directly in MongoDB, with no status change to signal it).
    // Stopping polling the instant status is 'idle' meant nothing was left
    // watching for that update, so it only ever appeared after a manual
    // page refresh. Keep polling through 'idle' until stack detection is
    // actually done.
    const scanPhase = reconciled.find(p => p.id === 'scan');
    const stillAwaitingScannerAgent = nextStatus === 'idle' && scanPhase?.status !== 'done';
    if (!opts.isInitialRestore && TERMINAL_STATUSES.has(nextStatus) && !stillAwaitingScannerAgent) {
      stopPolling();
    }

    prevStatusRef.current = nextStatus;
    // `state.sessionId` (from the fetch response) is used instead of the outer
    // `sessionId` state on purpose — see the phasesRef comment above, same
    // stale-closure hazard. backendUrl/addLog/mergeBackendLogs/onNotify are
    // all effectively stable, so this callback rarely needs to be recreated.
  }, [addLog, mergeBackendLogs, onNotify, backendUrl]);

  // ── Poll tick ────────────────────────────────────────────────────────────────
  const pollTick = useCallback(async (sid: string) => {
    const state = await fetchSessionState(backendUrl, sid);
    applyPollResult(state, { isInitialRestore: false });
    setLastEventAt(Date.now());
    refreshModernTree(sid);
    fetchSessionTokens(backendUrl, sid)
      .then(data => {
        if (data.tokenUsage && data.tokenUsage.totalTokens > 0) setTokenUsage(data.tokenUsage);
      })
      .catch(() => { /* non-critical — next tick will retry */ });
  }, [backendUrl, applyPollResult, refreshModernTree]);

  const handlePollError = useCallback((msg: string) => {
    addLog(msg, 'warning');
  }, [addLog]);

  const { startPolling, stopPolling } = usePolling({ onTick: pollTick, onError: handlePollError });

  // Browser tabs get their JS timers heavily throttled while backgrounded —
  // Chrome's Intensive Throttling can drop our 3s poll interval to as
  // infrequently as once/minute after a few minutes unfocused. That's exactly
  // what happens while switching over to check AgentBuilder/MongoDB in another
  // window: the poll doesn't stop, it just silently slows way down, so
  // switching back looks "stuck" even though the workflow genuinely finished.
  // Force one immediate, un-throttled re-check the instant the tab regains
  // focus instead of waiting for the throttled timer to eventually catch up.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && sessionId) {
        pollTick(sessionId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [sessionId, pollTick]);

  // Needs startPolling to resume polling after each sub-stage starts.
  const codeMigration = useCodeMigration(backendUrl, sessionId, addLog, startPolling, setStatus);
  codeMigrationRef.current = codeMigration;

  // Manual reconnect — for when the Live panel's stale-connection detector fires
  // and the user clicks "Reconnect" rather than reloading the whole page.
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    setLastEventAt(Date.now()); // don't immediately re-flag as stale before the next tick lands
    addLog('Reconnecting…', 'info');
    startPolling(sessionId);
  }, [sessionId, startPolling, addLog]);

  // Full session restore on mount — resumes polling if a migration is still running server-side.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('last_session_id');
    if (!saved) return;

    fetchSessionState(backendUrl, saved)
      .then(state => {
        setSessionId(state.sessionId);
        applyPollResult(state, { isInitialRestore: true });
        prevStatusRef.current = VALID_MIGRATION_STATUSES.has(state.status as MigrationStatus)
          ? (state.status as MigrationStatus)
          : 'idle';
        // runStartedAt/phaseDurations deliberately NOT restored here — the backend
        // doesn't persist a run-start timestamp or per-phase timing, and faking one
        // (e.g. "started now") would misrepresent how long the run has actually
        // been going. The elapsed timer simply doesn't show until the next real
        // handleStart/handleUpload call sets it for real.

        // Also resume polling for a fresh 'idle' scan still awaiting the
        // Scanner Agent's async update — same reasoning as the stop-condition
        // in applyPollResult above. Without this, refreshing mid-wait would
        // leave nothing watching for MongoDB to change, same bug as before.
        const scanPhase = (state.phases || []).find(p => p.id === 'scan');
        const stillAwaitingScannerAgent = state.status === 'idle' && scanPhase?.status !== 'done';
        if (RESUMABLE_STATUSES.includes(state.status as MigrationStatus) || stillAwaitingScannerAgent) {
          addLog('Reconnected — watching for updates.', 'info');
          startPolling(state.sessionId);
        }
      })
      .catch(() => {
        // Session expired/deleted on the backend — drop the stale reference.
        localStorage.removeItem('last_session_id');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  // ── File Upload → Scan ──────────────────────────────────────────────────────
  const handleUpload = useCallback(async (files: FileList | File[], explicitPaths?: string[]) => {
    addLog('Reading project files...', 'info');
    setStatus('scanning');
    prevStatusRef.current = 'scanning';
    // Reset optimistically — otherwise a stale lastEventAt from a PREVIOUS run
    // could make the connection-lost detector false-trigger the instant this new
    // run's status flips to "running", before its own first poll tick lands.
    setLastEventAt(Date.now());

    const settings = readSettings();
    const formData = new FormData();
    const pathsArray: string[] = [];

    // Never upload build artifacts, dependency folders, or VCS internals —
    // they're never legacy source we'd want to migrate anyway, and nobody
    // wants to see them in Explorer either. Everything else uploads as-is —
    // full fidelity with what the project folder actually looks like
    // (matching what an editor like VS Code would show). Binary/media files
    // (images, PDFs, etc.) are NOT filtered here on purpose: they still get
    // uploaded and appear in the file tree — the backend's content sniffing
    // in scan.js handles them safely at scan time (skips storing binary
    // content, keeps the tree entry) instead of hiding them at upload time.
    const EXCLUDE_PATH_PARTS = ['node_modules/', 'dist/', 'build/', '.git/', 'vendor/',
      'target/', 'bin/', 'obj/', '__pycache__/', '.next/', 'coverage/', 'out/', 'venv/',
      '.venv/', '.idea/', '.vscode/'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath =
        explicitPaths && explicitPaths[i]
          ? explicitPaths[i]
          : ((file as File & { webkitRelativePath: string }).webkitRelativePath || file.name);

      const lowerPath = relativePath.toLowerCase();
      if (EXCLUDE_PATH_PARTS.some(p => lowerPath.includes(p))) continue;

      formData.append('files', file);
      pathsArray.push(relativePath);
    }

    formData.append('paths',    JSON.stringify(pathsArray));
    formData.append('provider', settings.provider);
    formData.append('model',    settings.model);
    formData.append('apiKey',   settings.apiKey);
    formData.append('maxRetries',          settings.googleMaxRetries.toString());
    formData.append('retryDelayRateLimit', settings.googleRetryDelayRateLimit.toString());
    formData.append('retryDelayOther',     settings.googleRetryDelayOther.toString());
    formData.append('timeoutMs',           settings.googleTimeoutMs.toString());
    // Needed so the Scanner (which now resolves its model the same way every
    // other agent does) can find a per-agent override or a different provider's
    // key at scan time — not just the single active provider's key.
    formData.append('apiKeys', JSON.stringify(settings.allApiKeys));
    formData.append('aliasesConfig', JSON.stringify(settings.aliasesConfig));
    formData.append('agentsConfig', localStorage.getItem('ai_config_agents') || 'null');

    try {
      const data = await scanProject(backendUrl, formData);
      beginScanSession(data.sessionId, 'Unpacked folder.');
    } catch (err: unknown) {
      addLog(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setStatus('error');
    }
  }, [addLog, backendUrl]);

  // ── Clone from GitHub → Scan ─────────────────────────────────────────────────
  // Same "new project" entry point as handleUpload, sourced from a GitHub repo
  // instead of local files — the backend clone+scan is fire-and-forget in the
  // same shape, so everything past sessionId is identical.
  const handleCloneFromGithub = useCallback(async (repoUrl: string, branch?: string) => {
    addLog(`Cloning ${repoUrl}${branch ? ` (${branch})` : ''}...`, 'info');
    setStatus('scanning');
    prevStatusRef.current = 'scanning';
    setLastEventAt(Date.now());

    const settings = readSettings();
    const accessToken = localStorage.getItem('github_access_token') || undefined;

    try {
      const data = await cloneFromGithub(backendUrl, {
        repoUrl, branch, accessToken,
        provider: settings.provider,
        model:    settings.model,
        apiKey:   settings.apiKey,
        apiKeys:  settings.allApiKeys,
        agentsConfig: (() => {
          try { return JSON.parse(localStorage.getItem('ai_config_agents') || 'null'); } catch { return null; }
        })(),
        aliasesConfig: settings.aliasesConfig,
        maxRetries:          settings.googleMaxRetries,
        retryDelayRateLimit: settings.googleRetryDelayRateLimit,
        retryDelayOther:     settings.googleRetryDelayOther,
      });
      beginScanSession(data.sessionId, `Cloned ${repoUrl}.`);
    } catch (err: unknown) {
      addLog(`Clone failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setStatus('error');
    }
  }, [addLog, backendUrl]);

  // Shared tail for both entry points above: reset session-scoped display
  // state and start polling for the newly created session.
  function beginScanSession(sid: string, sourceLabel: string) {
    setSessionId(sid);
    setLogs([]);
    seenLogIdsRef.current = new Set();
    setProgress(0);
    setFileTree([]);
    setDetectedStack(null);
    addLog(`${sourceLabel} Watching session ${sid}...`, 'info');
    startPolling(sid);
  }

  // ── Scanner Agent — separate external webhook, fired AFTER the project is
  // already uploaded/saved (handleUpload above). Only tells the AgentBuilder
  // workflow which session to work on — it reads the files back out of
  // MongoDB itself instead of receiving them again over this call. ─────────
  const [isTriggeringScannerAgent, setIsTriggeringScannerAgent] = useState(false);
  const handleTriggerScannerAgent = useCallback(async () => {
    if (!sessionId) return;
    const settings = readSettings();
    if (!settings.agentBuilderWebhookUrl.trim()) {
      addLog('AgentBuilder Webhook Base URL is not configured — set it in Settings first.', 'error');
      return;
    }

    setIsTriggeringScannerAgent(true);
    addLog('Triggering Scanner Agent...', 'command');
    try {
      await triggerScannerAgent(settings.agentBuilderWebhookUrl, sessionId);
      addLog('Scanner Agent triggered.', 'success');
      // Safety net — make sure polling is actually running to catch the
      // MongoDB update this triggers asynchronously in the background.
      startPolling(sessionId);
    } catch (err: unknown) {
      addLog(`Scanner Agent failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsTriggeringScannerAgent(false);
    }
  }, [sessionId, addLog, startPolling]);

  // ── Start Stage-1 Analysis ──────────────────────────────────────────────────
  // Single-pass: fires the Stage-1 Analysis Agent webhook (same pattern as
  // Scanner Agent — it reads files back out of MongoDB itself), which analyzes
  // the whole project in one AI call and writes back status/phases/analysisReport.
  // Optimistically set to 'discovery' (a real, non-terminal MigrationStatus) so
  // polling has an honest reason to keep running until the agent's MongoDB
  // write actually lands — same fix as the Scanner Agent polling bug, just
  // using a real status this time instead of a special-cased condition.
  const handleStart = useCallback(async (target: TargetStack) => {
    if (!sessionId) return;

    const settings = readSettings();
    if (!settings.agentBuilderWebhookUrl.trim()) {
      addLog('AgentBuilder Webhook Base URL is not configured — set it in Settings first.', 'error');
      return;
    }

    setStatus('discovery');
    prevStatusRef.current = 'discovery';
    setProgress(0);
    setPhases(prev => prev.map(p => {
      if (p.id === 'scan') return { ...p, status: 'done' };
      if (['discovery', 'file-analysis', 'graph-resolution', 'section-writing', 'assembly'].includes(p.id)) {
        return { ...p, status: 'active' };
      }
      return { ...p, status: 'pending' };
    }));
    setRunStartedAt(Date.now());
    setPhaseDurations({});
    phaseStartedAtRef.current = {};
    setLastEventAt(Date.now());
    addLog('Starting Stage-1 Analysis...', 'command');

    try {
      await triggerStage1Analysis(settings.agentBuilderWebhookUrl, sessionId, target);
      addLog('Stage-1 Analysis Agent triggered.', 'success');
      startPolling(sessionId);
    } catch (err: unknown) {
      addLog(`Stage-1 Analysis failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setStatus('error');
    }
  }, [sessionId, addLog, startPolling]);

  // ── HITL — Continue to Analysis Report ─────────────────────────────────────
  const handleContinueAnalysis = useCallback(async () => {
    if (!sessionId) return;
    setIsCheckpointBusy(true);
    addLog('Continuing to analysis report...', 'command');

    const settings = readSettings();
    const combinedApiKey =
      settings.allApiKeys.anthropic || settings.allApiKeys.openai || settings.allApiKeys.google ||
      settings.allApiKeys.grok || settings.allApiKeys.groq || settings.allApiKeys.openrouter ||
      settings.allApiKeys.mistral || settings.allApiKeys.huggingface || '';

    try {
      await continueAnalysis(backendUrl, sessionId, combinedApiKey, settings.allApiKeys);
      setGraphResolutionSummary(null);   // leaving the checkpoint
      startPolling(sessionId);
    } catch (err: unknown) {
      addLog(`Continue failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsCheckpointBusy(false);
    }
  }, [sessionId, addLog, backendUrl, startPolling]);

  // ── HITL — Skip to Code Migration ──────────────────────────────────────────
  const handleSkipToStage2 = useCallback(async () => {
    if (!sessionId) return;
    setIsCheckpointBusy(true);
    addLog('Skipping analysis report — proceeding to code migration...', 'command');

    try {
      await skipToStage2(backendUrl, sessionId);
      setGraphResolutionSummary(null);   // leaving the checkpoint
      startPolling(sessionId);
    } catch (err: unknown) {
      addLog(`Skip failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsCheckpointBusy(false);
    }
  }, [sessionId, addLog, backendUrl, startPolling]);

  // ── Stop ─────────────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    stopPolling();
    setActiveTool(null);
    try {
      if (sessionId) await stopMigration(backendUrl, sessionId);
      setStatus('idle');
      prevStatusRef.current = 'idle';
      // Without this, status='idle' would coexist with the last non-zero progress
      // value — exactly the stale state the Live panel's idle+realPct check treats
      // as "still running", so it would flash "Running X%" again right after Stop.
      setProgress(0);
      addLog('Migration stopped by user.', 'warning');
    } catch (err: unknown) {
      // The backend call failed — the pipeline may still be running server-side.
      // Surface this instead of silently pretending Stop succeeded.
      const msg = `Stop request failed: ${err instanceof Error ? err.message : 'Unknown error'}. The migration may still be running on the server.`;
      addLog(msg, 'error');
      onNotify?.({ type: 'error', message: msg, persistent: true });
    }
  }, [sessionId, addLog, backendUrl, stopPolling, onNotify]);

  // ── Pause ────────────────────────────────────────────────────────────────────
  const handlePause = useCallback(async () => {
    stopPolling();
    setActiveTool(null);
    try {
      if (sessionId) await pauseMigration(backendUrl, sessionId);
      setStatus('paused');
      prevStatusRef.current = 'paused';
      addLog('Migration paused.', 'warning');
    } catch (err: unknown) {
      const msg = `Pause request failed: ${err instanceof Error ? err.message : 'Unknown error'}. The migration may still be running on the server.`;
      addLog(msg, 'error');
      onNotify?.({ type: 'error', message: msg, persistent: true });
    }
  }, [sessionId, addLog, backendUrl, stopPolling, onNotify]);

  // ── Select File ──────────────────────────────────────────────────────────────
  const handleSelectFile = useCallback(async (
    path: string,
    setActiveEditorTab: (t: 'code') => void
  ) => {
    setSelectedFile(path);
    setActiveEditorTab('code');

    // Virtual files, synthesized on the frontend — content already lives in
    // state, no backend round-trip (they aren't real stored files, so
    // /api/file would 404 on them).
    if (path === STAGE1_ANALYSIS_VIRTUAL_PATH) {
      setLegacyCode(analysisReport);
      setModernCode(null);
      return;
    }
    const kgMatch = KNOWLEDGE_GRAPH_CATEGORIES.find(({ fileName }) => path === knowledgeGraphVirtualPath(fileName));
    if (kgMatch) {
      const categoryData = knowledgeGraph && typeof knowledgeGraph === 'object'
        ? (knowledgeGraph as Record<string, unknown>)[kgMatch.key]
        : undefined;
      setLegacyCode(categoryData !== undefined ? JSON.stringify(categoryData, null, 2) : null);
      setModernCode(null);
      return;
    }

    if (!sessionId) return;
    try {
      const data = await fetchFileContent(backendUrl, sessionId, path);
      setLegacyCode(data.content ?? null);
      setModernCode(data.modernContent ?? null);
    } catch {
      setLegacyCode('// Could not load file content');
      setModernCode(null);
    }
  }, [sessionId, backendUrl, analysisReport, knowledgeGraph]);

  // ── Clear selected file (close editor) ─────────────────────────────────────
  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setLegacyCode(null);
    setModernCode(null);
  }, []);

  // ── Download helper ─────────────────────────────────────────────────────────
  const handleDownload = useCallback((fileName: string) => {
    if (!sessionId) return;
    downloadFile(backendUrl, sessionId, fileName);
  }, [sessionId, backendUrl]);

  // ── New Project ──────────────────────────────────────────────────────────────
  // Wipes every piece of client-side session state so the Explorer's upload UI
  // reappears (it's gated on fileTree.length === 0). Nothing is deleted on the
  // backend — the old session's files stay on disk under its own session id,
  // this just stops the tab from displaying it. Callers are responsible for
  // guarding against calling this mid-run (Stage-2 sub-stages etc).
  const handleNewProject = useCallback(() => {
    stopPolling();
    setActiveTool(null);

    setStatus('idle');
    prevStatusRef.current = 'idle';
    setSessionId(null);
    setFileTree([]);
    setDetectedStack(null);
    setSelectedFile(null);
    setLegacyCode(null);
    setModernCode(null);
    setLogs([]);
    seenLogIdsRef.current = new Set();
    setProgress(0);
    setCurrentFile('');
    setPhases(MIGRATION_PHASES);
    setModernFileTree([]);
    setModernFolderBasename('');
    setTokenUsage(null);
    setAnalysisReport(null);
    setKnowledgeGraph(null);
    setValidFileCount(undefined);
    setEmptyFileCount(undefined);
    setEmptyFiles([]);
    setGraphResolutionSummary(null);
    setIsCheckpointBusy(false);
    setToolCallHistory([]);
    setLastEventAt(null);
    setRunStartedAt(null);
    setPhaseDurations({});
    phaseStartedAtRef.current = {};
    lastLoggedAnalysisReportRef.current = null;
    lastWrittenKnowledgeGraphRef.current = null;

    codeMigrationRef.current?.setMigrationTaskList(null);
    codeMigrationRef.current?.setRuleCoverageReport(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('last_session_id');
      localStorage.removeItem('live_token_usage');
    }
  }, [stopPolling]);

  return {
    status, sessionId, fileTree, detectedStack, selectedFile,
    legacyCode, modernCode, logs, progress, currentFile, phases,
    modernFileTree, modernFolderBasename, tokenUsage, analysisReport, knowledgeGraph,
    validFileCount, emptyFileCount, emptyFiles,
    isRunning, hasProject,
    activeTool,
    toolCallHistory,
    migrationTaskList: codeMigration.migrationTaskList,
    ruleCoverageReport: codeMigration.ruleCoverageReport,
    planSanityWarning: codeMigration.planSanityWarning,
    reportedIssues: codeMigration.reportedIssues,
    handleReportIssue: codeMigration.handleReportIssue,
    isPlanning, isGenerating, isVerifying,
    graphResolutionSummary, isCheckpointBusy,
    lastEventAt, runStartedAt, phaseDurations, reconnect,
    handleUpload,
    isTriggeringScannerAgent, handleTriggerScannerAgent,
    handleCloneFromGithub, handleStart,
    handleContinueAnalysis, handleSkipToStage2,
    handleStartMigrationPlanning: codeMigration.handleStartMigrationPlanning,
    handleStartCodeGeneration: codeMigration.handleStartCodeGeneration,
    handleStartVerification: codeMigration.handleStartVerification,
    handleStop, handlePause, handleSelectFile, clearSelectedFile,
    handleDownload, handleNewProject,
  };
}
