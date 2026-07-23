// Human checkpoint — the Migration Planner Agent's per-file task list and rule
// coverage manifest, shown for review before code generation exists.
'use client';

import { useState } from 'react';
import { ListTree, ShieldCheck, CheckCircle2, XCircle, Circle, AlertTriangle, MessageSquareWarning, Loader2, Wrench } from 'lucide-react';
import type { MigrationTaskEntry, RuleCoverageEntry } from '@/types';
import type { ReportedIssue } from '@/services/api';
import { useNotifications } from '@/context/NotificationContext';

interface Props {
  tasks: MigrationTaskEntry[];
  ruleCoverage: RuleCoverageEntry[];
  // Non-blocking sanity check result (see backend graph-resolver.ts's
  // checkImportsGraphSanity) — e.g. real legacy files silently missing from
  // the plan. Never hidden in a log only; shown right where the human is
  // already looking at this exact panel before deciding to generate code.
  sanityWarning?: string | null;
  // Human "report an issue" channel — catches whatever the automatic sanity
  // check above didn't anticipate. A real DIAGNOSTIC_AGENT investigates
  // (read-only, never auto-fixes) once submitted; see diagnostic-routes.ts.
  reportedIssues?: ReportedIssue[];
  onReportIssue?: (stage: string, text: string) => Promise<void>;
  stage?: string;
}

const STATUS_ICON: Record<MigrationTaskEntry['status'], { icon: typeof Circle; color: string }> = {
  pending:   { icon: Circle,       color: 'var(--text-muted)' },
  generated: { icon: Circle,       color: 'var(--text-info)' },
  verified:  { icon: CheckCircle2, color: 'var(--text-success)' },
  failed:    { icon: XCircle,      color: 'var(--text-error, #e05252)' },
};

// Must match INFRASTRUCTURE_TASK_PREFIX in the backend's stage2/runners/shared.ts —
// marks a synthetic task with no real legacy source (e.g. the shared DB connection module).
const INFRASTRUCTURE_TASK_PREFIX = '__infrastructure__/';
function taskDisplayName(legacyFile: string): string {
  if (!legacyFile.startsWith(INFRASTRUCTURE_TASK_PREFIX)) return legacyFile;
  const kind = legacyFile.slice(INFRASTRUCTURE_TASK_PREFIX.length).replace(/-/g, ' ');
  return `Shared infrastructure: ${kind}`;
}

