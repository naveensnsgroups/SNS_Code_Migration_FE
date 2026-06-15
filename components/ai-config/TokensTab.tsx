// =============================================================================
//  components/ai-config/TokensTab.tsx
//
//  Token Usage tab — exact replica of the SNS IDE AITokenUsageConfigurationWidget.
// =============================================================================
'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchSessionTokens } from '@/services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  readCachedInputTokens?: number;
  totalTokens: number;
  estimatedCost: number;
  model?: string;
  updatedAt?: number;
}

interface ModelBreakdown {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  readCachedInputTokens?: number;
  totalTokens: number;
  lastUsed?: string;
}

interface Props {
  tokenUsage?: TokenUsage;
  isRunning?: boolean;
  sessionId?: string | null;
  backendUrl?: string;
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

export default function TokensTab({
  tokenUsage,
  sessionId,
  backendUrl = 'http://localhost:4000',
}: Props) {
  const [modelBreakdown, setModelBreakdown] = useState<ModelBreakdown[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch persisted data + model breakdown from backend
  const fetchFromBackend = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    fetchSessionTokens(backendUrl, sessionId)
      .then(data => {
        if (data.modelBreakdown && data.modelBreakdown.length > 0) {
          // Sort models alphabetically to match SNS IDE
          const sorted = [...data.modelBreakdown].sort((a, b) => a.modelId.localeCompare(b.modelId));
          setModelBreakdown(sorted);
        }
      })
      .catch(() => { /* non-critical */ })
      .finally(() => setLoading(false));
  }, [sessionId, backendUrl]);

  useEffect(() => {
    fetchFromBackend();
  }, [fetchFromBackend]);

  // When live SSE tokenUsage updates, fetch fresh breakdown in real-time.
  // Depend on the primitive totalTokens value — NOT the tokenUsage object itself.
  // The parent creates a new tokenUsage object every render; using it as a dep
  // would trigger this effect on every render, causing an infinite update loop.
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
        color: 'var(--text-muted)',
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

  // Calculate totals
  const totalInput = modelBreakdown.reduce((sum, m) => sum + m.inputTokens, 0);
  const totalOutput = modelBreakdown.reduce((sum, m) => sum + m.outputTokens, 0);
  const totalCachedInput = modelBreakdown.reduce((sum, m) => sum + (m.cachedInputTokens ?? 0), 0);
  const totalReadCachedInput = modelBreakdown.reduce((sum, m) => sum + (m.readCachedInputTokens ?? 0), 0);
  const totalTokens = totalInput + totalOutput + totalCachedInput;

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
                width: hasCacheData ? '13%' : '18.75%',
              }} title="'Input Tokens' + 'Output Tokens'">
                Total Tokens
              </th>
              <th style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                width: hasCacheData ? '13%' : '18.75%',
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
        color: 'var(--text-muted)',
        border: '1px solid var(--border-color)',
      }}>
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="currentColor"
          style={{ flexShrink: 0, color: 'var(--text-muted)' }}
        >
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM7.5 7.5a.5.5 0 0 1 1 0v4a.5.5 0 0 1-1 0v-4zm.5-2a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
        </svg>
        <span>Token usage is tracked since the start of the application and is not persisted.</span>
      </div>

      <style>{`
        .token-usage-row-hover:hover {
          background-color: var(--bg-secondary) !important;
        }
      `}</style>
    </div>
  );
}
