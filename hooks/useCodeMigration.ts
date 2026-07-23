// Migration Planning / Code Generation / Verification state and handlers.
// refreshFromSession pulls results from session state, since these sub-stages have no dedicated "done" event.

'use client';

import { useCallback, useState } from 'react';
import type { MigrationTaskEntry, RuleCoverageEntry, TargetStack, LogLevel, MigrationStatus } from '@/types';
import type { ReportedIssue } from '@/services/api';
import {
  triggerMigrationPlanning,
  triggerCodeGeneration,
  triggerVerification,
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

export function useCodeMigration(
  backendUrl: string,
  sessionId:  string | null,
  addLog:     LogFn,
  startPolling: (sessionId: string) => void,
  setStatus:  (s: MigrationStatus) => void,
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

  // Fires the Migration Planning Agent webhook (same pattern as Scanner Agent
  // and Stage-1 Analysis — it reads the knowledge graph + report back out of
  // MongoDB itself rather than receiving them again over this call).
  // targetStack IS sent here — it's picked fresh on this panel and isn't
  // reliably present on the session (Stage-1's workflow only uses it for the
  // report prompt, it never persists it back to MongoDB).
  // Optimistically set to 'migration-planning' (a real, non-terminal
  // MigrationStatus) so polling has an honest reason to keep running until
  // the agent's MongoDB write actually lands — same fix as Stage-1's polling
  // bug.
  const handleStartMigrationPlanning = useCallback(async (target: TargetStack) => {
    if (!sessionId) return;

    const settings = readSettings();
    if (!settings.agentBuilderWebhookUrl.trim()) {
      addLog('AgentBuilder Webhook Base URL is not configured — set it in Settings first.', 'error');
      return;
    }

    setMigrationTaskList(null);
    setRuleCoverageReport(null);
    setPlanSanityWarning(null);
    setStatus('migration-planning');
    addLog('Starting migration planning...', 'command');

    try {
      await triggerMigrationPlanning(settings.agentBuilderWebhookUrl, sessionId, target);
      addLog('Migration Planning Agent triggered.', 'success');
      startPolling(sessionId);
    } catch (err: unknown) {
      addLog(`Migration planning failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setStatus('error');
    }
  }, [sessionId, addLog, startPolling, setStatus]);

  // Fires the Code Generation Agent webhook (same pattern as the other
  // agents — reads migrationTaskList + knowledge graph + source files back
  // out of MongoDB itself). Optimistically set to 'code-generation' so
  // polling keeps running until the agent's MongoDB write lands.
  const handleStartCodeGeneration = useCallback(async (target: TargetStack) => {
    if (!sessionId) return;

    const settings = readSettings();
    if (!settings.agentBuilderWebhookUrl.trim()) {
      addLog('AgentBuilder Webhook Base URL is not configured — set it in Settings first.', 'error');
      return;
    }

    setStatus('code-generation');
    addLog('Starting code generation...', 'command');

    try {
      await triggerCodeGeneration(settings.agentBuilderWebhookUrl, sessionId, target);
      addLog('Code Generation Agent triggered.', 'success');
      startPolling(sessionId);
    } catch (err: unknown) {
      addLog(`Code generation failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setStatus('error');
    }
  }, [sessionId, addLog, startPolling, setStatus]);

  // Fires the Verification Agent webhook (same pattern as the other agents —
  // reads migrationTaskList + the real legacy/generated file content back out
  // of MongoDB itself). Optimistically set to 'verification' so polling keeps
  // running until the agent's MongoDB write lands.
  const handleStartVerification = useCallback(async (target: TargetStack) => {
    if (!sessionId) return;

    const settings = readSettings();
    if (!settings.agentBuilderWebhookUrl.trim()) {
      addLog('AgentBuilder Webhook Base URL is not configured — set it in Settings first.', 'error');
      return;
    }

    setStatus('verification');
    addLog('Starting verification...', 'command');

    try {
      await triggerVerification(settings.agentBuilderWebhookUrl, sessionId, target);
      addLog('Verification Agent triggered.', 'success');
      startPolling(sessionId);
    } catch (err: unknown) {
      addLog(`Verification failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setStatus('error');
    }
  }, [sessionId, addLog, startPolling, setStatus]);

  return {
    migrationTaskList, ruleCoverageReport, planSanityWarning, reportedIssues,
    setMigrationTaskList, setRuleCoverageReport,
    refreshFromSession,
    handleStartMigrationPlanning, handleStartCodeGeneration, handleStartVerification,
    handleReportIssue,
  };
}
