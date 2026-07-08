// Displays the detected legacy tech stack with layer analysis.
'use client';

import { Cpu, Database } from 'lucide-react';
import type { DetectedStack } from '@/types';

interface LayerRowProps {
  label: string;
  value: string | undefined;
}

function LayerRow({ label, value }: LayerRowProps) {
  return (
    <div className="layer-item" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value || 'Not Detected'}</span>
    </div>
  );
}

interface Props {
  detectedStack: DetectedStack | null;
}

export default function StackBadge({ detectedStack }: Props) {
  if (!detectedStack) return null;

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
            <span className="badge-pill__value files-color">{detectedStack.fileCount}</span>
          </div>
        </div>

        {/* Layer Analysis */}
        <div className="architectural-layers" style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.5px' }}>
            <Database size={10} style={{ color: 'var(--accent-blue)' }} />
            <span>Layer Analysis</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <LayerRow label="Frontend (Client)"      value={detectedStack.frontend} />
            <LayerRow label="API / Bridge Layer"     value={detectedStack.apiLayer} />
            <LayerRow label="Backend (Server)"       value={detectedStack.backend} />
            <LayerRow label="Database (Storage)"     value={detectedStack.database} />
            <LayerRow label="ORM / Data Layer"       value={detectedStack.databaseLayer} />
            <LayerRow label="Cloud / Infrastructure" value={detectedStack.cloudInfrastructure} />
          </div>
        </div>
      </div>
    </div>
  );
}
