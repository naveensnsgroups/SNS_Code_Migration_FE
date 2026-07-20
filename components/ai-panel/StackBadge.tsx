// Displays the detected legacy tech stack with layer analysis.
'use client';

import { Cpu, Database, Check } from 'lucide-react';
import type { DetectedStack } from '@/types';

interface LayerRowProps {
  label: string;
  value: string | undefined;
  /**
   * Target-stack value for the same layer, shown as "value → targetValue" once
   * configured. When it matches the detected value we still surface that
   * explicitly — a checkmark, not silence — so the user can see the value was
   * checked and confirmed, rather than wondering if it was never compared.
   * Layers with no direct 1:1 target field (Frontend, ORM, Cloud today) simply
   * never receive this prop, so the detected value stays the sole source of
   * truth for them rather than a fabricated mapping.
   */
  targetValue?: string;
}

function LayerRow({ label, value, targetValue }: LayerRowProps) {
  const trimmedTarget = targetValue?.trim();
  const isSame = !!trimmedTarget && trimmedTarget.toLowerCase() === (value ?? '').trim().toLowerCase();
  const isChanged = !!trimmedTarget && !isSame;

  return (
    <div className="layer-item" style={{ fontSize: '12.5px', padding: '3px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
        {value || 'Not Detected'}
        {isChanged && <span style={{ color: 'var(--text-info)', fontWeight: 600 }}> &rarr; {trimmedTarget}</span>}
        {isSame && (
          <span style={{ color: 'var(--text-success)', display: 'inline-flex', alignItems: 'center', gap: '2px' }} title="Target matches detected value — no change needed">
            {' '}<Check size={11} /> same
          </span>
        )}
      </span>
    </div>
  );
}

interface Props {
  detectedStack: DetectedStack | null;
  validFileCount?: number;
  emptyFileCount?: number;
  emptyFiles?: Array<{ path: string; reason: string }>;
  /** Current Target Configuration values, once set — used to annotate Layer Analysis. */
  targetFramework?: string;
  targetDb?: string;
  targetLang?: string;
  targetTestFramework?: string;
}

export default function StackBadge({ detectedStack, validFileCount, emptyFileCount, emptyFiles, targetFramework, targetDb, targetLang, targetTestFramework }: Props) {
  if (!detectedStack) return null;
  const displayFileCount = validFileCount ?? detectedStack.fileCount;

  return (
    <div className="ai-section">
      <div className="ai-section__title">
        <Cpu size={12} />
        <span>Detected Stack</span>
      </div>

      <div className="stack-badge-premium">
        {/* Summary pills */}
        <div className="stack-badge-grid">
          <div className="badge-pill">
            <span className="badge-pill__label">Language</span>
            <span className="badge-pill__value lang-color">{detectedStack.language}</span>
          </div>
          <div className="badge-pill">
            <span className="badge-pill__label">Framework</span>
            <span className="badge-pill__value fw-color">{detectedStack.framework}</span>
          </div>
          <div className="badge-pill">
            <span className="badge-pill__label">Database</span>
            <span className="badge-pill__value db-color">{detectedStack.database}</span>
          </div>
          <div className="badge-pill">
            <span className="badge-pill__label">Files Count</span>
            <span className="badge-pill__value files-color">{displayFileCount}</span>
            {emptyFileCount ? <span style={{ fontSize: '10px', color: 'var(--text-warning)', marginTop: '2px' }}>({emptyFileCount} empty excluded)</span> : null}
          </div>
        </div>

        {/* Layer Analysis */}
        <div className="architectural-layers" style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.5px' }}>
            <Database size={10} style={{ color: 'var(--accent-blue)' }} />
            <span>Layer Analysis</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <LayerRow label="Frontend (Client)"      value={detectedStack.frontend} />
            <LayerRow label="API / Bridge Layer"     value={detectedStack.apiLayer} targetValue={targetFramework} />
            <LayerRow label="Backend (Server)"       value={detectedStack.backend} targetValue={targetLang} />
            <LayerRow label="Database (Storage)"     value={detectedStack.database} targetValue={targetDb} />
            <LayerRow label="ORM / Data Layer"       value={detectedStack.databaseLayer} />
            <LayerRow label="Cloud / Infrastructure" value={detectedStack.cloudInfrastructure} />
            <LayerRow label="Testing Framework"      value={undefined} targetValue={targetTestFramework} />
          </div>
        </div>

        {/* Validation Report */}
        {(validFileCount !== undefined || emptyFileCount) && (
          <div className="validation-report" style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              Validation Report
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Valid Source Files</span>
                <span style={{ fontWeight: 600, color: 'var(--text-success)' }}>{validFileCount ?? detectedStack.fileCount}</span>
              </div>
              {emptyFileCount ? (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Empty Files Excluded</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-warning)' }}>{emptyFileCount}</span>
                </div>
              ) : null}
              {emptyFiles && emptyFiles.length > 0 && (
                <details style={{ marginTop: '4px', cursor: 'pointer' }}>
                  <summary style={{ color: 'var(--text-info)', fontSize: '11px', fontWeight: 500 }}>
                    View excluded files ({emptyFiles.length})
                  </summary>
                  <div style={{ marginTop: '6px', paddingLeft: '12px', borderLeft: '2px solid var(--border-subtle)' }}>
                    {emptyFiles.map((f, idx) => (
                      <div key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', wordBreak: 'break-all' }}>
                        <span style={{ color: 'var(--text-warning)', fontWeight: 500 }}>{f.reason}:</span> {f.path}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
