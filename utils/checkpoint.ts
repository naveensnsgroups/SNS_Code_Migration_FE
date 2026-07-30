// Human-in-the-loop (HITL) checkpoint detection, shared by the Live Activity
// panel and the Operational Panel so both frame the same pauses identically.
//
// The pipeline reports status 'complete' at the END of EVERY user-gated stage —
// not just at the true end (see backend routes/migrate.ts: overallStatus reverts
// to 'complete' after each Stage-2 sub-stage). So a bare status === 'complete'
// can't tell "the whole job is done" apart from "one stage finished and it's now
// paused waiting on your next click". This resolves that by looking at what phase
// is pending NEXT.

import type { MigrationPhase, MigrationStatus, PlanApprovalStatus } from '@/types';

export interface CheckpointInfo {
  /** Short status label, e.g. "Migration Plan Ready". */
  label: string;
  /** One-line next-step hint shown under the label. */
  hint: string;
}

// The plan-approval gate sits between 'migration-planning' finishing and
// 'code-generation' being allowed to start. Both are reported by the SAME next
// pending phase ('code-generation'), so approvalStatus is what tells them apart —
// without it the panels would claim "review the plan, then generate the code"
// while the real blocker is an un-clicked Approve button.
const APPROVAL_CHECKPOINTS: Record<Exclude<PlanApprovalStatus, 'approved'>, CheckpointInfo> = {
  pending: {
    label: 'Awaiting Plan Approval',
    hint: 'Review the migration plan in the panel, then approve it to unlock code generation.',
  },
  disapproved: {
    label: 'Plan Sent Back',
    hint: 'This plan was sent back for revision — re-plan the migration to continue.',
  },
};

// Keyed by the NEXT pending phase — i.e. the user-gated action awaiting you.
// Only phases that require a human decision to proceed are listed; anything not
// here (e.g. 'migration-assembly', which has no separate button) is treated as
// "no checkpoint", so the run reads as genuinely Complete once verification ends.
const CHECKPOINT_BY_NEXT_PHASE: Record<string, CheckpointInfo> = {
  'migration-planning': {
    label: 'Stage 1 Complete',
    hint: 'Review the analysis, then configure a target and start code migration in the panel.',
  },
  'code-generation': {
    label: 'Migration Plan Ready',
    hint: 'Review the migration plan in the panel, then generate the modernized code.',
  },
  'verification': {
    label: 'Code Generated',
    hint: 'Review the generated files in the panel, then verify them.',
  },
};

/**
 * Returns the active HITL checkpoint, or null when there isn't one.
 *
 * A checkpoint exists when the run's status is 'complete' (a stage just finished)
 * AND the next pending phase is one that needs your decision to start. Returns
 * null mid-run and when the pipeline is genuinely finished.
 *
 * approvalStatus refines the 'code-generation' case into the plan-approval gate —
 * pass it wherever it's known so the pause is named for what's actually blocking.
 * Omitting it (or passing null/'approved') keeps the original behaviour, so
 * sessions predating the approval gate still read correctly.
 */
export function detectCheckpoint(
  status: MigrationStatus,
  phases: MigrationPhase[],
  approvalStatus?: PlanApprovalStatus | null,
): CheckpointInfo | null {
  if (status !== 'complete') return null;
  const nextPending = phases.find(p => p.status === 'pending');
  if (!nextPending) return null;

  if (nextPending.id === 'code-generation' && approvalStatus && approvalStatus !== 'approved') {
    return APPROVAL_CHECKPOINTS[approvalStatus];
  }

  return CHECKPOINT_BY_NEXT_PHASE[nextPending.id] ?? null;
}
