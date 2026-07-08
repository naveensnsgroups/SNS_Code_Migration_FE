// ── Shared Types for Code Migration Platform ──────────────────────────

export type MigrationStatus =
  | 'idle'
  | 'scanning'
  | 'planning'
  | 'discovery'
  | 'file-analysis'
  | 'graph-resolution'
  | 'section-writing'
  | 'assembly'
  | 'migration-planning'
  | 'code-generation'
  | 'verification'
  | 'migration-assembly'
  | 'complete'
  | 'error'
  | 'paused';

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
  framework: string;
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
}

export interface RuleCoverageEntry {
  legacyFile: string;
  targetFile: string;
  rules:      string[];
  covered?:   string[];
  uncovered?: string[];
}
