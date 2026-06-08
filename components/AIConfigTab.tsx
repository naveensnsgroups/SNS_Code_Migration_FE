'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Settings, 
  Layers, 
  Coins, 
  HelpCircle, 
  Terminal, 
  Compass, 
  Play, 
  Lock, 
  ToggleLeft,
  ToggleRight,
  Database,
  Link,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Bot,
  Bookmark,
  Wrench,
  Award
} from 'lucide-react';

interface AgentConfig {
  id: string;
  name: string;
  enabled: boolean;
  hasChat: boolean;
  systemTemplate: string;
  selectedModel: string;
  description: string;
  variables: { name: string; desc: string }[];
  functions: string[];
}

const INITIAL_AGENTS: AgentConfig[] = [
  {
    id: 'scanner-agent',
    name: 'Codebase Scanner Agent',
    enabled: true,
    hasChat: false,
    systemTemplate: 'scanner-agent-system-default',
    selectedModel: 'google/gemini-3-flash-preview',
    description: 'Scans raw codebase paths, parses imports and lockfiles to detect languages, database models, and frameworks.',
    variables: [
      { name: 'prompt:project-info', desc: 'Metadata describing scanned workspace paths.' },
      { name: 'contextDetails', desc: 'Provides full text values and descriptions for context elements.' }
    ],
    functions: ['scanProjectDirectory', 'detectStack']
  },
  {
    id: 'planner-agent',
    name: 'Migration Planner Agent',
    enabled: true,
    hasChat: true,
    systemTemplate: 'planner-agent-system-default',
    selectedModel: 'anthropic/claude-sonnet-4-6',
    description: 'Generates structured architectural mapping strategies and step-by-step migration paths (migration-plan.md).',
    variables: [
      { name: 'prompt:project-info', desc: 'Metadata describing scanned workspace paths.' },
      { name: 'contextDetails', desc: 'Provides full text values and descriptions for context elements.' }
    ],
    functions: ['getFileContent', 'writeSessionFile']
  },
  {
    id: 'pseudocode-agent',
    name: 'Pseudocode Strategist Agent',
    enabled: true,
    hasChat: false,
    systemTemplate: 'pseudocode-agent-system-default',
    selectedModel: 'openai/gpt-4o-mini',
    description: 'Processes the file structure and builds high-level refactoring pseudocode blocks (pseudocode.json).',
    variables: [
      { name: 'prompt:project-info', desc: 'Metadata describing scanned workspace paths.' },
      { name: 'contextDetails', desc: 'Provides full text values and descriptions for context elements.' }
    ],
    functions: ['getFileContent', 'writeSessionFile']
  },
  {
    id: 'writer-agent',
    name: 'Code Writer Agent',
    enabled: true,
    hasChat: true,
    systemTemplate: 'writer-agent-system-default',
    selectedModel: 'anthropic/claude-sonnet-4-6',
    description: 'Performs file-by-file legacy code rewrites using contextual prompts to ensure logic preservation.',
    variables: [
      { name: 'prompt:project-info', desc: 'Metadata describing scanned workspace paths.' },
      { name: 'contextDetails', desc: 'Provides full text values and descriptions for context elements.' }
    ],
    functions: ['readSessionFile', 'writeSessionFile']
  },
  {
    id: 'validator-agent',
    name: 'Code Validator Agent',
    enabled: true,
    hasChat: true,
    systemTemplate: 'validator-agent-system-default',
    selectedModel: 'openai/gpt-4o',
    description: 'Parses command-line output logs from tests/builds and updates code recursively to fix type-errors and bugs.',
    variables: [
      { name: 'prompt:mcp_chrome-devtools_tools', desc: 'Chrome developer execution context variables.' },
      { name: 'contextDetails', desc: 'Provides full text values and descriptions for context elements.' }
    ],
    functions: ['readSessionFile', 'writeSessionFile', 'executeCommand']
  }
];

interface Props {
  onClose?: () => void;
  onSettingsSaved?: () => void;
  settingsTrigger?: number;
}

