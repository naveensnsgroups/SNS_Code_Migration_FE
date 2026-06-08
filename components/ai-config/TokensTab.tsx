// =============================================================================
//  components/ai-config/TokensTab.tsx
//  Token Usage tab — per-agent breakdown + session total + cost estimate.
// =============================================================================
'use client';

import { Coins, TrendingUp } from 'lucide-react';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  model?: string;
}

// Per-agent usage from localStorage (written by migration events)
interface AgentUsage {
  agentId: string;
  agentName: string;
  inputTokens: number;
  outputTokens: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function readAgentUsage(): AgentUsage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('session_token_usage');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function UsageBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
    </div>
  );
}

interface Props {
  tokenUsage?: TokenUsage;
}

export default function TokensTab({ tokenUsage }: Props) {
  const agentUsages = readAgentUsage();
  const hasData = tokenUsage && tokenUsage.totalTokens > 0;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Coins size={14} style={{ color: 'var(--accent-yellow)' }} />
        <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Token Usage</h3>
      </div>

      {!hasData ? (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
          <TrendingUp size={28} style={{ opacity: 0.3, marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
          No token data yet. Start a migration to track usage.
        </div>
      ) : (
        <>
          {/* Session Total */}
          <div style={{ background: 'linear-gradient(135deg, rgba(0,122,204,0.12), rgba(30,30,30,0.4))', border: '1px solid rgba(0,122,204,0.25)', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '10px' }}>
              Session Total
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Input',  value: formatTokens(tokenUsage.inputTokens),  color: 'var(--text-info)' },
                { label: 'Output', value: formatTokens(tokenUsage.outputTokens), color: 'var(--accent-purple)' },
                { label: 'Total',  value: formatTokens(tokenUsage.totalTokens),  color: 'var(--accent-green)' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: item.color }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Est. Cost</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-yellow)', fontFamily: 'var(--font-mono)' }}>
                ${tokenUsage.estimatedCost.toFixed(4)}
              </span>
            </div>
            {tokenUsage.model && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                Model: {tokenUsage.model}
              </div>
            )}
          </div>

          {/* Per-Agent Breakdown */}
          {agentUsages.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '8px' }}>
                Per-Agent Breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {agentUsages.map(au => {
                  const total = au.inputTokens + au.outputTokens;
                  const sessionMax = agentUsages.reduce((m, a) => Math.max(m, a.inputTokens + a.outputTokens), 0);
                  return (
                    <div key={au.agentId} style={{ background: 'rgba(30,30,30,0.3)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>{au.agentName}</span>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-info)' }}>{formatTokens(total)}</span>
                      </div>
                      <UsageBar value={total} max={sessionMax} />
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '12px' }}>
                        <span>In: {formatTokens(au.inputTokens)}</span>
                        <span>Out: {formatTokens(au.outputTokens)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
