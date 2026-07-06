// =============================================================================
//  hooks/useMigration.ts
//  All migration state and event handlers.
//
//  Extracted from app/page.tsx (was 670 lines — now page.tsx is ~120 lines).
//
//  Provides:
//   - All state: status, sessionId, fileTree, detectedStack, logs, progress, phases
//   - All handlers: handleUpload, handleStart, handleStop, handlePause, handleSelectFile
//   - SSE event dispatch
//   - Modern file tree refresh
// =============================================================================

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  DetectedStack,
  FileNode,
  LogEntry,
  MigrationPhase,
  MigrationStatus,
  TargetStack,
  MIGRATION_PHASES,
} from '@/types';
import type { ToolCallHistoryItem } from '@/components/live-status/types';
import {
  scanProject,
  startMigration,
  stopMigration,
  pauseMigration,
  fetchFileContent,
  fetchModernTree,
  fetchSessionTokens,
  fetchSessionState,
  downloadFile,
} from '@/services/api';

import { readSettings } from '@/hooks/useSettings';
import { useSSE, SSEEventPayload } from '@/hooks/useSSE';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// Runtime guards for SSE payload fields — the backend is a separate process and
// its event shape can drift (new/renamed status, a typo'd level). Without this,
// an unexpected value gets blindly cast with `as X` and can silently corrupt
// UI state (e.g. an unrecognized status making STATUS_LABEL[status] render
// undefined). Fail safe: fall back to a known-good value and log a warning
// instead of trusting the cast.
const VALID_LOG_LEVELS = new Set<LogEntry['level']>(['info', 'success', 'error', 'warning', 'command', 'stream']);
const VALID_MIGRATION_STATUSES = new Set<MigrationStatus>([
  'idle', 'scanning', 'planning', 'discovery', 'file-analysis',
  'graph-resolution', 'section-writing', 'assembly', 'complete', 'error', 'paused',
]);
const VALID_PHASE_STATUSES = new Set<MigrationPhase['status']>(['pending', 'active', 'done', 'error']);

function safeLogLevel(value: unknown): LogEntry['level'] {
  return VALID_LOG_LEVELS.has(value as LogEntry['level']) ? (value as LogEntry['level']) : 'info';
}

