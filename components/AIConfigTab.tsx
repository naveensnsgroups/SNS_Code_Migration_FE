// =============================================================================
//  components/AIConfigTab.tsx
//
//  Orchestrator for the AI Configuration panel.
//  All agent and tool data is fetched from the backend at runtime — NO hardcoded
//  mock data. Sub-tab panels are independent, focused components.
//
//  Real data endpoints:
//   GET /api/config/agents  → AgentsTab
//   GET /api/config/tools   → ToolsTab
//   GET /api/mcp/status     → McpTab
// =============================================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Layers, Coins, Bookmark, Wrench, Award, Link, Database, Bot } from 'lucide-react';
import { fetchAgents, fetchTools, type AgentDto, type ToolDto } from '@/services/api';
import { getAllDefaultModelOptions, getDefaultAliases } from '@/constants/models';
import type { TokenUsage } from '@/hooks/useMigration';
import AgentsTab   from '@/components/ai-config/AgentsTab';
import VariablesTab from '@/components/ai-config/VariablesTab';
import McpTab      from '@/components/ai-config/McpTab';
import TokensTab   from '@/components/ai-config/TokensTab';
import FragmentsTab from '@/components/ai-config/FragmentsTab';
import ToolsTab    from '@/components/ai-config/ToolsTab';
import SkillsTab   from '@/components/ai-config/SkillsTab';
import AliasesTab  from '@/components/ai-config/AliasesTab';

// ── Sub-Tab Definition ─────────────────────────────────────────────────────────

type SubTab = 'agents' | 'variables' | 'mcp' | 'tokens' | 'fragments' | 'tools' | 'skills' | 'aliases';

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'agents',    label: 'Agents',          icon: <Users    size={12} /> },
  { id: 'variables', label: 'Variables',        icon: <Layers   size={12} /> },
  { id: 'mcp',       label: 'MCP Servers',      icon: <Database size={12} /> },
  { id: 'tokens',    label: 'Token Usage',      icon: <Coins    size={12} /> },
  { id: 'fragments', label: 'Prompt Fragments', icon: <Bookmark size={12} /> },
  { id: 'tools',     label: 'Tools',            icon: <Wrench   size={12} /> },
  { id: 'skills',    label: 'Skills',           icon: <Award    size={12} /> },
  { id: 'aliases',   label: 'Model Aliases',    icon: <Link     size={12} /> },
];

// ── MCP Server type ────────────────────────────────────────────────────────────

interface MCPServer {
  id: string;
  name: string;
  status: string;
  description: string;
  tools: string[];
  version?: string | null;
}

