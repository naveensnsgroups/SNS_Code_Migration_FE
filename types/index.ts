// ── Shared Types for Code Migration Platform ──────────────────────────

export type MigrationStatus =
  | 'idle'
  | 'scanning'
  | 'planning'
  | 'discovery'
  | 'file-analysis'
  | 'graph-resolution'
  // HITL checkpoint: pipeline halts after graph-resolution for the user to review
  // the graphs and choose Continue (report) or Skip (code migration).
  | 'awaiting-graph-review'
  | 'section-writing'
  | 'assembly'
  | 'migration-planning'
  | 'code-generation'
  | 'verification'
  | 'migration-assembly'
  | 'complete'
  | 'error'
  | 'paused';

// Real per-run graph-resolution result the user reviews at the HITL checkpoint.
// Mirrors the backend GraphResolutionSummary (session/types.ts).
export interface GraphResolutionSummary {
  counters: Record<string, number>;
  primaryGraphsEmpty: boolean;
  generatedAt: string;
}

// 'stream' = a raw streamed chunk of model reasoning text, not a real severity level.
export type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'command' | 'stream';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  phase?: string;
}

export interface DetectedStack {
  language: string;
  framework: string;
  database: string;
  packageManager: string;
  fileCount: number;
  testFramework?: string;
  styling?: string;
  frontend?: string;
  apiLayer?: string;
  backend?: string;
  databaseLayer?: string;
  cloudInfrastructure?: string;
}

export interface TargetStack {
  provider: AIProvider;
  model: string;
  // Split from a single `framework` field — a migration now targets a
  // frontend framework (e.g. React -> Next.js) and a backend framework
  // (e.g. Express -> NestJS) independently; they're rarely the same choice.
  frontendFramework: string;
  backendFramework: string;
  database: string;
  language: string;
  testFramework: string;
  outputMode: 'direct' | 'suggest';
}

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'grok' | 'groq' | 'openrouter' | 'mistral' | 'huggingface';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  migrated?: boolean;
  language?: string;
}

// A virtual, synthesized-on-the-frontend entry (not a real file the backend
// stored) — appended to the displayed file tree once a Stage-1 Analysis
// report exists, so it's readable in the Explorer/CodeViewer like any other
// file without needing a dedicated report viewer.
export const STAGE1_ANALYSIS_VIRTUAL_PATH = 'Stage1_Analysis.md';

// Same pattern — the knowledge graph is a single Mixed object on the backend
// keyed by category (entity/db/callFlow/imports/rule/integration/architecture/
// api/middleware/security/symbol/config); the frontend fans it out into one
// virtual file per category inside a virtual folder, so Explorer looks like
// the multi-graph analysis output this mirrors.
export const KNOWLEDGE_GRAPH_FOLDER = 'Knowledge Graph';

export const KNOWLEDGE_GRAPH_CATEGORIES: { key: string; fileName: string }[] = [
  { key: 'entity', fileName: 'entity-graph.json' },
  { key: 'db', fileName: 'db-graph.json' },
  { key: 'callFlow', fileName: 'call-flow-graph.json' },
  { key: 'imports', fileName: 'imports-graph.json' },
  { key: 'rule', fileName: 'rule-graph.json' },
  { key: 'integration', fileName: 'integration-graph.json' },
  { key: 'architecture', fileName: 'architecture-graph.json' },
  { key: 'api', fileName: 'api-graph.json' },
  { key: 'middleware', fileName: 'middleware-graph.json' },
  { key: 'security', fileName: 'security-graph.json' },
  { key: 'symbol', fileName: 'symbol-graph.json' },
  { key: 'config', fileName: 'config-graph.json' },
  // Frontend-side categories — same pattern as the 12 backend ones above,
  // added once the workflow started running frontend-focused agents too.
  { key: 'component', fileName: 'component-graph.json' },
  { key: 'routing', fileName: 'routing-graph.json' },
  { key: 'state', fileName: 'state-graph.json' },
  { key: 'frontendApi', fileName: 'frontend-api-graph.json' },
  { key: 'frontendConfig', fileName: 'frontend-config-graph.json' },
  { key: 'frontendAuth', fileName: 'frontend-auth-graph.json' },
  { key: 'frontendValidation', fileName: 'frontend-validation-graph.json' },
  { key: 'frontendImports', fileName: 'frontend-imports-graph.json' },
  { key: 'frontendCallFlow', fileName: 'frontend-call-flow-graph.json' },
  { key: 'asset', fileName: 'asset-graph.json' },
];

export function knowledgeGraphVirtualPath(fileName: string): string {
  return `${KNOWLEDGE_GRAPH_FOLDER}/${fileName}`;
}

export interface MigrationPhase {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export interface MigrateStartRequest {
  sessionId: string;
  targetStack: TargetStack;
  apiKey: string;
}

// Provider labels only — model lists are fully user-managed in Settings.
export const AI_PROVIDERS: Record<AIProvider, { label: string }> = {
  anthropic:   { label: 'Anthropic Claude' },
  openai:      { label: 'OpenAI GPT' },
  google:      { label: 'Google Gemini' },
  grok:        { label: 'Grok (xAI)' },
  groq:        { label: 'Groq' },
  openrouter:  { label: 'OpenRouter' },
  mistral:     { label: 'Mistral AI' },
  huggingface: { label: 'Hugging Face' },
};

export const MIGRATION_PHASES: MigrationPhase[] = [
  { id: 'scan',               label: 'Stack Detection',    status: 'pending' },
  { id: 'discovery',          label: 'Discovery',          status: 'pending' },
  { id: 'file-analysis',      label: 'File Analysis',      status: 'pending' },
  { id: 'graph-resolution',   label: 'Graph Resolution',   status: 'pending' },
  { id: 'section-writing',    label: 'Section Writing',    status: 'pending' },
  { id: 'assembly',           label: 'Assembly',           status: 'pending' },
  { id: 'migration-planning', label: 'Migration Planning', status: 'pending' },
  { id: 'code-generation',    label: 'Code Generation',    status: 'pending' },
  { id: 'verification',      label: 'Verification',       status: 'pending' },
  { id: 'migration-assembly', label: 'Migration Report',   status: 'pending' },
];

// Per-file migration task entry — mirrors the backend's MigrationTaskEntry.
export interface MigrationTaskEntry {
  legacyFile:    string;
  targetFile:    string;
  rulesInvolved: string[];
  dependsOn:     string[];
  status:        'pending' | 'generated' | 'verified' | 'failed';
  lastError?:    string;
  // Other legacyFile paths merged into this same task because the Planner
  // assigned them the same targetFile.
  mergedLegacyFiles?: string[];
  // Real exported symbols (name + async-ness), extracted from the generated content.
  exportedSymbols?: { name: string; isAsync: boolean }[];
}

export interface RuleCoverageEntry {
  legacyFile: string;
  targetFile: string;
  rules:      string[];
  covered?:   string[];
  uncovered?: string[];
}