function markMigrated(tree: FileNode[], path: string): FileNode[] {
  return tree.map(node => {
    if (node.path === path) return { ...node, migrated: true };
    if (node.children) return { ...node, children: markMigrated(node.children, path) };
    return node;
  });
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

// ── Active Tool condensation helper ─────────────────────────────────────────
function condenseSseArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return '';
  return entries
    .map(([k, v]) => {
      const vs = typeof v === 'string' ? v : JSON.stringify(v);
      return `${k}: ${vs.length > 36 ? vs.slice(0, 36) + '\u2026' : vs}`;
    })
    .join('  \u00b7  ')
    .slice(0, 90);
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
  isRunning: boolean;
  hasProject: boolean;
  activeTool: { name: string; args: string } | null;  // ← SSE-driven, no log parsing
  /** SSE-driven completed tool call history — newest first, max 20 entries */
  toolCallHistory: ToolCallHistoryItem[];
  // Handlers
  handleUpload: (files: FileList | File[], explicitPaths?: string[]) => Promise<void>;
  handleStart: (target: TargetStack) => Promise<void>;
  handleStop: () => Promise<void>;
  handlePause: () => Promise<void>;
  handleSelectFile: (path: string, setActiveEditorTab: (t: 'code' | 'settings' | 'aiconfig') => void) => Promise<void>;
  clearSelectedFile: () => void;
  handleDownload: (fileName: string) => void;
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
  const [activeTool, setActiveTool]       = useState<{ name: string; args: string } | null>(null);
  // Tool call history — SSE-driven, newest first, capped at 20
  const [toolCallHistory, setToolCallHistory] = useState<ToolCallHistoryItem[]>([]);
  // Pending tool call staging — stores name+args until tool_response arrives.
  // Keyed by the backend's tool-call id (a Map, not a single slot) so two
  // overlapping tool calls never silently overwrite each other in history.
  const pendingToolsRef = React.useRef<Map<string, { name: string; args: string }>>(new Map());

  const isRunning     = ['scanning', 'planning', 'discovery', 'file-analysis', 'graph-resolution', 'section-writing', 'assembly'].includes(status);
  const hasProject    = fileTree.length > 0;

  // ── Log helper ──────────────────────────────────────────────────────────────
  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info', phase?: string) => {
    setLogs(prev => [...prev, { id: generateId(), timestamp: timestamp(), level, message, phase }]);
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

  // ── Load persisted token usage when session changes ─────────────────────────
  // This ensures Token Usage tab shows real data even after page refresh or
  // when the tab was closed during migration.
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
      .catch(() => { /* non-critical — live SSE will populate */ });
  }, [sessionId, backendUrl]);

  // ── SSE event handler ───────────────────────────────────────────────────────
  const handleSSEEvent = useCallback((event: SSEEventPayload) => {
    switch (event.type) {
      case 'tool_call': {
        // Direct SSE event from AgentExecutor — no log parsing needed
        const id   = event.data.id as string ?? '';
        const name = event.data.name as string ?? '';
        const args = event.data.args as Record<string, unknown> ?? {};
        const condensed = condenseSseArgs(args);
        setActiveTool({ name, args: condensed });
        // Stage for history — finalized when tool_response arrives. Keyed by
        // call id (a Map, not a single slot) so two overlapping tool calls
        // never silently overwrite each other before their responses land.
        if (id) pendingToolsRef.current.set(id, { name, args: condensed });
        break;
      }

      case 'tool_response': {
        // Tool finished — record in history, clear active tool
        const id      = event.data.id as string ?? '';
        const success = event.data.success !== false;  // defaults true if absent
        const pending = id ? pendingToolsRef.current.get(id) : undefined;
        if (pending) {
          const entry: ToolCallHistoryItem = {
            id:        `tc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name:      pending.name,
            args:      pending.args,
            success,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          };
          setToolCallHistory(prev => [entry, ...prev].slice(0, 20)); // newest first, max 20
          pendingToolsRef.current.delete(id);
        }
        // Only clear the "currently active" indicator if nothing else is
        // still pending — otherwise a still-running overlapping call would
        // have its activeTool indicator wiped by this unrelated response.
        if (pendingToolsRef.current.size === 0) setActiveTool(null);
        break;
      }

      case 'file_tree_changed':
        // @parcel/watcher (BE) detected file CREATED/UPDATED/DELETED in modernPath.
        // SNS IDE equivalent: onDidFilesChanged → Navigator tree re-reads directory.
        // Refresh immediately — no debounce needed here (BE already debounces 300ms).
        if (sessionId) refreshModernTree(sessionId);
        break;

      case 'log':
        addLog(
          event.data.message as string,
          safeLogLevel(event.data.level),
          event.data.phase as string
        );
        if (
          sessionId &&
          event.data.message &&
          (
            (event.data.message as string).includes('successfully written to') ||
            (event.data.message as string).includes('Fallback content') ||
            (event.data.message as string).includes('custom local folder')
          )
        ) {
          refreshModernTree(sessionId);
        }
        break;

      case 'progress':
        setProgress((event.data.percent as number) ?? 0);
        setCurrentFile((event.data.currentFile as string) ?? '');
        break;

      case 'phase_change': {
        const nextStatus = event.data.phase;
        if (VALID_MIGRATION_STATUSES.has(nextStatus as MigrationStatus)) {
          setStatus(nextStatus as MigrationStatus);
        } else {
          addLog(`Received unrecognized migration status "${String(nextStatus)}" — ignored.`, 'warning');
        }
        const nextPhaseStatus = event.data.status;
        const safePhaseStatus = VALID_PHASE_STATUSES.has(nextPhaseStatus as MigrationPhase['status'])
          ? (nextPhaseStatus as MigrationPhase['status'])
          : undefined;
        if (safePhaseStatus) {
          setPhases(prev => prev.map(p =>
            p.id === event.data.phaseId ? { ...p, status: safePhaseStatus } : p
          ));
        }
        if (sessionId) refreshModernTree(sessionId);
        break;
      }

      case 'file_migrated':
        setFileTree(prev => markMigrated(prev, event.data.path as string));
        if (sessionId) refreshModernTree(sessionId);
        break;

      case 'complete': {
        const payload = event.data as any;
        setActiveTool(null);       // clear any stuck tool on completion
        pendingToolsRef.current.clear();
        if (payload && payload.isScan) {
          setFileTree(payload.fileTree || []);
          setDetectedStack(payload.detectedStack || null);
          setStatus('idle');
          closeSSE();
          if (payload.detectedStack) {
            addLog(`Scanned ${payload.detectedStack.fileCount} files`, 'success');
            addLog(`Detected: ${payload.detectedStack.language} / ${payload.detectedStack.framework} / ${payload.detectedStack.database}`, 'info');
            // → Notify upload success (SNS IDE MessageService.info pattern)
            onNotify?.({
              type: 'info',
              message: `Project loaded: ${payload.detectedStack.fileCount} files · ${payload.detectedStack.language} / ${payload.detectedStack.framework}`,
            });
          }
        } else {
          setStatus('complete');
          setProgress(100);
          closeSSE();
          addLog('Migration complete.', 'success');
        }
        if (sessionId) refreshModernTree(sessionId);
        break;
      }

      case 'error':
        setActiveTool(null);
        pendingToolsRef.current.clear();
        setStatus('error');
        addLog(event.data.message as string, 'error');
        // → Notify error (SNS IDE MessageService.error pattern)
        onNotify?.({
          type: 'error',
          message: `Pipeline error: ${event.data.message as string}`,
          persistent: true,
        });
        closeSSE();
        break;

      case 'token_usage': {
        const tu: TokenUsage = {
          inputTokens:   (event.data.inputTokens   as number) ?? 0,
          outputTokens:  (event.data.outputTokens  as number) ?? 0,
          cachedInputTokens: (event.data.cachedInputTokens as number) ?? undefined,
          readCachedInputTokens: (event.data.readCachedInputTokens as number) ?? undefined,
          totalTokens:   (event.data.totalTokens   as number) ?? 0,
          // null = genuinely no pricing rate configured — do NOT default to 0,
          // that would render as "$0.0000" and imply the run was free.
          estimatedCost: (event.data.estimatedCost as number | null) ?? null,
          costIncomplete: (event.data.costIncomplete as boolean) ?? undefined,
          model:         (event.data.model         as string) ?? undefined,
        };
        setTokenUsage(tu);
        // Write to localStorage so the TokensTab can read it without the SSE stream
        // Also maintain a history of per-agent usage for breakdown display
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('live_token_usage', JSON.stringify({ ...tu, updatedAt: Date.now() }));
          } catch { /* storage full */ }
        }
        break;
      }

      case 'heartbeat':
        break;
    }
  }, [addLog, sessionId, refreshModernTree]); // closeSSE added below

  const handleSSEError = useCallback((msg: string) => {
    addLog(msg, 'warning');
  }, [addLog]);

  const { openSSE, closeSSE } = useSSE({ onEvent: handleSSEEvent, onError: handleSSEError });

  // ── Full session restore on mount ───────────────────────────────────────────
  // Previously this only restored `sessionId` itself — fileTree, detectedStack,
  // phases, and the SSE connection were all lost on refresh, so a page reload
  // during an active migration reverted the UI to the "no project" welcome
  // screen while the backend kept running headless with no way to reconnect.
  // Now it fetches the real backend session state and, if a migration is still
  // actively running server-side, reopens the SSE stream to resume live updates.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('last_session_id');
    if (!saved) return;

    fetchSessionState(backendUrl, saved)
      .then(state => {
        setSessionId(state.sessionId);
        setFileTree(state.fileTree || []);
        setDetectedStack(state.detectedStack);
        setPhases(state.phases.length > 0 ? (state.phases as MigrationPhase[]) : MIGRATION_PHASES);
        setProgress(state.progress);
        setCurrentFile(state.currentFile);
        setStatus(state.status as MigrationStatus);

        const stillRunning = [
          'scanning', 'planning', 'discovery', 'file-analysis',
          'graph-resolution', 'section-writing', 'assembly',
        ].includes(state.status);
        if (stillRunning) {
          addLog('Reconnected to in-progress migration.', 'info');
          openSSE(`${backendUrl}/api/stream/${state.sessionId}`);
        }
      })
      .catch(() => {
        // Session no longer exists on the backend (expired/deleted) — drop the
        // stale reference instead of retrying this fetch on every future mount.
        localStorage.removeItem('last_session_id');
      });
  // Intentionally run once on mount only — restoring is a one-time action per
  // page load, not something that should re-run if backendUrl changes later.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File Upload → Scan ──────────────────────────────────────────────────────
  const handleUpload = useCallback(async (files: FileList | File[], explicitPaths?: string[]) => {
    addLog('Reading project files...', 'info');
    setStatus('scanning');

    const settings = readSettings();
    const formData = new FormData();
    const pathsArray: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath =
        explicitPaths && explicitPaths[i]
          ? explicitPaths[i]
          : ((file as File & { webkitRelativePath: string }).webkitRelativePath || file.name);
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

    try {
      const data = await scanProject(backendUrl, formData);
      const sid = data.sessionId;
      setSessionId(sid);
      
      setLogs([]);
      setProgress(0);
      setFileTree([]);
      setDetectedStack(null);
      
      addLog(`Unpacked folder. Connecting stream to session ${sid}...`, 'info');
      openSSE(`${backendUrl}/api/stream/${sid}`);
    } catch (err: unknown) {
      addLog(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setStatus('error');
    }
  }, [addLog, backendUrl, openSSE]);

  // ── Start Migration ─────────────────────────────────────────────────────────
  const handleStart = useCallback(async (target: TargetStack) => {
    if (!sessionId) return;

    setStatus('scanning');
    setProgress(0);
    setPhases(prev => prev.map(p => {
      if (p.id === 'scan') return { ...p, status: 'done' };
      return { ...p, status: 'pending' };
    }));
    addLog('Starting migration...', 'command');

    const settings = readSettings();
    const combinedApiKey =
      settings.allApiKeys.anthropic   ||
      settings.allApiKeys.openai      ||
      settings.allApiKeys.google      ||
      settings.allApiKeys.grok        ||
      settings.allApiKeys.groq        ||
      settings.allApiKeys.openrouter  ||
      settings.allApiKeys.mistral     ||
      settings.allApiKeys.huggingface ||
      '';

    try {
      await startMigration(backendUrl, {
        sessionId,
        targetStack: target,
        apiKey:          combinedApiKey,
        localOutputPath: settings.localOutputPath,
        apiKeys:         settings.allApiKeys,
        agentsConfig:    (() => {
          try { return JSON.parse(localStorage.getItem('ai_config_agents') || 'null'); } catch { return null; }
        })(),
        toolsConfig:     settings.toolsConfig,
        aliasesConfig:   settings.aliasesConfig,
        promptFragments: settings.promptFragments,
        modelPricing:    settings.modelPricing,
        googleMaxRetries:          settings.googleMaxRetries,
        googleRetryDelayRateLimit: settings.googleRetryDelayRateLimit,
        googleRetryDelayOther:     settings.googleRetryDelayOther,
        googleTimeoutMs:           settings.googleTimeoutMs,
        mistralMaxRetries:          settings.mistralMaxRetries,
        mistralRetryDelayRateLimit: settings.mistralRetryDelayRateLimit,
        mistralRetryDelayOther:     settings.mistralRetryDelayOther,
      });

      openSSE(`${backendUrl}/api/stream/${sessionId}`);
    } catch (err: unknown) {
      addLog(`Migration start failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setStatus('error');
    }
  }, [sessionId, addLog, backendUrl, openSSE]);

  // ── Stop ─────────────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    closeSSE();
    setActiveTool(null);
    pendingToolsRef.current.clear();
    try {
      if (sessionId) await stopMigration(backendUrl, sessionId);
      setStatus('idle');
      addLog('Migration stopped by user.', 'warning');
    } catch (err: unknown) {
      // The backend call failed — the pipeline may still be running server-side.
      // Surface this instead of silently pretending Stop succeeded.
      const msg = `Stop request failed: ${err instanceof Error ? err.message : 'Unknown error'}. The migration may still be running on the server.`;
      addLog(msg, 'error');
      onNotify?.({ type: 'error', message: msg, persistent: true });
    }
  }, [sessionId, addLog, backendUrl, closeSSE, onNotify]);

  // ── Pause ────────────────────────────────────────────────────────────────────
  const handlePause = useCallback(async () => {
    closeSSE();
    setActiveTool(null);
    pendingToolsRef.current.clear();
    try {
      if (sessionId) await pauseMigration(backendUrl, sessionId);
      setStatus('paused');
      addLog('Migration paused.', 'warning');
    } catch (err: unknown) {
      const msg = `Pause request failed: ${err instanceof Error ? err.message : 'Unknown error'}. The migration may still be running on the server.`;
      addLog(msg, 'error');
      onNotify?.({ type: 'error', message: msg, persistent: true });
    }
  }, [sessionId, addLog, backendUrl, closeSSE, onNotify]);

  // ── Select File ──────────────────────────────────────────────────────────────
  const handleSelectFile = useCallback(async (
    path: string,
    setActiveEditorTab: (t: 'code' | 'settings' | 'aiconfig') => void
  ) => {
    setSelectedFile(path);
    setActiveEditorTab('code');
    if (!sessionId) return;
    try {
      const data = await fetchFileContent(backendUrl, sessionId, path);
      setLegacyCode(data.content ?? null);
      setModernCode(data.modernContent ?? null);
    } catch {
      setLegacyCode('// Could not load file content');
      setModernCode(null);
    }
  }, [sessionId, backendUrl]);

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

  return {
    status, sessionId, fileTree, detectedStack, selectedFile,
    legacyCode, modernCode, logs, progress, currentFile, phases,
    modernFileTree, modernFolderBasename, tokenUsage,
    isRunning, hasProject,
    activeTool,
    toolCallHistory,
    handleUpload, handleStart, handleStop, handlePause, handleSelectFile, clearSelectedFile,
    handleDownload,
  };
}
