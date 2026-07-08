// Central API communication layer — pure typed fetch wrappers, no business logic, no hardcoded URLs.

import type { DetectedStack, FileNode, TargetStack, MigrationTaskEntry, RuleCoverageEntry } from '@/types';

// ── Response Types ────────────────────────────────────────────────────────────

export interface ScanResponse {
  sessionId: string;
  fileTree?: FileNode[];
  detectedStack?: DetectedStack;
}

export interface FileContentResponse {
  content: string | null;
  modernContent: string | null;
}

export interface ModernTreeResponse {
  fileTree: FileNode[];
  modernPath?: string;
}

export interface SessionTokensResponse {
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    readCachedInputTokens?: number;
    totalTokens: number;
    /** null = no pricing rate configured for the model(s) used — never a guess. */
    estimatedCost: number | null;
    /** true = estimatedCost is a real but PARTIAL sum (some models used had no rate configured). */
    costIncomplete?: boolean;
    model?: string;
  } | null;
  /** Per-model aggregation of token usage history (SNS IDE ModelTokenUsageData pattern) */
  modelBreakdown: {
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    readCachedInputTokens?: number;
    totalTokens: number;
    lastUsed?: string;
    /** null = no pricing rate configured for this exact model — render as "not available". */
    estimatedCost: number | null;
  }[];
  sessionId: string;
}

