// =============================================================================
//  services/api.ts
//  Central API communication layer for Code Migration Platform.
//
//  Rules:
//   - NO hardcoded URLs — backendUrl is always a parameter
//   - NO business logic — pure fetch wrappers
//   - All responses are typed
//   - All errors throw with a meaningful message
// =============================================================================

import type { DetectedStack, FileNode, TargetStack } from '@/types';

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
    estimatedCost: number;
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
  googleMaxRetries?: number;
  googleRetryDelayRateLimit?: number;
  googleRetryDelayOther?: number;
  googleTimeoutMs?: number;
}

// ── API Functions ─────────────────────────────────────────────────────────────

/**
 * Upload project files and trigger a scan.
 * POST /api/scan
 */
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

/**
 * Start the migration pipeline for a session.
 * POST /api/migrate/start
 */
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

/**
 * Stop the running migration for a session.
 * POST /api/migrate/stop
 */
export async function stopMigration(
  backendUrl: string,
  sessionId: string
): Promise<void> {
  await fetch(`${backendUrl}/api/migrate/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {});
}

/**
 * Pause the running migration for a session.
 * POST /api/migrate/pause
 */
export async function pauseMigration(
  backendUrl: string,
  sessionId: string
): Promise<void> {
  await fetch(`${backendUrl}/api/migrate/pause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {});
}

/**
 * Load legacy and modern content for a selected file.
 * GET /api/file
 */
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

/**
 * Fetch the modern output file tree for a session.
 * GET /api/migrate/tree
 */
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

/**
 * Fetch all registered agent definitions from the backend.
 * GET /api/config/agents
 */
export async function fetchAgents(backendUrl: string): Promise<AgentsResponse> {
  const res = await fetch(`${backendUrl}/api/config/agents`);
  if (!res.ok) throw new Error('Failed to load agent definitions');
  return res.json() as Promise<AgentsResponse>;
}

/**
 * Fetch all registered tools from the backend tool registry.
 * GET /api/config/tools
 */
export async function fetchTools(backendUrl: string): Promise<ToolsResponse> {
  const res = await fetch(`${backendUrl}/api/config/tools`);
  if (!res.ok) throw new Error('Failed to load tool registry');
  return res.json() as Promise<ToolsResponse>;
}

/**
 * Fetch persisted token usage from session.json for a session.
 * GET /api/migrate/tokens?sessionId=...
 * Used to hydrate the Token Usage tab on load/page refresh.
 */
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
