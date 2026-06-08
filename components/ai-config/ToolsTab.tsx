// =============================================================================
//  components/ai-config/ToolsTab.tsx
//  AIConfig sub-tab: Tool enable/disable toggles (persisted to localStorage)
//
//  NO hardcoded tool list — tools are passed as props fetched from
//  GET /api/config/tools (backend ToolInvocationRegistry).
// =============================================================================
'use client';

import { ToggleLeft, ToggleRight } from 'lucide-react';
import type { ToolDto } from '@/services/api';

interface Props {
  tools: ToolDto[];
  toolsEnabled: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export default function ToolsTab({ tools, toolsEnabled, onToggle }: Props) {
  const isEnabled = (id: string) => toolsEnabled[id] !== false;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600 }}>AI Agent System Tools</h3>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tools.length} tools registered</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Enable or disable specific system tools. Changes are saved immediately and applied on the next migration run.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tools.map(tool => {
          const enabled = isEnabled(tool.id);
          return (
            <div key={tool.id} style={{
              background: 'rgba(30,30,30,0.3)',
              border: `1px solid ${enabled ? 'rgba(78,201,176,0.2)' : 'var(--border-color)'}`,
              borderRadius: '6px', padding: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '12px', fontFamily: 'var(--font-mono)', color: enabled ? 'var(--text-info)' : 'var(--text-muted)' }}>
                  {tool.name || tool.id}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {tool.description}
                </div>
              </div>
              <div
                className="agent-detail-toggle-block"
                style={{ cursor: 'pointer', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => onToggle(tool.id)}
              >
                <span style={{ fontSize: '11px', color: enabled ? 'var(--text-success)' : 'var(--text-muted)' }}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
                {enabled
                  ? <ToggleRight className="toggle-switch-icon text-success" size={20} />
                  : <ToggleLeft  className="toggle-switch-icon text-muted"   size={20} />}
              </div>
            </div>
          );
        })}

        {tools.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px' }}>
            No tools registered. Check backend is running at the configured URL.
          </div>
        )}
      </div>
    </div>
  );
}
