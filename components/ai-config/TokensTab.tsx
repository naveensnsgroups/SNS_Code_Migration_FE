'use client';

import { useEffect, useState, useCallback } from 'react';
import { Edit3, Check, X } from 'lucide-react';
import { fetchSessionTokens, updateModelPricing } from '@/services/api';
import type { TokenUsage } from '@/hooks/useMigration';

interface ModelPricingRate {
  inputPerM: number;
  outputPerM: number;
  cacheWritePerM?: number;
  cacheReadPerM?: number;
}
type ModelPricingConfig = Record<string, ModelPricingRate>;

const PRICING_STORAGE_KEY = 'ai_config_model_pricing';

function readModelPricing(): ModelPricingConfig {
  try { return JSON.parse(localStorage.getItem(PRICING_STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveModelPricing(config: ModelPricingConfig): void {
  localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(config));
}

// TokenUsage.estimatedCost can be null — see hooks/useMigration.ts for why.

interface ModelBreakdown {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  readCachedInputTokens?: number;
  totalTokens: number;
  lastUsed?: string;
  /** null = no pricing rate configured for this exact model. */
  estimatedCost: number | null;
}

function formatCost(cost: number | null): string {
  if (cost === null) return '—';
  if (cost === 0) return '$0.0000';
  return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(4)}`;
}

interface Props {
  tokenUsage?: TokenUsage;
  sessionId?: string | null;
  backendUrl: string;
}

// Helper to format timestamps exactly like formatDistanceToNow in SNS IDE
function formatDistanceToNow(dateInput: string | number | Date | undefined): string {
  if (!dateInput) return 'Never';
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return 'less than a minute ago';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// The only place a pricing rate can be entered — unset models show "—" everywhere else.
function RateEditorCell({
  modelId,
  cost,
  onSaved,
}: {
  modelId: string;
  cost: number | null;
  onSaved: (modelId: string, rate: ModelPricingRate) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputPerM, setInputPerM] = useState('');
  const [outputPerM, setOutputPerM] = useState('');

  const startEdit = () => {
    const existing = readModelPricing()[modelId];
    setInputPerM(existing ? String(existing.inputPerM) : '');
    setOutputPerM(existing ? String(existing.outputPerM) : '');
    setEditing(true);
  };

  const save = () => {
    const inVal  = parseFloat(inputPerM);
    const outVal = parseFloat(outputPerM);
    if (!Number.isFinite(inVal) || !Number.isFinite(outVal) || inVal < 0 || outVal < 0) return;
    const rate: ModelPricingRate = { inputPerM: inVal, outputPerM: outVal };
    const config = readModelPricing();
    config[modelId] = rate;
    saveModelPricing(config);
    onSaved(modelId, rate);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <input
          type="number" step="0.01" min="0" placeholder="in $/M"
          value={inputPerM} onChange={e => setInputPerM(e.target.value)}
          style={{ width: '56px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-primary)', padding: '2px 4px' }}
        />
        <input
          type="number" step="0.01" min="0" placeholder="out $/M"
          value={outputPerM} onChange={e => setOutputPerM(e.target.value)}
          style={{ width: '56px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-primary)', padding: '2px 4px' }}
        />
        <button onClick={save} style={{ background: 'none', border: 'none', color: 'var(--text-success)', cursor: 'pointer', padding: 0 }} title="Save rate">
          <Check size={13} />
        </button>
        <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-error)', cursor: 'pointer', padding: 0 }} title="Cancel">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>
        {formatCost(cost)}
      </span>
      <button
        onClick={startEdit}
        title={`Set $/1M rate for ${modelId}`}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
      >
        <Edit3 size={11} />
      </button>
    </div>
  );
}

export default function TokensTab({
  tokenUsage,
  sessionId,
  backendUrl,
}: Props) {
  const [modelBreakdown, setModelBreakdown] = useState<ModelBreakdown[]>([]);

  // Fetch persisted data + model breakdown from backend
  const fetchFromBackend = useCallback(() => {
    if (!sessionId) return;
    fetchSessionTokens(backendUrl, sessionId)
      .then(data => {
        if (data.modelBreakdown && data.modelBreakdown.length > 0) {
          // Sort models alphabetically to match SNS IDE
          const sorted = [...data.modelBreakdown].sort((a, b) => a.modelId.localeCompare(b.modelId));
          setModelBreakdown(sorted);
        }
      })
      .catch(() => { /* non-critical */ });
  }, [sessionId, backendUrl]);

  useEffect(() => {
    fetchFromBackend();
  }, [fetchFromBackend]);

  // Pushes the rate to the backend so cost recomputes retroactively, not just on the next run.
  const handleRateSaved = useCallback((modelId: string, rate: ModelPricingRate) => {
    if (!sessionId) return;
    updateModelPricing(backendUrl, sessionId, { [modelId]: rate })
      .then(fetchFromBackend)
      .catch(() => { /* the rate is still saved locally for the next run */ });
  }, [sessionId, backendUrl, fetchFromBackend]);

  // Depend on the primitive totalTokens, not the tokenUsage object — the parent creates a new
  // object every render, so using it directly would trigger this on every render.
  useEffect(() => {
    if (tokenUsage && tokenUsage.totalTokens > 0) {
      fetchFromBackend();
    }
  }, [tokenUsage?.totalTokens, fetchFromBackend]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasData = modelBreakdown.length > 0;

  if (!hasData) {
    return (
      <div style={{
        padding: '24px',
        color: 'var(--text-secondary)',
        fontSize: '13px',
        textAlign: 'center',
        background: 'var(--bg-primary)',
        height: '100%',
      }}>
        No token usage data available yet.
      </div>
    );
  }

  const hasCacheData = modelBreakdown.some(
    m => m.cachedInputTokens !== undefined || m.readCachedInputTokens !== undefined
  );

  const totalInput = modelBreakdown.reduce((sum, m) => sum + m.inputTokens, 0);
  const totalOutput = modelBreakdown.reduce((sum, m) => sum + m.outputTokens, 0);
  const totalCachedInput = modelBreakdown.reduce((sum, m) => sum + (m.cachedInputTokens ?? 0), 0);
  const totalReadCachedInput = modelBreakdown.reduce((sum, m) => sum + (m.readCachedInputTokens ?? 0), 0);
  const totalTokens = totalInput + totalOutput + totalCachedInput;
  // Unpriced models are skipped, never treated as $0 — null total means everything is unpriced.
  const pricedModels = modelBreakdown.filter(m => m.estimatedCost !== null);
  const totalCost = pricedModels.length > 0
    ? pricedModels.reduce((sum, m) => sum + (m.estimatedCost ?? 0), 0)
    : null;
  const anyCostIncomplete = totalCost !== null && pricedModels.length < modelBreakdown.length;

  return (
    <div style={{
      padding: '16px',
      overflow: 'auto',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'var(--bg-primary)',
          fontSize: '13px',
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                width: hasCacheData ? '22%' : '25%',
              }}>
                Model
              </th>
              <th style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                width: hasCacheData ? '13%' : '18.75%',
              }}>
                Input Tokens
              </th>
              {hasCacheData && (
                <>
                  <th style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    width: '13%',
                  }} title="Tracked additionally to 'Input Tokens'. Usually more expensive than non-cached tokens.">
                    Input Tokens Written to Cache
                  </th>
                  <th style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    width: '13%',
                  }} title="Tracked additionally to 'Input Token'. Usually much less expensive than not cached. Usually does not count to rate limits.">
                    Input Tokens Read From Cache
                  </th>
                </>
              )}
              <th style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                width: hasCacheData ? '13%' : '18.75%',
              }}>
                Output Tokens
              </th>
              <th style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                width: hasCacheData ? '11%' : '15%',
              }} title="'Input Tokens' + 'Output Tokens'">
                Total Tokens
              </th>
              <th style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                width: hasCacheData ? '11%' : '15%',
              }} title="Estimated cost using the $/1M-token rate you configured for this model in Settings. Shows '—' if no rate is configured — never a guessed number.">
                Cost
              </th>
              <th style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                width: hasCacheData ? '11%' : '15%',
              }}>
                Last Used
              </th>
            </tr>
          </thead>
          <tbody>
            {modelBreakdown.map(item => {
              const itemTotal = item.inputTokens + item.outputTokens + (item.cachedInputTokens ?? 0);
              return (
                <tr
                  key={item.modelId}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color 0.2s',
                  }}
                  className="token-usage-row-hover"
                >
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', verticalAlign: 'top', fontWeight: 500 }}>
                    {item.modelId}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                    {item.inputTokens.toLocaleString()}
                  </td>
                  {hasCacheData && (
                    <>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', verticalAlign: 'top' }} title="Tracked additionally to 'Input Tokens'. Usually more expensive than non-cached tokens.">
                        {item.cachedInputTokens !== undefined ? item.cachedInputTokens.toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', verticalAlign: 'top' }} title="Tracked additionally to 'Input Token'. Usually much less expensive than not cached. Usually does not count to rate limits.">
                        {item.readCachedInputTokens !== undefined ? item.readCachedInputTokens.toLocaleString() : '-'}
                      </td>
                    </>
                  )}
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                    {item.outputTokens.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', verticalAlign: 'top' }} title="'Input Tokens' + 'Output Tokens'">
                    {itemTotal.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                    <RateEditorCell modelId={item.modelId} cost={item.estimatedCost} onSaved={handleRateSaved} />
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                    {formatDistanceToNow(item.lastUsed)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{
              fontWeight: 600,
              borderTop: '2px solid var(--border-color)',
              borderBottom: 'none',
              backgroundColor: 'var(--bg-primary)',
            }}>
              <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>Total</td>
              <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{totalInput.toLocaleString()}</td>
              {hasCacheData && (
                <>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{totalCachedInput.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{totalReadCachedInput.toLocaleString()}</td>
                </>
              )}
              <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{totalOutput.toLocaleString()}</td>
              <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{totalTokens.toLocaleString()}</td>
              <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                {totalCost === null ? '—' : formatCost(totalCost)}
                {totalCost !== null && anyCostIncomplete ? '*' : ''}
              </td>
              <td style={{ padding: '10px 12px' }}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '3px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-color)',
      }}>
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="currentColor"
          style={{ flexShrink: 0, color: 'var(--text-secondary)' }}
        >
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM7.5 7.5a.5.5 0 0 1 1 0v4a.5.5 0 0 1-1 0v-4zm.5-2a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
        </svg>
        <span>
          Token usage is tracked per session and persisted on the backend — it survives a page reload.
          {anyCostIncomplete ? ' * = partial cost: at least one model used has no configured pricing rate.' : ''}
          {' '}Configure per-model $/1M rates in Settings to see cost — nothing is estimated without one.
        </span>
      </div>

      <style>{`
        .token-usage-row-hover:hover {
          background-color: var(--bg-secondary) !important;
        }
      `}</style>
    </div>
  );
}