export default function MigrationTaskList({
  tasks, ruleCoverage, sanityWarning, reportedIssues = [], onReportIssue, stage = 'migration-planning',
}: Props) {
  const [issueText, setIssueText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { notify } = useNotifications();

  if (tasks.length === 0) return null;

  const totalRules = ruleCoverage.reduce((sum, r) => sum + r.rules.length, 0);
  const coverageByFile = new Map(ruleCoverage.map(r => [r.legacyFile, r]));

  const handleSubmitIssue = async () => {
    if (!onReportIssue || !issueText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onReportIssue(stage, issueText.trim());
      setIssueText('');
      notify({ type: 'success', message: 'Issue reported — investigating now.' });
    } catch (err: unknown) {
      notify({ type: 'warning', message: err instanceof Error ? err.message : 'Failed to report issue.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ai-section">
      <div className="ai-section__title">
        <ListTree size={12} />
        <span>Migration Plan ({tasks.length} file{tasks.length === 1 ? '' : 's'})</span>
      </div>

      {sanityWarning && (
        // Same visual pattern as ActionButtons.tsx's migrationDisabledReason
        // card — deliberately reused, not a new style, so warnings look
        // consistent everywhere in this panel.
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '11.5px', fontWeight: 600, color: 'var(--text-warning)',
          background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--text-warning)',
          borderRadius: '0 4px 4px 0', padding: '6px 10px', marginBottom: '8px',
        }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{sanityWarning}</span>
        </div>
      )}

      {totalRules > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px',
          color: 'var(--text-info)', marginBottom: '6px',
        }}>
          <ShieldCheck size={12} />
          <span>{totalRules} business rule{totalRules === 1 ? '' : 's'} to preserve across {ruleCoverage.length} file{ruleCoverage.length === 1 ? '' : 's'}</span>
        </div>
      )}

      <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {tasks.map(task => {
          const { icon: StatusIcon, color } = STATUS_ICON[task.status];
          const coverage  = coverageByFile.get(task.legacyFile);
          const covered   = coverage?.covered ?? [];
          const uncovered = coverage?.uncovered ?? [];
          // Only show "X/Y covered" once verification has actually judged every rule.
          const hasCoverageVerdict = covered.length + uncovered.length >= task.rulesInvolved.length && task.rulesInvolved.length > 0;

          return (
            <div
              key={task.legacyFile}
              style={{
                fontSize: '11px', fontFamily: 'var(--font-mono)',
                padding: '5px 7px', borderRadius: '4px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <StatusIcon size={11} style={{ color, flexShrink: 0 }} />
                <div style={{ color: 'var(--text-primary)' }}>
                  {taskDisplayName(task.legacyFile)}
                  {task.mergedLegacyFiles && task.mergedLegacyFiles.length > 0 && ` + ${task.mergedLegacyFiles.length} more`}
                </div>
                {task.wasAutoFixed && (
                  <div
                    title="The Verification Agent found a real problem in the generated code and rewrote this file — worth a second look, not just trusting the checkmark."
                    style={{
                      display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0,
                      fontSize: '9.5px', fontWeight: 700, color: 'var(--text-warning)',
                      background: 'var(--bg-tertiary)', border: '1px solid var(--text-warning)',
                      borderRadius: '10px', padding: '1px 6px', marginLeft: '4px',
                    }}
                  >
                    <Wrench size={9} />
                    <span>FIXED</span>
                  </div>
                )}
              </div>
              {task.mergedLegacyFiles && task.mergedLegacyFiles.length > 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '16px' }}>
                  Merged with: {task.mergedLegacyFiles.join(', ')} (same target file — combined into one generation task)
                </div>
              )}
              <div style={{ color: 'var(--text-info)', marginLeft: '16px' }}>&rarr; {task.targetFile}</div>
              {task.rulesInvolved.length > 0 && (
                <div
                  style={{
                    color: hasCoverageVerdict && uncovered.length === 0 ? 'var(--text-success)' : 'var(--text-warning)',
                    fontSize: '10px', marginTop: '2px', marginLeft: '16px',
                  }}
                >
                  {hasCoverageVerdict
                    ? `${covered.length}/${task.rulesInvolved.length} rule${task.rulesInvolved.length === 1 ? '' : 's'} covered`
                    : `${task.rulesInvolved.length} rule${task.rulesInvolved.length === 1 ? '' : 's'}`}
                </div>
              )}
              {task.status === 'failed' && task.lastError && (
                <div style={{ color: 'var(--text-error, #e05252)', fontSize: '10px', marginTop: '3px', marginLeft: '16px' }}>
                  {task.lastError}
                </div>
              )}
              {uncovered.length > 0 && (
                <div style={{ color: 'var(--text-error, #e05252)', fontSize: '10px', marginTop: '2px', marginLeft: '16px' }}>
                  Unenforced: {uncovered.join('; ')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onReportIssue && (
        <div className="report-issue-card">
          <div className="report-issue-card__header">
            <MessageSquareWarning size={14} />
            <span>Something look wrong? Describe it and a diagnostic agent will investigate.</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              className="form-input-premium"
              value={issueText}
              onChange={e => setIssueText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmitIssue(); }}
              placeholder="e.g. this plan only shows 4 files, my project has way more"
              disabled={submitting}
              style={{ fontSize: '11px', padding: '6px 8px' }}
            />
            <button
              className="btn-premium btn-premium--primary"
              onClick={handleSubmitIssue}
              disabled={submitting || !issueText.trim()}
              style={{ opacity: submitting || !issueText.trim() ? 0.5 : 1, padding: '5px 12px', width: 'auto', flexShrink: 0 }}
            >
              {submitting ? <Loader2 size={12} className="spin" /> : <span style={{ fontSize: '11px' }}>Report</span>}
            </button>
          </div>

          {reportedIssues.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
              {reportedIssues.slice().reverse().map((issue, i) => (
                <div
                  key={issue.reportedAt + i}
                  style={{
                    fontSize: '10.5px', padding: '5px 7px', borderRadius: '4px',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ color: 'var(--text-primary)' }}>&quot;{issue.text}&quot;</div>
                  {issue.diagnosis ? (
                    <div style={{ marginTop: '4px', color: 'var(--text-info)' }}>
                      <div><strong>Root cause:</strong> {issue.diagnosis.rootCause}</div>
                      <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                        <strong>Evidence:</strong> {issue.diagnosis.evidence}
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        <strong>Suggested:</strong> {issue.diagnosis.suggestedAction}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '3px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Loader2 size={10} className="spin" />
                      <span>Investigating...</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