// TokenUsage is imported from hooks/useMigration.ts — see comment there for
// why estimatedCost is `number | null` (null = no pricing rate configured).

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  onClose?: () => void;
  onSettingsSaved?: () => void;
  settingsTrigger?: number;
  tokenUsage?: TokenUsage;
  backendUrl?: string;
  isRunning?: boolean;
  sessionId?: string | null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AIConfigTab({
  onClose,
  onSettingsSaved,
  settingsTrigger = 0,
  tokenUsage,
  backendUrl = 'http://localhost:4000',
  isRunning = false,
  sessionId,
}: Props) {
  const [activeSubTab,     setActiveSubTab]     = useState<SubTab>('agents');

  // ── Real data from backend ─────────────────────────────────────────────────
  const [agents,           setAgents]           = useState<AgentDto[]>([]);
  const [agentsLoading,    setAgentsLoading]    = useState(true);
  const [agentsError,      setAgentsError]      = useState<string | null>(null);

  const [tools,            setTools]            = useState<ToolDto[]>([]);
  const [toolsLoading,     setToolsLoading]     = useState(true);

  const [mcpServers,       setMcpServers]       = useState<MCPServer[]>([]);
  const [mcpLoading,       setMcpLoading]       = useState(false);

  // ── Local UI state (persisted to localStorage) ─────────────────────────────
  const [selectedAgentId,  setSelectedAgentId]  = useState<string>('');
  const [modelOptions,     setModelOptions]     = useState<string[]>([]);

  const [toolsEnabled, setToolsEnabled] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('ai_config_tools') || '{}'); } catch { return {}; }
  });

  const [aliasesConfig, setAliasesConfig] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('ai_config_aliases') || JSON.stringify(getDefaultAliases()));
    } catch {
      return getDefaultAliases();
    }
  });

  // ── Fetch agents from backend ──────────────────────────────────────────────
  useEffect(() => {
    setAgentsLoading(true);
    setAgentsError(null);
    fetchAgents(backendUrl)
      .then(data => {
        setAgents(data.agents);
        if (data.agents.length > 0 && !selectedAgentId) {
          setSelectedAgentId(data.agents[0].id);
        }
      })
      .catch(err => setAgentsError(err.message || 'Failed to load agents'))
      .finally(() => setAgentsLoading(false));
  }, [backendUrl, settingsTrigger]);

  // ── Fetch tools from backend ───────────────────────────────────────────────
  useEffect(() => {
    setToolsLoading(true);
    fetchTools(backendUrl)
      .then(data => setTools(data.tools))
      .catch(() => setTools([]))
      .finally(() => setToolsLoading(false));
  }, [backendUrl, settingsTrigger]);

  // ── Fetch MCP servers when tab is active ──────────────────────────────────
  const refreshMcp = useCallback(() => {
    setMcpLoading(true);
    fetch(`${backendUrl}/api/mcp/status`)
      .then(r => r.json())
      .then(data => { if (data.servers) setMcpServers(data.servers); })
      .catch(() => setMcpServers([]))
      .finally(() => setMcpLoading(false));
  }, [backendUrl]);

  useEffect(() => {
    if (activeSubTab === 'mcp') refreshMcp();
  }, [activeSubTab, refreshMcp]);

  // ── Load model options from localStorage ──────────────────────────────────
  useEffect(() => {
    // Single source of truth for the seed list — see constants/models.ts.
    const defaultModels = getAllDefaultModelOptions();
    const providerKeys = ['anthropic_models', 'openai_models', 'google_models', 'grok_models', 'groq_models', 'openrouter_models', 'mistral_models', 'huggingface_models'];
    const custom: string[] = [];
    providerKeys.forEach(key => {
      const saved = localStorage.getItem(`setting_${key}`);
      if (saved) {
        try {
          const list = JSON.parse(saved);
          const prefix = key.split('_')[0];
          list.forEach((m: string) => custom.push(`${prefix}/${m}`));
        } catch {}
      }
    });
    setModelOptions(custom.length > 0 ? custom : defaultModels);
  }, [settingsTrigger]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleToggleAgent = useCallback((agentId: string) => {
    const saved = localStorage.getItem('ai_config_agents');
    const overrides: Record<string, { enabled: boolean }> = saved ? JSON.parse(saved) : {};
    const currentEnabled = overrides[agentId]?.enabled !== false;
    overrides[agentId] = { enabled: !currentEnabled };
    localStorage.setItem('ai_config_agents', JSON.stringify(overrides));
    onSettingsSaved?.();
  }, [onSettingsSaved]);

  const handleUpdateModel = useCallback((agentId: string, model: string) => {
    const saved = localStorage.getItem('ai_config_agents');
    const overrides: Record<string, { selectedModel?: string }> = saved ? JSON.parse(saved) : {};
    overrides[agentId] = { ...(overrides[agentId] || {}), selectedModel: model };
    localStorage.setItem('ai_config_agents', JSON.stringify(overrides));
    onSettingsSaved?.();
  }, [onSettingsSaved]);

  const handleToolToggle = useCallback((toolId: string) => {
    setToolsEnabled(prev => {
      const current = prev[toolId] !== false;
      const updated = { ...prev, [toolId]: !current };
      localStorage.setItem('ai_config_tools', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleAliasChange = useCallback((key: string, value: string) => {
    setAliasesConfig(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('ai_config_aliases', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── Merge agent state with localStorage overrides ─────────────────────────
  const agentsSaved = (() => {
    try { return JSON.parse(localStorage.getItem('ai_config_agents') || '{}'); } catch { return {}; }
  })();

  const mergedAgents = agents.map(a => ({
    ...a,
    enabled:       agentsSaved[a.id]?.enabled !== false,
    selectedModel: agentsSaved[a.id]?.selectedModel ?? (a.languageModelRequirements[0]?.identifier ?? ''),
    hasChat:       a.tags.includes('planner') || a.tags.includes('writer'),
    systemTemplate: a.prompts[0]?.variant ?? `${a.id}-system-default`,
    tags:          a.tags ?? [],
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="editor-area config-editor-page">
      {/* Header */}
      <div className="settings-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={15} style={{ color: 'var(--accent-blue)' }} />
          <span className="settings-title">AI Configuration</span>
          {onClose && (
            <button className="settings-close" onClick={onClose} title="Close Panel">✕</button>
          )}
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="config-sub-tabs">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            className={`config-sub-tab ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div className="config-panel-content">

        {activeSubTab === 'agents' && (
          agentsLoading ? (
            <div style={{ padding: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading agents from backend…</div>
          ) : agentsError ? (
            <div style={{ padding: '24px', fontSize: '13px', color: 'var(--text-error)' }}>⚠ {agentsError}</div>
          ) : (
            <AgentsTab
              agents={mergedAgents}
              selectedAgentId={selectedAgentId || mergedAgents[0]?.id || ''}
              modelOptions={modelOptions}
              onSelectAgent={setSelectedAgentId}
              onToggleAgent={handleToggleAgent}
              onUpdateModel={handleUpdateModel}
            />
          )
        )}

        {activeSubTab === 'variables'  && <VariablesTab />}
        {activeSubTab === 'mcp'        && <McpTab servers={mcpServers} loading={mcpLoading} onRefresh={refreshMcp} />}
        {activeSubTab === 'tokens'     && <TokensTab tokenUsage={tokenUsage} isRunning={isRunning} sessionId={sessionId} />}
        {activeSubTab === 'fragments'  && <FragmentsTab />}

        {activeSubTab === 'tools' && (
          toolsLoading ? (
            <div style={{ padding: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>Loading tools from backend…</div>
          ) : (
            <ToolsTab
              tools={tools}
              toolsEnabled={toolsEnabled}
              onToggle={handleToolToggle}
            />
          )
        )}

        {activeSubTab === 'skills'  && <SkillsTab backendUrl={backendUrl} />}
        {activeSubTab === 'aliases' && <AliasesTab aliases={aliasesConfig} modelOptions={modelOptions} onAliasChange={handleAliasChange} />}

      </div>
    </div>
  );
}