export interface MigrateStartPayload {
  sessionId: string;
  targetStack: TargetStack;
  apiKey: string;
  localOutputPath: string;
  apiKeys: Record<string, string>;
  agentsConfig: unknown;
  toolsConfig: Record<string, boolean>;
  aliasesConfig: Record<string, string>;
  promptFragments: Record<string, string>;
  /** User-supplied per-model $/1M-token rates — see hooks/useSettings.ts. */
  modelPricing?: Record<string, { inputPerM: number; outputPerM: number; cacheWritePerM?: number; cacheReadPerM?: number }>;
  googleMaxRetries?: number;
  googleRetryDelayRateLimit?: number;
  googleRetryDelayOther?: number;
  googleTimeoutMs?: number;
  mistralMaxRetries?: number;
  mistralRetryDelayRateLimit?: number;
  mistralRetryDelayOther?: number;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function scanProject(
  backendUrl: string,
  formData: FormData
): Promise<ScanResponse> {
  const res = await fetch(`${backendUrl}/api/scan`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ScanResponse>;
}

export async function startMigration(
  backendUrl: string,
  payload: MigrateStartPayload
): Promise<void> {
  const res = await fetch(`${backendUrl}/api/migrate/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
}

// Requires the analysis pipeline to have already completed; apiKey/apiKeys must be
// resent since it wipes them from the session on completion.
export async function startMigrationPlanning(
  backendUrl: string,
  sessionId: string,
  targetStack: TargetStack,
  apiKey: string,
  apiKeys: Record<string, string>
): Promise<void> {
  const res = await fetch(`${backendUrl}/api/migrate/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, targetStack, apiKey, apiKeys }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// Requires a migration task list from /plan to already exist.
export async function startCodeGeneration(
  backendUrl: string,
  sessionId: string,
  targetStack: TargetStack,
  apiKey: string,
  apiKeys: Record<string, string>
): Promise<void> {
  const res = await fetch(`${backendUrl}/api/migrate/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, targetStack, apiKey, apiKeys }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// Requires at least one 'generated' task from /generate.
export async function startVerification(
  backendUrl: string,
  sessionId: string,
  targetStack: TargetStack,
  apiKey: string,
  apiKeys: Record<string, string>
): Promise<void> {
  const res = await fetch(`${backendUrl}/api/migrate/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, targetStack, apiKey, apiKeys }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function stopMigration(
  backendUrl: string,
  sessionId: string
): Promise<void> {
  const res = await fetch(`${backendUrl}/api/migrate/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function pauseMigration(
  backendUrl: string,
  sessionId: string
): Promise<void> {
  const res = await fetch(`${backendUrl}/api/migrate/pause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchFileContent(
  backendUrl: string,
  sessionId: string,
  filePath: string
): Promise<FileContentResponse> {
  const res = await fetch(
    `${backendUrl}/api/file?sessionId=${sessionId}&path=${encodeURIComponent(filePath)}`
  );
  if (!res.ok) throw new Error('Failed to load file content');
  return res.json() as Promise<FileContentResponse>;
}

export async function fetchModernTree(
  backendUrl: string,
  sessionId: string
): Promise<ModernTreeResponse> {
  const res = await fetch(
    `${backendUrl}/api/migrate/tree?sessionId=${sessionId}`
  );
  if (!res.ok) throw new Error('Failed to load modern file tree');
  return res.json() as Promise<ModernTreeResponse>;
}

export interface SessionStateResponse {
  sessionId: string;
  status: string;
  fileTree: FileNode[];
  detectedStack: DetectedStack | null;
  targetStack: TargetStack | null;
  phases: { id: string; label: string; status: 'pending' | 'active' | 'done' | 'error' }[];
  progress: number;
  currentFile: string;
  migrationTaskList: MigrationTaskEntry[] | null;
  ruleCoverageReport: RuleCoverageEntry[] | null;
}

// Used on page load to recover an in-progress or completed session after a refresh.
export async function fetchSessionState(
  backendUrl: string,
  sessionId: string
): Promise<SessionStateResponse> {
  const res = await fetch(
    `${backendUrl}/api/migrate/state?sessionId=${sessionId}`
  );
  if (!res.ok) throw new Error('Failed to load session state');
  return res.json() as Promise<SessionStateResponse>;
}

// ── Config API — Real Agent + Tool Registry ───────────────────────────────────

export interface AgentVariableDto {
  name: string;
  desc: string;
}

export interface AgentPromptDto {
  id: string;
  variant: string;
  label: string;
}

export interface AgentModelRequirementDto {
  purpose: string;
  identifier: string;
}

export interface AgentDto {
  id: string;
  name: string;
  description: string;
  tags: string[];
  functions: string[];
  variables: AgentVariableDto[];
  prompts: AgentPromptDto[];
  languageModelRequirements: AgentModelRequirementDto[];
}

export interface AgentsResponse {
  agents: AgentDto[];
  total: number;
  timestamp: string;
}

export interface ToolDto {
  id: string;
  name: string;
  description: string;
  parameters: unknown;
}

export interface ToolsResponse {
  tools: ToolDto[];
  total: number;
  timestamp: string;
}

export async function fetchAgents(backendUrl: string): Promise<AgentsResponse> {
  const res = await fetch(`${backendUrl}/api/config/agents`);
  if (!res.ok) throw new Error('Failed to load agent definitions');
  return res.json() as Promise<AgentsResponse>;
}

export async function fetchTools(backendUrl: string): Promise<ToolsResponse> {
  const res = await fetch(`${backendUrl}/api/config/tools`);
  if (!res.ok) throw new Error('Failed to load tool registry');
  return res.json() as Promise<ToolsResponse>;
}

// Applies retroactively — the backend recomputes cost fresh from this on every /tokens read.
export async function updateModelPricing(
  backendUrl: string,
  sessionId: string,
  modelPricing: Record<string, { inputPerM: number; outputPerM: number; cacheWritePerM?: number; cacheReadPerM?: number }>
): Promise<void> {
  const res = await fetch(`${backendUrl}/api/migrate/pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, modelPricing }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchSessionTokens(
  backendUrl: string,
  sessionId: string
): Promise<SessionTokensResponse> {
  const res = await fetch(
    `${backendUrl}/api/migrate/tokens?sessionId=${sessionId}`
  );
  if (!res.ok) throw new Error('Failed to load session tokens');
  return res.json() as Promise<SessionTokensResponse>;
}

export function downloadFile(backendUrl: string, sessionId: string, fileName: string): void {
  const url = `${backendUrl}/api/file/download?sessionId=${encodeURIComponent(sessionId)}&file=${encodeURIComponent(fileName)}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
