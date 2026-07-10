// HITL checkpoint — shown after Graph Resolution (status 'awaiting-graph-review').
// Lets the user review the real resolved-graph counters, then either continue to
// the analysis report or skip straight to code migration.
'use client';

import { useState } from 'react';
import { GitBranch, FileText, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import type { GraphResolutionSummary } from '@/types';

interface Props {
  summary: GraphResolutionSummary | null;
  isBusy: boolean;               // a continue/skip request is in flight
  onContinue: () => void;
  onSkip: () => void;
}

// Humanize a counter key generically (no hardcoded per-key table):
// "TOTAL_API_ENDPOINTS" → "Api Endpoints". Fully derived from the key.
function humanizeCounter(key: string): string {
  return key
    .replace(/^TOTAL_/, '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function GraphReviewCheckpoint({ summary, isBusy, onContinue, onSkip }: Props) {
  // Skip forfeits the written report irreversibly — require a second confirm click.
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  const counters = summary ? Object.entries(summary.counters) : [];
  const graphsEmpty = summary?.primaryGraphsEmpty ?? false;

  return (
    <div className="ai-section">
      <div className="ai-section__title">
        <GitBranch size={12} />
        <span>Graph Review</span>
        {/* Distinct violet pill — matches the Live panel's "Awaiting Review" treatment,
            signaling this needs a decision from you rather than being another status line. */}
        <span style={{
          fontSize: '9px', fontWeight: 700, color: '#ffffff',
          background: 'var(--accent-purple)', border: '1px solid var(--accent-purple)',
          borderRadius: '3px', padding: '1px 6px', letterSpacing: '0.4px',
          textTransform: 'uppercase', marginLeft: '2px',
        }}>
          Action Needed
        </span>
      </div>

      <p style={{ fontSize: '12.5px', lineHeight: '1.5', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
        Graph resolution is complete. Review what was extracted, then continue to the
        analysis report or skip straight to code migration.
      </p>

      {graphsEmpty && (
        // Neutral card + colored left-border/icon/text, not a same-hue wash — see
        // ActionButtons.tsx's migrationDisabledReason banner for the same fix.
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '6px',
          fontSize: '12px', color: 'var(--text-warning)',
          background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--text-warning)',
          borderRadius: '0 4px 4px 0', padding: '6px 10px', marginBottom: '8px',
        }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            The primary graphs (symbol / entity / api) are empty — there is no real
            content to report or migrate. Re-run Stage 1 analysis instead.
          </span>
        </div>
      )}

      {/* Counter table — real numbers from graph resolution */}
      {counters.length > 0 ? (
        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px' }}>
          {counters.map(([key, value]) => (
            <div
              key={key}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '12.5px', padding: '6px 10px', borderRadius: '4px',
                background: 'var(--bg-tertiary)',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{humanizeCounter(key)}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px',
                color: value > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          No counters were recorded for this run.
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          className="btn-premium btn-premium--primary"
          onClick={onContinue}
          disabled={isBusy || graphsEmpty}
          style={{ opacity: isBusy || graphsEmpty ? 0.45 : 1 }}
          title={graphsEmpty ? 'Graphs are empty — re-run Stage 1 analysis' : 'Write the full analysis report'}
        >
          {isBusy ? <Loader2 size={13} className="spin" /> : <FileText size={13} />}
          <span>Continue to Analysis Report</span>
        </button>

        {!confirmingSkip ? (
          <button
            className="btn-premium btn-premium--secondary"
            onClick={() => setConfirmingSkip(true)}
            disabled={isBusy || graphsEmpty}
            style={{ opacity: isBusy || graphsEmpty ? 0.45 : 1 }}
            title={graphsEmpty ? 'Graphs are empty — re-run Stage 1 analysis' : 'Skip the report and go straight to code migration'}
          >
            <ArrowRight size={13} />
            <span>Skip to Code Migration</span>
          </button>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '6px',
            border: '1px solid rgba(204,167,0,0.25)', borderRadius: '4px', padding: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', color: 'var(--text-warning)' }}>
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>Skipping forfeits the written analysis report — it cannot be generated later for this session. Continue?</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn-premium btn-premium--danger"
                onClick={onSkip}
                disabled={isBusy}
                style={{ flex: 1, opacity: isBusy ? 0.45 : 1 }}
              >
                {isBusy ? <Loader2 size={13} className="spin" /> : <ArrowRight size={13} />}
                <span>Yes, skip</span>
              </button>
              <button
                className="btn-premium btn-premium--secondary"
                onClick={() => setConfirmingSkip(false)}
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
