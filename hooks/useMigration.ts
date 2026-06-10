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

import { useCallback, useEffect, useState } from 'react';
import {
  DetectedStack,
  FileNode,
  LogEntry,
  MigrationPhase,
  MigrationStatus,
  TargetStack,
  MIGRATION_PHASES,
} from '@/types';
import {
  scanProject,
  startMigration,
  stopMigration,
  pauseMigration,
  fetchFileContent,
  fetchModernTree,
  fetchSessionTokens,
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
  estimatedCost: number;
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
  isRunning: boolean;
  hasProject: boolean;
  planPhaseDone: boolean;
  // Handlers
  handleUpload: (files: FileList | File[], explicitPaths?: string[]) => Promise<void>;
  handleStart: (target: TargetStack) => Promise<void>;
  handleStop: () => Promise<void>;
  handlePause: () => Promise<void>;
  handleSelectFile: (path: string, setActiveEditorTab: (t: 'code' | 'settings' | 'aiconfig') => void) => Promise<void>;
  clearSelectedFile: () => void;
}

// ── Main Hook ─────────────────────────────────────────────────────────────────

export function useMigration(
  backendUrl: string,
  settingsTrigger: number
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

  const isRunning     = ['scanning', 'planning'].includes(status);
  const hasProject    = fileTree.length > 0;
  const planPhaseDone = phases.find(p => p.id === 'plan')?.status === 'done';

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
      case 'log':
        addLog(
          event.data.message as string,
          (event.data.level as LogEntry['level']) ?? 'info',
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

      case 'phase_change':
        setStatus(event.data.phase as MigrationStatus);
        setPhases(prev => prev.map(p =>
          p.id === event.data.phaseId
            ? { ...p, status: event.data.status as MigrationPhase['status'] }
            : p
        ));
        if (sessionId) refreshModernTree(sessionId);
        break;

      case 'file_migrated':
        setFileTree(prev => markMigrated(prev, event.data.path as string));
        if (sessionId) refreshModernTree(sessionId);
        break;

      case 'complete': {
        const payload = event.data as any;
        if (payload && payload.isScan) {
          setFileTree(payload.fileTree || []);
          setDetectedStack(payload.detectedStack || null);
          setStatus('idle');
          closeSSE();
          if (payload.detectedStack) {
            addLog(`✅ Scanned ${payload.detectedStack.fileCount} files`, 'success');
            addLog(`Detected: ${payload.detectedStack.language} / ${payload.detectedStack.framework} / ${payload.detectedStack.database}`, 'info');
          }
        } else {
          setStatus('complete');
          setProgress(100);
          closeSSE();
          addLog('🎉 Migration complete!', 'success');
        }
        if (sessionId) refreshModernTree(sessionId);
        break;
      }

      case 'error':
        setStatus('error');
        addLog(event.data.message as string, 'error');
        closeSSE();
        break;

      case 'token_usage': {
        const tu = {
          inputTokens:   (event.data.inputTokens   as number) ?? 0,
          outputTokens:  (event.data.outputTokens  as number) ?? 0,
          cachedInputTokens: (event.data.cachedInputTokens as number) ?? undefined,
          readCachedInputTokens: (event.data.readCachedInputTokens as number) ?? undefined,
          totalTokens:   (event.data.totalTokens   as number) ?? 0,
          estimatedCost: (event.data.estimatedCost as number) ?? 0,
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
  }, [addLog, backendUrl, refreshModernTree, openSSE]);

  // ── Start Migration ─────────────────────────────────────────────────────────
  const handleStart = useCallback(async (target: TargetStack) => {
    if (!sessionId) return;

    setStatus('scanning');
    setProgress(0);
    setPhases(prev => prev.map(p => {
      if (p.id === 'scan' || (p.id === 'plan' && planPhaseDone)) return { ...p, status: 'done' };
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
        googleMaxRetries:          settings.googleMaxRetries,
        googleRetryDelayRateLimit: settings.googleRetryDelayRateLimit,
        googleRetryDelayOther:     settings.googleRetryDelayOther,
        googleTimeoutMs:           settings.googleTimeoutMs,
      });

      openSSE(`${backendUrl}/api/stream/${sessionId}`);
    } catch (err: unknown) {
      addLog(`Migration start failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setStatus('error');
    }
  }, [sessionId, addLog, backendUrl, planPhaseDone, openSSE]);

  // ── Stop ─────────────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    closeSSE();
    if (sessionId) await stopMigration(backendUrl, sessionId);
    setStatus('idle');
    addLog('Migration stopped by user.', 'warning');
  }, [sessionId, addLog, backendUrl, closeSSE]);

  // ── Pause ────────────────────────────────────────────────────────────────────
  const handlePause = useCallback(async () => {
    closeSSE();
    if (sessionId) await pauseMigration(backendUrl, sessionId);
    setStatus('paused');
    addLog('Migration paused.', 'warning');
  }, [sessionId, addLog, backendUrl, closeSSE]);

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

  return {
    status, sessionId, fileTree, detectedStack, selectedFile,
    legacyCode, modernCode, logs, progress, currentFile, phases,
    modernFileTree, modernFolderBasename, tokenUsage,
    isRunning, hasProject, planPhaseDone,
    handleUpload, handleStart, handleStop, handlePause, handleSelectFile, clearSelectedFile,
  };
}
