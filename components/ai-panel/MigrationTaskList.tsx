// Human checkpoint — the Migration Planner Agent's per-file task list and rule
// coverage manifest, shown for review before code generation exists.
'use client';

import { ListTree, ShieldCheck, CheckCircle2, XCircle, Circle } from 'lucide-react';
import type { MigrationTaskEntry, RuleCoverageEntry } from '@/types';

interface Props {
  tasks: MigrationTaskEntry[];
  ruleCoverage: RuleCoverageEntry[];
}

const STATUS_ICON: Record<MigrationTaskEntry['status'], { icon: typeof Circle; color: string }> = {
  pending:   { icon: Circle,       color: 'var(--text-muted)' },
  generated: { icon: Circle,       color: 'var(--text-info)' },
  verified:  { icon: CheckCircle2, color: 'var(--text-success)' },
  failed:    { icon: XCircle,      color: 'var(--text-error, #e05252)' },
};

export default function MigrationTaskList({ tasks, ruleCoverage }: Props) {
  if (tasks.length === 0) return null;

  const totalRules = ruleCoverage.reduce((sum, r) => sum + r.rules.length, 0);
  const coverageByFile = new Map(ruleCoverage.map(r => [r.legacyFile, r]));

  return (
    <div className="ai-section">
      <div className="ai-section__title">
        <ListTree size={12} />
        <span>Migration Plan ({tasks.length} file{tasks.length === 1 ? '' : 's'})</span>
      </div>

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
                <div style={{ color: 'var(--text-primary)' }}>{task.legacyFile}</div>
              </div>
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
    </div>
  );
}
