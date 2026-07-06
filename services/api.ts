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
  const res = await fetch(`${backendUrl}/api/migrate/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
}

/**
 * Pause the running migration for a session.
 * POST /api/migrate/pause
 */
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

export interface SessionStateResponse {
  sessionId: string;
  status: string;
  fileTree: FileNode[];
  detectedStack: DetectedStack | null;
  targetStack: TargetStack | null;
  phases: { id: string; label: string; status: 'pending' | 'active' | 'done' | 'error' }[];
  progress: number;
  currentFile: string;
}

/**
 * Full restorable session state — used on page load to recover an in-progress
 * or completed session after a refresh, instead of only remembering the
 * sessionId and losing everything else.
 */
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
 * GET /api/migrate/tokens?sessionId=...\n * Used to hydrate the Token Usage tab on load/page refresh.
 */
/**
 * Update the user-supplied per-model pricing rate(s) for a session. Applies
 * retroactively — the backend recomputes cost fresh from this on every
 * /tokens read, so this doesn't require restarting the migration.
 * POST /api/migrate/pricing
 */
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

/**
 * Trigger browser download of a file from the modern workspace.
 * GET /api/file/download?sessionId=...&file=Stage1_Analysis.md
 */
export function downloadFile(backendUrl: string, sessionId: string, fileName: string): void {
  const url = `${backendUrl}/api/file/download?sessionId=${encodeURIComponent(sessionId)}&file=${encodeURIComponent(fileName)}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Fetch list of all sessions from the backend.
 * GET /api/config/sessions
 */
export async function fetchSessionList(backendUrl: string): Promise<{ sessions: { sessionId: string; status: string; startedAt?: string }[] }> {
  const res = await fetch(`${backendUrl}/api/config/sessions`);
  if (!res.ok) return { sessions: [] };
  return res.json();
}
