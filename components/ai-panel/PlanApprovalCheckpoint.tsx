// HITL checkpoint — shown once the Migration Planning Agent has produced a plan
// (approvalStatus 'pending'). Surfaces what the agent's own validation passes
// found, then lets the user approve the plan (unlocking code generation) or send
// it back for revision.
'use client';

import { useState } from 'react';
import { ClipboardCheck, CheckCircle2, AlertTriangle, XCircle, Loader2, RotateCcw } from 'lucide-react';
import type { PlanApprovalStatus, PlanValidation, GraphValidation } from '@/types';

interface Props {
  taskCount:       number;
  approvalStatus:  PlanApprovalStatus | null;
  approvalNote:    string | null;
  planValidation:  PlanValidation | null;
  graphValidation: GraphValidation | null;
  isBusy:          boolean;   // an approve/disapprove request is in flight
  onApprove:    () => void;
  onDisapprove: (note: string) => void;
}

const SEVERITY_COLOR: Record<'low' | 'medium' | 'high', string> = {
  low:    'var(--text-muted)',
  medium: 'var(--text-warning)',
  high:   'var(--text-error, #e05252)',
};

export default function PlanApprovalCheckpoint({
  taskCount, approvalStatus, approvalNote, planValidation, graphValidation,
  isBusy, onApprove, onDisapprove,
}: Props) {
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  const issues = planValidation?.issues ?? [];
  const highSeverityCount = issues.filter(i => i.severity === 'high').length;

  const cycleCount     = graphValidation?.cycles?.length ?? 0;
  const orphanCount    = graphValidation?.orphanedDependencies?.length ?? 0;
  const duplicateCount = graphValidation?.duplicateTargets?.length ?? 0;
  const hasStructuralFindings = cycleCount + orphanCount + duplicateCount > 0;

  // ── Already decided — show the outcome, not the buttons ────────────────────
  if (approvalStatus === 'approved') {
    return (
      <div className="ai-section">
        <div className="completion-badge-premium">
          <CheckCircle2 size={16} />
          <span>Migration plan approved — code generation unlocked.</span>
        </div>
      </div>
    );
  }

  if (approvalStatus === 'disapproved') {
    return (
      <div className="ai-section">
        <div className="ai-section__title">
          <RotateCcw size={12} />
          <span>Plan Sent Back</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '6px',
          fontSize: '12px', color: 'var(--text-warning)',
          background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--text-warning)',
          borderRadius: '0 4px 4px 0', padding: '6px 10px',
        }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            This plan was sent back for revision
            {approvalNote ? <>: &ldquo;{approvalNote}&rdquo;</> : '.'}
            {' '}Use <strong>Re-plan Migration</strong> above to generate a new one.
          </span>
        </div>
      </div>
    );
  }

  // ── Pending — the actual review gate ───────────────────────────────────────
  return (
    <div className="ai-section">
      <div className="ai-section__title">
        <ClipboardCheck size={12} />
        <span>Plan Approval</span>
        {/* Fixed violet + white, matching GraphReviewCheckpoint's chip — a status
            pill needs to read correctly in every theme, and --accent-purple's
            dark/light values weren't tuned as a pair for white text. */}
        <span style={{
          fontSize: '9px', fontWeight: 700, color: '#ffffff',
          background: '#8250df', border: '1px solid #8250df',
          borderRadius: '3px', padding: '1px 6px', letterSpacing: '0.4px',
          textTransform: 'uppercase', marginLeft: '2px',
        }}>
          Action Needed
        </span>
      </div>

      <p style={{ fontSize: '12.5px', lineHeight: '1.5', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
        {taskCount} file{taskCount === 1 ? '' : 's'} planned. Review the plan below,
        then approve it to unlock code generation.
      </p>

      {/* Structural findings from Validate Task Graph. Cycles are already broken
          by the agent so generation can proceed — reported so the human knows it
          happened, not as a blocker. */}
      {hasStructuralFindings && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '3px',
          fontSize: '11.5px', color: 'var(--text-warning)',
          background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--text-warning)',
          borderRadius: '0 4px 4px 0', padding: '6px 10px', marginBottom: '8px',
        }}>
          {cycleCount > 0 && (
            <span>{cycleCount} dependency cycle{cycleCount === 1 ? '' : 's'} found and automatically broken.</span>
          )}
          {orphanCount > 0 && (
            <span>{orphanCount} dependency reference{orphanCount === 1 ? '' : 's'} point to files not in the plan.</span>
          )}
          {duplicateCount > 0 && (
            <span>{duplicateCount} duplicate target file assignment{duplicateCount === 1 ? '' : 's'}.</span>
          )}
        </div>
      )}

      {/* Semantic findings from the Validate Migration Plan LLM */}
      {issues.length > 0 ? (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px',
            color: highSeverityCount > 0 ? 'var(--text-error, #e05252)' : 'var(--text-warning)',
            marginBottom: '6px',
          }}>
            <AlertTriangle size={12} />
            <span>
              {issues.length} correctness issue{issues.length === 1 ? '' : 's'} flagged
              {highSeverityCount > 0 ? ` (${highSeverityCount} high severity)` : ''}
            </span>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
            {issues.map((issue, i) => (
              <div
                key={`${issue.targetFile}-${i}`}
                style={{
                  fontSize: '11px', padding: '5px 7px', borderRadius: '4px',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                    color: SEVERITY_COLOR[issue.severity], flexShrink: 0,
                  }}>
                    {issue.severity}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-info)' }}>
                    {issue.targetFile}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '3px', lineHeight: '1.45' }}>
                  {issue.issue}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '11.5px', color: 'var(--text-success)', marginBottom: '10px',
        }}>
          <CheckCircle2 size={12} />
          <span>Automated validation found no correctness issues.</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          className="btn-premium btn-premium--primary"
          onClick={onApprove}
          disabled={isBusy}
          style={{ opacity: isBusy ? 0.45 : 1 }}
          title="Approve this plan and unlock code generation"
        >
          {isBusy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />}
          <span>Approve Plan</span>
        </button>

        {!showRevisionForm ? (
          <button
            className="btn-premium btn-premium--secondary"
            onClick={() => setShowRevisionForm(true)}
            disabled={isBusy}
            style={{ opacity: isBusy ? 0.45 : 1 }}
            title="Send this plan back instead of generating code from it"
          >
            <XCircle size={13} />
            <span>Request Changes</span>
          </button>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '6px',
            border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '8px',
          }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              What&apos;s wrong with this plan? Recorded with the decision so the next run has context.
            </span>
            <input
              type="text"
              className="form-input-premium"
              value={revisionNote}
              onChange={e => setRevisionNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && revisionNote.trim()) onDisapprove(revisionNote.trim()); }}
              placeholder="e.g. auth middleware should not merge into the router file"
              disabled={isBusy}
              style={{ fontSize: '11px', padding: '6px 8px' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn-premium btn-premium--danger"
                onClick={() => onDisapprove(revisionNote.trim())}
                disabled={isBusy || !revisionNote.trim()}
                style={{ flex: 1, opacity: isBusy || !revisionNote.trim() ? 0.45 : 1 }}
              >
                {isBusy ? <Loader2 size={13} className="spin" /> : <XCircle size={13} />}
                <span>Send back</span>
              </button>
              <button
                className="btn-premium btn-premium--secondary"
                onClick={() => { setShowRevisionForm(false); setRevisionNote(''); }}
                disabled={isBusy}
                style={{ flex: 1 }}
              >
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
