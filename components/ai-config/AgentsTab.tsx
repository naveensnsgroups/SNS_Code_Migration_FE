// Agent list (sidebar) + scrollable detail panel. LLM binding shows the backend
// alias identifier (alias:fast-model), not a raw model name.
'use client';

import { Settings, Layers, Terminal, Cpu, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';

interface AgentConfig {
  id: string;
  name: string;
  enabled: boolean;
  hasChat: boolean;
  systemTemplate: string;
  selectedModel: string;         // The backend alias: e.g. "alias:fast-model"
  description: string;
  variables: { name: string; desc: string }[];
  functions: string[];
  tags?: string[];
}

interface Props {
  agents: AgentConfig[];
  selectedAgentId: string;
  modelOptions: string[];
  onSelectAgent:  (id: string) => void;
  onToggleAgent:  (id: string) => void;
  onUpdateModel:  (id: string, model: string) => void;
}

// ── Section Block ──────────────────────────────────────────────────────────────

function SectionBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '16px' }}>
      <div className="ai-section__title" style={{ marginBottom: '10px' }}>
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AgentsTab({ agents, selectedAgentId, modelOptions, onSelectAgent, onToggleAgent, onUpdateModel }: Props) {
  const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0];
  if (!selectedAgent) return <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: '12px' }}>No agents loaded.</div>;

  return (
    <div className="config-agents-grid">
      {/* ── Left Sidebar — Agent List ──────────────────────────────────────── */}
      <div className="config-agents-list-pane">
        <ul className="config-agents-ul">
          {agents.map(agent => (
            <li
              key={agent.id}
              className={`config-agent-li ${selectedAgentId === agent.id ? 'selected' : ''}`}
              onClick={() => onSelectAgent(agent.id)}
              title={agent.name}
            >
              <span className={`agent-bullet ${agent.enabled ? 'enabled' : ''}`} />
              <span className="agent-list-name">{agent.name}</span>
              {agent.hasChat && <span className="agent-chat-badge">Chat</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Right — Scrollable Detail Pane ────────────────────────────────── */}
      <div className="config-agent-details-pane" style={{ overflowY: 'auto', height: '100%' }}>

        {/* Header: name + ID + enable toggle */}
        <div className="agent-details-header">
          <div>
            <h3 className="agent-details-title">{selectedAgent.name}</h3>
            <div className="agent-details-id" style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Id: {selectedAgent.id}
            </div>
          </div>
          <div className="agent-toggles-container">
            <div className="agent-detail-toggle-block" onClick={() => onToggleAgent(selectedAgent.id)}>
              <span>Enable Agent</span>
              {selectedAgent.enabled
                ? <ToggleRight className="toggle-switch-icon text-success" size={24} />
                : <ToggleLeft  className="toggle-switch-icon text-muted"   size={24} />}
            </div>
          </div>
        </div>

        {/* Description */}
        {selectedAgent.description && (
          <p className="agent-details-description">{selectedAgent.description}</p>
        )}

        {/* Tags */}
        {selectedAgent.tags && selectedAgent.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {selectedAgent.tags.map(tag => (
              <span key={tag} style={{
                fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                background: 'rgba(0,122,204,0.15)', color: 'var(--text-info)',
                border: '1px solid rgba(0,122,204,0.3)', fontFamily: 'var(--font-mono)'
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* ── Prompt Template ────────────────────────────────────────────── */}
        <SectionBlock icon={<Settings size={12} />} title="Prompt Templates">
          <div className="form-group" style={{ maxWidth: '420px' }}>
            <label className="form-label">System Prompt Variant</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="form-select-premium"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', flex: 1 }}
                value={selectedAgent.systemTemplate}
                readOnly
                disabled={!selectedAgent.enabled}
                title="Prompt variant ID — configure in Prompt Fragments tab"
              />
              <button
                className="btn-premium btn-premium--secondary"
                style={{ padding: '4px 10px', fontSize: '11px', whiteSpace: 'nowrap', width: 'auto' }}
                title="Edit in Prompt Fragments tab"
              >
                <ExternalLink size={11} />
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Edit prompt content in the <strong>Prompt Fragments</strong> tab
            </div>
          </div>
        </SectionBlock>

        {/* ── LLM Binding ───────────────────────────────────────────────── */}
        <SectionBlock icon={<Cpu size={12} />} title="LLM Requirements">
          <div className="form-group" style={{ maxWidth: '420px' }}>
            <label className="form-label">Language Model Binding</label>
            <div style={{
              background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
              borderRadius: '4px', padding: '8px 10px', marginBottom: '6px'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Backend alias (from agent-definitions.ts):</div>
              <code style={{ fontSize: '12px', color: 'var(--text-info)', fontFamily: 'var(--font-mono)' }}>
                {selectedAgent.selectedModel || 'Not set'}
              </code>
            </div>
            <label className="form-label" style={{ marginTop: '6px' }}>Override Model (optional)</label>
            <select
              className="form-select-premium"
              defaultValue=""
              onChange={e => { if (e.target.value) onUpdateModel(selectedAgent.id, e.target.value); }}
              disabled={!selectedAgent.enabled}
            >
              <option value="">— Use alias default —</option>
              {modelOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Alias → model mapping configured in <strong>Model Aliases</strong> tab
            </div>
          </div>
        </SectionBlock>

        {/* ── Used Global Variables ──────────────────────────────────────── */}
        {selectedAgent.variables.length > 0 && (
          <SectionBlock icon={<Layers size={12} />} title="Used Global Variables">
            <table className="ai-config-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Variable</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {selectedAgent.variables.map((v, i) => (
                  <tr key={i}>
                    <td className="table-bold-cell" style={{ fontFamily: 'var(--font-mono)' }}>{v.name}</td>
                    <td className="table-muted-cell">{v.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionBlock>
        )}

        {/* ── Functions / Tools ─────────────────────────────────────────── */}
        {selectedAgent.functions.length > 0 && (
          <SectionBlock icon={<Terminal size={12} />} title={`Functions / Tools (${selectedAgent.functions.length})`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              {selectedAgent.functions.map((fn, i) => (
                <span key={i} style={{
                  fontSize: '11px', padding: '3px 8px', borderRadius: '4px',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                  fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                }}>
                  {fn}
                </span>
              ))}
            </div>
          </SectionBlock>
        )}

        {/* ── Agent Tags ─────────────────────────────────────────────────── */}
        {selectedAgent.functions.length === 0 && selectedAgent.variables.length === 0 && (
          <div style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
            No variables or functions configured for this agent.
          </div>
        )}

        {/* Spacer at bottom so last section doesn't clip */}
        <div style={{ height: '40px' }} />
      </div>
    </div>
  );
}
