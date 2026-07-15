// Migration Planning / Code Generation / Verification state and handlers.
// refreshFromSession pulls results from session state, since these sub-stages have no SSE 'complete' event.

'use client';

import { useCallback, useState } from 'react';
import type { MigrationTaskEntry, RuleCoverageEntry, TargetStack, LogLevel } from '@/types';
import type { ReportedIssue } from '@/services/api';
import {
  startMigrationPlanning,
  startCodeGeneration,
  startVerification,
  fetchSessionState,
  reportIssue,
} from '@/services/api';
import { readSettings } from '@/hooks/useSettings';

type LogFn = (message: string, level?: LogLevel, phase?: string) => void;

export interface UseCodeMigrationReturn {
  migrationTaskList:  MigrationTaskEntry[] | null;
  ruleCoverageReport: RuleCoverageEntry[] | null;
  planSanityWarning: string | null;
  reportedIssues: ReportedIssue[];
  setMigrationTaskList:  (v: MigrationTaskEntry[] | null) => void;
  setRuleCoverageReport: (v: RuleCoverageEntry[] | null) => void;
  refreshFromSession: (sessionId: string) => Promise<void>;
  handleStartMigrationPlanning: (target: TargetStack) => Promise<void>;
  handleStartCodeGeneration:    (target: TargetStack) => Promise<void>;
  handleStartVerification:      (target: TargetStack) => Promise<void>;
  handleReportIssue: (stage: string, text: string) => Promise<void>;
}

// Each sub-stage wipes session.apiKey/apiKeys once it finishes, so it must be resent for the next.
function resolveCombinedApiKey(allApiKeys: Record<string, string>): string {
  return (
    allApiKeys.anthropic   ||
    allApiKeys.openai      ||
    allApiKeys.google      ||
    allApiKeys.grok        ||
    allApiKeys.groq        ||
    allApiKeys.openrouter  ||
    allApiKeys.mistral     ||
    allApiKeys.huggingface ||
    ''
  );
}

export function useCodeMigration(
  backendUrl: string,
  sessionId:  string | null,
  addLog:     LogFn,
  openSSE:    (url: string) => void,
): UseCodeMigrationReturn {
  const [migrationTaskList, setMigrationTaskList]   = useState<MigrationTaskEntry[] | null>(null);
  const [ruleCoverageReport, setRuleCoverageReport] = useState<RuleCoverageEntry[] | null>(null);
  const [planSanityWarning, setPlanSanityWarning]   = useState<string | null>(null);
  const [reportedIssues, setReportedIssues]         = useState<ReportedIssue[]>([]);

  const refreshFromSession = useCallback(async (sid: string) => {
    try {
      const state = await fetchSessionState(backendUrl, sid);
      setMigrationTaskList(state.migrationTaskList ?? null);
      setRuleCoverageReport(state.ruleCoverageReport ?? null);
      setPlanSanityWarning(state.planSanityWarning ?? null);
      setReportedIssues(state.reportedIssues ?? []);
    } catch {
      // non-critical — user can refresh
    }
  }, [backendUrl]);

  // The diagnostic agent investigation runs async on the backend (real tool
  // calls take real time) — poll a few times after submitting so the human
  // sees the diagnosis appear without a manual page refresh, then give up
  // (the raw report is already saved regardless of whether this loop catches
  // the diagnosis landing).
  const handleReportIssue = useCallback(async (stage: string, text: string) => {
    if (!sessionId) return;
    await reportIssue(backendUrl, sessionId, stage, text);
    await refreshFromSession(sessionId);

    let attempts = 0;
    const poll = async () => {
      attempts++;
      await refreshFromSession(sessionId);
      if (attempts < 6) setTimeout(poll, 5000);
    };
    setTimeout(poll, 5000);
  }, [sessionId, backendUrl, refreshFromSession]);

  const handleStartMigrationPlanning = useCallback(async (target: TargetStack) => {
    if (!sessionId) return;

    setMigrationTaskList(null);
    setRuleCoverageReport(null);
    setPlanSanityWarning(null);
    addLog('Starting migration planning...', 'command');

    const settings = readSettings();
    const combinedApiKey = resolveCombinedApiKey(settings.allApiKeys);

    try {
      await startMigrationPlanning(backendUrl, sessionId, target, combinedApiKey, settings.allApiKeys);
      // Reopen the stream — the prior stage's SSE connection already closed.
      openSSE(`${backendUrl}/api/stream/${sessionId}`);
    } catch (err: unknown) {
      addLog(`Migration planning failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  }, [sessionId, addLog, backendUrl, openSSE]);

  const handleStartCodeGeneration = useCallback(async (target: TargetStack) => {
    if (!sessionId) return;

    addLog('Starting code generation...', 'command');

    const settings = readSettings();
    const combinedApiKey = resolveCombinedApiKey(settings.allApiKeys);

    try {
      await startCodeGeneration(backendUrl, sessionId, target, combinedApiKey, settings.allApiKeys);
      openSSE(`${backendUrl}/api/stream/${sessionId}`);
    } catch (err: unknown) {
      addLog(`Code generation failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  }, [sessionId, addLog, backendUrl, openSSE]);

  const handleStartVerification = useCallback(async (target: TargetStack) => {
    if (!sessionId) return;

    addLog('Starting verification...', 'command');

    const settings = readSettings();
    const combinedApiKey = resolveCombinedApiKey(settings.allApiKeys);

    try {
      await startVerification(backendUrl, sessionId, target, combinedApiKey, settings.allApiKeys);
      openSSE(`${backendUrl}/api/stream/${sessionId}`);
    } catch (err: unknown) {
      addLog(`Verification failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  }, [sessionId, addLog, backendUrl, openSSE]);

  return {
    migrationTaskList, ruleCoverageReport, planSanityWarning, reportedIssues,
    setMigrationTaskList, setRuleCoverageReport,
    refreshFromSession,
    handleStartMigrationPlanning, handleStartCodeGeneration, handleStartVerification,
    handleReportIssue,
  };
}
