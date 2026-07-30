// Migration Planning / Code Generation / Verification state and handlers.
// refreshFromSession pulls results from session state, since these sub-stages have no dedicated "done" event.

'use client';

import { useCallback, useState } from 'react';
import type { MigrationTaskEntry, RuleCoverageEntry, TargetStack, LogLevel, MigrationStatus, PlanApprovalStatus, PlanValidation, GraphValidation } from '@/types';
import type { ReportedIssue, SessionStateResponse } from '@/services/api';
import {
  triggerMigrationPlanning,
  triggerCodeGeneration,
  triggerVerification,
  approveMigrationPlan,
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
  // Human sign-off gate between planning and code generation.
  approvalStatus: PlanApprovalStatus | null;
  approvalNote: string | null;
  planValidation: PlanValidation | null;
  graphValidation: GraphValidation | null;
  isApproving: boolean;
  setMigrationTaskList:  (v: MigrationTaskEntry[] | null) => void;
  setRuleCoverageReport: (v: RuleCoverageEntry[] | null) => void;
  /** Maps an already-fetched session response onto every field this hook owns.
   *  The polling loop must call this rather than picking off individual setters —
   *  see the comment on the implementation. */
  applySessionState: (state: SessionStateResponse) => void;
  refreshFromSession: (sessionId: string) => Promise<void>;
  handleStartMigrationPlanning: (target: TargetStack) => Promise<void>;
  handleApprovePlan: (decision: 'approved' | 'disapproved', note?: string) => Promise<void>;
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
  const [approvalStatus, setApprovalStatus]         = useState<PlanApprovalStatus | null>(null);
  const [approvalNote, setApprovalNote]             = useState<string | null>(null);
  const [planValidation, setPlanValidation]         = useState<PlanValidation | null>(null);
  const [graphValidation, setGraphValidation]       = useState<GraphValidation | null>(null);
  const [isApproving, setIsApproving]               = useState(false);

  // Single mapping from a session response onto this hook's state.
  //
  // This exists because the polling loop in useMigration.ts used to reach in and
  // call setMigrationTaskList/setRuleCoverageReport directly, which meant every
  // OTHER field here (approvalStatus, planValidation, planSanityWarning,
  // reportedIssues) was only ever populated by refreshFromSession — and that
  // runs solely after an approve/report click, never on page load or during
  // polling. The visible symptom was a plan whose task list rendered fine while
  // its approval gate stayed invisible, because approvalStatus was still null.
  // Keeping the mapping in one place is what stops that from silently recurring
  // the next time a field is added.
  const applySessionState = useCallback((state: SessionStateResponse) => {
    setMigrationTaskList(state.migrationTaskList ?? null);
    setRuleCoverageReport(state.ruleCoverageReport ?? null);
    setPlanSanityWarning(state.planSanityWarning ?? null);
    setReportedIssues(state.reportedIssues ?? []);
    setApprovalStatus(state.approvalStatus ?? null);
    setApprovalNote(state.approvalNote ?? null);
    setPlanValidation(state.planValidation ?? null);
    setGraphValidation(state.graphValidation ?? null);
  }, []);

  const refreshFromSession = useCallback(async (sid: string) => {
    try {
      const state = await fetchSessionState(backendUrl, sid);
      applySessionState(state);
    } catch {
      // non-critical — user can refresh
    }
  }, [backendUrl, applySessionState]);

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
    // Re-planning produces a genuinely new plan — any earlier sign-off applied
    // to the OLD one, so it must not carry over and let code generation run
    // against a plan nobody actually approved.
    setApprovalStatus(null);
    setApprovalNote(null);
    setPlanValidation(null);
    setGraphValidation(null);
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

  // Records the human's sign-off via the separate Migration Plan Approval
  // Agent webhook (see approveMigrationPlan in api.ts for why it's its own
  // workflow rather than a blocking node inside the planning agent).
  //
  // Sets approvalStatus locally right away so the panel responds immediately,
  // then re-reads the session so what's rendered is the value that actually
  // landed in MongoDB — not just our optimistic guess. Unlike the other
  // handlers here this does NOT touch setStatus/startPolling: recording a
  // decision isn't a pipeline stage, and claiming one would leave the panel
  // showing a running stage that no agent is actually working on.
  const handleApprovePlan = useCallback(async (decision: 'approved' | 'disapproved', note?: string) => {
    if (!sessionId || isApproving) return;

    const settings = readSettings();
    if (!settings.agentBuilderWebhookUrl.trim()) {
      addLog('AgentBuilder Webhook Base URL is not configured — set it in Settings first.', 'error');
      return;
    }

    setIsApproving(true);
    try {
      await approveMigrationPlan(settings.agentBuilderWebhookUrl, sessionId, decision, note);
      setApprovalStatus(decision);
      setApprovalNote(note ?? null);
      addLog(
        decision === 'approved'
          ? 'Migration plan approved — code generation unlocked.'
          : 'Migration plan sent back for revision.',
        'success',
      );
      await refreshFromSession(sessionId);
    } catch (err: unknown) {
      addLog(`Failed to record plan decision: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      throw err;
    } finally {
      setIsApproving(false);
    }
  }, [sessionId, isApproving, addLog, refreshFromSession]);

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
    approvalStatus, approvalNote, planValidation, graphValidation, isApproving,
    setMigrationTaskList, setRuleCoverageReport,
    applySessionState,
    refreshFromSession,
    handleStartMigrationPlanning, handleApprovePlan,
    handleStartCodeGeneration, handleStartVerification,
    handleReportIssue,
  };
}