export default function AIConfigTab({ onClose, onSettingsSaved, settingsTrigger }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'agents' | 'variables' | 'mcp' | 'tokens' | 'fragments' | 'tools' | 'skills' | 'aliases'>('agents');
  const [agents, setAgents] = useState<AgentConfig[]>(INITIAL_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('writer-agent');
  const [modelOptions, setModelOptions] = useState<string[]>([]);

  // Load agents from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ai_config_agents');
    if (saved) {
      try {
        setAgents(JSON.parse(saved));
      } catch {}
    }
  }, [settingsTrigger]);

  const saveAgents = (newAgents: AgentConfig[]) => {
    setAgents(newAgents);
    localStorage.setItem('ai_config_agents', JSON.stringify(newAgents));
    if (onSettingsSaved) onSettingsSaved();
  };

  // Load configured models from localStorage settings if available
  useEffect(() => {
    const defaultModels = [
      'anthropic/claude-sonnet-4-6',
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-opus-4-6',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-3.1-pro-preview',
      'google/gemini-3-flash-preview',
      'grok/grok-2',
      'grok/grok-2-mini',
      'groq/llama3-70b-8192',
      'groq/llama3-8b-8192',
      'groq/mixtral-8x7b-32768',
      'openrouter/meta-llama/llama-3-70b-instruct',
      'openrouter/deepseek/deepseek-chat',
      'openrouter/mistralai/mixtral-8x7b-instruct',
      'huggingface/meta-llama/Meta-Llama-3-70B-Instruct',
      'huggingface/mistralai/Mixtral-8x7B-Instruct-v0.1'
    ];

    const providerKeys = ['anthropic_models', 'openai_models', 'google_models', 'grok_models', 'groq_models', 'openrouter_models', 'huggingface_models'];
    const customModels: string[] = [];

    providerKeys.forEach(key => {
      const saved = localStorage.getItem(`setting_${key}`);
      if (saved) {
        try {
          const list = JSON.parse(saved);
          const providerPrefix = key.split('_')[0];
          list.forEach((m: string) => {
            customModels.push(`${providerPrefix}/${m}`);
          });
        } catch {}
      }
    });

    setModelOptions(customModels.length > 0 ? customModels : defaultModels);
  }, [settingsTrigger]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0];

  const toggleAgent = (agentId: string) => {
    const updated = agents.map(a => a.id === agentId ? { ...a, enabled: !a.enabled } : a);
    saveAgents(updated);
  };

  const updateAgentModel = (agentId: string, model: string) => {
    const updated = agents.map(a => a.id === agentId ? { ...a, selectedModel: model } : a);
    saveAgents(updated);
  };

  return (
    <div className="editor-area config-editor-page">
      {/* Tab Header bar */}
      <div className="settings-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={15} style={{ color: 'var(--accent-blue)' }} />
          <span className="settings-title">AI Configuration</span>
          {onClose && (
            <button className="settings-close" onClick={onClose} title="Close Panel">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs Navigation (Horizontal) */}
      <div className="config-sub-tabs">
        {[
          { id: 'agents', label: 'Agents', icon: <Users size={12} /> },
          { id: 'variables', label: 'Variables', icon: <Layers size={12} /> },
          { id: 'mcp', label: 'MCP Servers', icon: <Database size={12} /> },
          { id: 'tokens', label: 'Token Usage', icon: <Coins size={12} /> },
          { id: 'fragments', label: 'Prompt Fragments', icon: <Bookmark size={12} /> },
          { id: 'tools', label: 'Tools', icon: <Wrench size={12} /> },
          { id: 'skills', label: 'Skills', icon: <Award size={12} /> },
          { id: 'aliases', label: 'Model Aliases', icon: <Link size={12} /> },
        ].map(tab => (
          <button
            key={tab.id}
            className={`config-sub-tab ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id as any)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Panel Content Area */}
      <div className="config-panel-content">

        {/* ── 1. AGENTS SUB-TAB ────────────────────────────────────────────── */}
        {activeSubTab === 'agents' && (
          <div className="config-agents-grid">
            {/* Sidebar list (Left) */}
            <div className="config-agents-list-pane">
              <ul className="config-agents-ul">
                {agents.map(agent => (
                  <li
                    key={agent.id}
                    className={`config-agent-li ${selectedAgentId === agent.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <span className={`agent-bullet ${agent.enabled ? 'enabled' : ''}`} />
                    <span className="agent-list-name">{agent.name}</span>
                    {agent.hasChat && <span className="agent-chat-badge">Chat</span>}
                  </li>
                ))}
              </ul>
            </div>

            {/* Detail Pane (Right) */}
            <div className="config-agent-details-pane">
              {/* Header section with toggle switches */}
              <div className="agent-details-header">
                <div>
                  <h3 className="agent-details-title">{selectedAgent.name}</h3>
                  <div className="agent-details-id">Id: {selectedAgent.id}</div>
                </div>
                
                <div className="agent-toggles-container">
                  <div className="agent-detail-toggle-block" onClick={() => toggleAgent(selectedAgent.id)}>
                    <span>Enable Agent</span>
                    {selectedAgent.enabled ? (
                      <ToggleRight className="toggle-switch-icon text-success" size={24} />
                    ) : (
                      <ToggleLeft className="toggle-switch-icon text-muted" size={24} />
                    )}
                  </div>
                </div>
              </div>

              {selectedAgent.description && (
                <p className="agent-details-description">
                  {selectedAgent.description}
                </p>
              )}

              {/* System Prompt Template Dropdown */}
              <div className="ai-section" style={{ marginTop: '16px' }}>
                <div className="ai-section__title">
                  <Settings size={12} />
                  <span>Prompt Templates</span>
                </div>
                <div className="form-group" style={{ maxWidth: '400px', marginTop: '4px' }}>
                  <label className="form-label">System Prompt Variant</label>
                  <select 
                    className="form-select-premium" 
                    value={selectedAgent.systemTemplate}
                    onChange={() => {}}
                    disabled={!selectedAgent.enabled}
                  >
                    <option value={selectedAgent.systemTemplate}>{selectedAgent.systemTemplate}</option>
                    <option value="custom-prompt-variant">custom-override-prompt</option>
                  </select>
                </div>
              </div>

              {/* LLM Requirements */}
              <div className="ai-section" style={{ marginTop: '16px' }}>
                <div className="ai-section__title">
                  <Cpu size={12} />
                  <span>LLM Requirements</span>
                </div>
                <div className="form-group" style={{ maxWidth: '400px', marginTop: '4px' }}>
                  <label className="form-label">Language Model Binding</label>
                  <select
                    className="form-select-premium"
                    value={selectedAgent.selectedModel}
                    onChange={(e) => updateAgentModel(selectedAgent.id, e.target.value)}
                    disabled={!selectedAgent.enabled}
                  >
                    {modelOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Used Global Variables Table */}
              {selectedAgent.variables.length > 0 && (
                <div className="ai-section" style={{ marginTop: '16px' }}>
                  <div className="ai-section__title">
                    <Layers size={12} />
                    <span>Used Global Variables</span>
                  </div>
                  <table className="ai-config-table" style={{ marginTop: '6px' }}>
                    <thead>
                      <tr>
                        <th>Variable</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAgent.variables.map((v, index) => (
                        <tr key={index}>
                          <td className="table-bold-cell">{v.name}</td>
                          <td className="table-muted-cell">{v.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Used Functions list */}
              {selectedAgent.functions.length > 0 && (
                <div className="ai-section" style={{ marginTop: '16px' }}>
                  <div className="ai-section__title">
                    <Terminal size={12} />
                    <span>Used Functions / Tools</span>
                  </div>
                  <ul className="config-functions-list" style={{ marginTop: '6px' }}>
                    {selectedAgent.functions.map((fn, index) => (
                      <li key={index} className="config-function-item">
                        <span>{fn}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 2. VARIABLES SUB-TAB ────────────────────────────────────────── */}
        {activeSubTab === 'variables' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>System Variable Registries</h3>
            <table className="ai-config-table">
              <thead>
                <tr>
                  <th>Variable Name</th>
                  <th>Module Provider</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="table-bold-cell">contextDetails</td>
                  <td>core-variables</td>
                  <td className="table-muted-cell">Provides details about current selected editor tabs and folder structures.</td>
                </tr>
                <tr>
                  <td className="table-bold-cell">prompt:project-info</td>
                  <td>file-variables</td>
                  <td className="table-muted-cell">Calculates the scanned file tree statistics and maps language stacks.</td>
                </tr>
                <tr>
                  <td className="table-bold-cell">prompt:mcp_chrome-devtools_tools</td>
                  <td>mcp-service</td>
                  <td className="table-muted-cell">List of active chrome developer endpoint tools.</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── 3. MCP SERVERS SUB-TAB ───────────────────────────────────────── */}
        {activeSubTab === 'mcp' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Model Context Protocol (MCP) Registry</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { name: 'chrome-devtools', status: 'Connected', count: 4, desc: 'Enables browser inspector interactions.' },
                { name: 'filesystem-local', status: 'Connected', count: 6, desc: 'Provides safe workspace file access APIs.' },
                { name: 'git-connector', status: 'Disconnected', count: 0, desc: 'Exposes repo branch checkouts and commits.' }
              ].map(mcp => (
                <div 
                  key={mcp.name}
                  style={{
                    background: 'rgba(30,30,30,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{mcp.name}</span>
                    <span 
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '3px',
                        background: mcp.status === 'Connected' ? 'rgba(78,201,176,0.1)' : 'rgba(244,135,113,0.1)',
                        color: mcp.status === 'Connected' ? 'var(--text-success)' : 'var(--text-error)'
                      }}
                    >
                      {mcp.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{mcp.desc}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Tools Count: {mcp.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. TOKEN USAGE SUB-TAB ───────────────────────────────────────── */}
        {activeSubTab === 'tokens' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Accumulated Session Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(0,122,204,0.05)', border: '1px solid rgba(0,122,204,0.15)', borderRadius: '6px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Tokens In</div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '4px', color: 'var(--text-info)' }}>
                  124,560
                </div>
              </div>
              <div style={{ background: 'rgba(78,201,176,0.05)', border: '1px solid rgba(78,201,176,0.15)', borderRadius: '6px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Tokens Out</div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '4px', color: 'var(--text-success)' }}>
                  48,120
                </div>
              </div>
              <div style={{ background: 'rgba(204,167,0,0.05)', border: '1px solid rgba(204,167,0,0.15)', borderRadius: '6px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Session Cost</div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '4px', color: 'var(--text-warning)' }}>
                  $1.15
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '10px', background: 'rgba(30,30,30,0.3)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>Cost Optimization Tip</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                You are utilizing `claude-3-5-sonnet` as the primary Modernisation Planner. Switching files that are less complex to `gpt-4o-mini` will reduce overall input tokens costs by approximately 65%.
              </div>
            </div>
          </div>
        )}

        {/* ── 5. PROMPT FRAGMENTS SUB-TAB ─────────────────────────────────── */}
        {activeSubTab === 'fragments' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Prompt Variant Sets</h3>
              <button 
                className="btn-premium btn-premium--secondary" 
                style={{ width: 'auto', padding: '4px 10px', fontSize: '11px' }}
                onClick={() => alert('Resetting all prompt templates to default')}
              >
                Reset all prompt fragments
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { 
                  id: 'system-agent-rules', 
                  title: 'system-agent-rules.md', 
                  status: 'Active', 
                  type: 'Built-in',
                  desc: 'Base agent instructions enforcing structured JSON outputs, zero preambles, and Markdown logging formats.',
                  template: '# General System Prompt\nYou are an AI Modernisation planner agent...\nEnforce clean structures and correct types.' 
                },
                { 
                  id: 'validation-rules-strict', 
                  title: 'validation-rules-strict.md', 
                  status: 'Active', 
                  type: 'Built-in',
                  desc: 'Strict error feedback loop template enforcing typescript compiler resolutions and zod parser bounds.',
                  template: '# Strict Validation Prompt\nWhen fixing compilation errors, first write detailed explanations...\nFocus on type compatibility.' 
                },
                { 
                  id: 'scanner-stack-detect', 
                  title: 'scanner-stack-detect.md', 
                  status: 'Active', 
                  type: 'Built-in',
                  desc: 'Parser mappings for lockfiles (package-lock, cargo.lock, go.mod) and file trees.',
                  template: '# Scanner Prompt\nAnalyze imports and file extension frequencies...' 
                }
              ].map(frag => (
                <div 
                  key={frag.id}
                  style={{
                    background: 'rgba(30,30,30,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600 }}>{frag.title}</span>
                      <span style={{ fontSize: '9px', background: 'rgba(0,122,204,0.15)', color: 'var(--text-info)', padding: '1px 5px', borderRadius: '3px' }}>
                        {frag.type}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="list-item-delete-btn" style={{ padding: '4px' }} title="Reset template">✕</button>
                      <button className="list-item-delete-btn" style={{ padding: '4px' }} title="Edit template" onClick={() => alert(`Editing template: ${frag.title}`)}>✏️</button>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{frag.desc}</div>
                  
                  {/* Collapsible content */}
                  <details style={{ fontSize: '11px', cursor: 'pointer' }}>
                    <summary style={{ color: 'var(--text-info)', fontWeight: 500, outline: 'none' }}>
                      View Prompt Template Text
                    </summary>
                    <pre style={{
                      marginTop: '6px',
                      padding: '8px 12px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text-secondary)',
                      cursor: 'text'
                    }}>
                      {frag.template}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 6. TOOLS CONFIGURATION SUB-TAB ──────────────────────────────── */}
        {activeSubTab === 'tools' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>AI Agent System Tools</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Enable or disable specific system operations that language models can call during the modernization cycles.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { id: 'scanProjectDirectory', name: 'scanProjectDirectory', desc: 'Queries workspace files, directories, size, and recursive tree structures.', enabled: true },
                { id: 'getFileContent', name: 'getFileContent', desc: 'Reads full text file content from disk safely (supports UTF-8).', enabled: true },
                { id: 'writeSessionFile', name: 'writeSessionFile', desc: 'Writes generated refactored code to the target workspace folder.', enabled: true },
                { id: 'executeCommand', name: 'executeCommand', desc: 'Spawns terminal actions (compilers, build loops, test runners) to check migrations.', enabled: true },
                { id: 'searchFilesPattern', name: 'searchFilesPattern', desc: 'Uses ripgrep internally to identify key modules/patterns across files.', enabled: true }
              ].map(tool => (
                <div 
                  key={tool.id}
                  style={{
                    background: 'rgba(30,30,30,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-info)' }}>
                      {tool.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {tool.desc}
                    </div>
                  </div>
                  <div 
                    className="agent-detail-toggle-block" 
                    style={{ cursor: 'pointer', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => alert(`Toggled tool: ${tool.name}`)}
                  >
                    <span style={{ fontSize: '11px' }}>{tool.enabled ? 'Enabled' : 'Disabled'}</span>
                    <ToggleRight className="toggle-switch-icon text-success" size={20} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 7. SKILLS CONFIGURATION SUB-TAB ─────────────────────────────── */}
        {activeSubTab === 'skills' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>AI Agent Custom Skills</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Configure task macros / skills that agents can trigger to address common development issues.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { name: 'pr-description-generator', status: 'Active', desc: 'Analyzes differences between code sets and writes formatted pull request descriptions.' },
                { name: 'ticket-requirements-analyzer', status: 'Active', desc: 'Scrapes requirements, stories, and details from connected issue trackers.' },
                { name: 'dependency-resolver', status: 'Inactive', desc: 'Resolves complex framework changes by refactoring common imports.' },
                { name: 'quick-compilation-repair', status: 'Active', desc: 'Performs micro-fixes to quickly solve common compilation compiler warnings.' }
              ].map(skill => (
                <div 
                  key={skill.name}
                  style={{
                    background: 'rgba(30,30,30,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{skill.name}</span>
                    <span 
                      style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: skill.status === 'Active' ? 'rgba(78,201,176,0.1)' : 'rgba(244,135,113,0.1)',
                        color: skill.status === 'Active' ? 'var(--text-success)' : 'var(--text-error)'
                      }}
                    >
                      {skill.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{skill.desc}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button 
                      className="btn-premium btn-premium--primary" 
                      style={{ width: 'auto', padding: '3px 8px', fontSize: '10px' }}
                      onClick={() => alert(`Running skill: ${skill.name}`)}
                    >
                      Run Skill
                    </button>
                    <button 
                      className="btn-premium btn-premium--secondary" 
                      style={{ width: 'auto', padding: '3px 8px', fontSize: '10px' }}
                      onClick={() => alert(`Editing script: ${skill.name}`)}
                    >
                      Edit Script
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 5. MODEL ALIASES SUB-TAB ─────────────────────────────────────── */}
        {activeSubTab === 'aliases' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Model Alias Mapping</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Bind logical system model aliases to target developer accounts. When templates request a general alias, the compiler routes them dynamically.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '500px' }}>
              <div className="form-group">
                <label className="form-label">reasoning-model (Default)</label>
                <select className="form-select-premium" value="anthropic/claude-3-5-sonnet-20241022" onChange={() => {}}>
                  <option value="anthropic/claude-3-5-sonnet-20241022">anthropic/claude-3-5-sonnet-20241022</option>
                  <option value="openai/gpt-4o">openai/gpt-4o</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">fast-model (Default)</label>
                <select className="form-select-premium" value="openai/gpt-4o-mini" onChange={() => {}}>
                  <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                  <option value="google/gemini-1.5-flash">google/gemini-1.5-flash</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">chat-model (Default)</label>
                <select className="form-select-premium" value="anthropic/claude-3-5-sonnet-20241022" onChange={() => {}}>
                  <option value="anthropic/claude-3-5-sonnet-20241022">anthropic/claude-3-5-sonnet-20241022</option>
                  <option value="google/gemini-2.0-flash">google/gemini-2.0-flash</option>
                </select>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
