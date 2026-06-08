// ── Shared Types for Code Migration Platform ──────────────────────────

export type MigrationStatus =
  | 'idle'
  | 'scanning'
  | 'planning'
  | 'pseudocode'
  | 'migrating'
  | 'building'
  | 'validating'
  | 'testing'
  | 'complete'
  | 'error'
  | 'paused';

export type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'command';

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

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'grok' | 'groq' | 'openrouter' | 'huggingface';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  migrated?: boolean;
  language?: string;
}

export interface MigrationSession {
  sessionId: string;
  status: MigrationStatus;
  projectPath: string;
  detectedStack?: DetectedStack;
  targetStack?: TargetStack;
  totalFiles: number;
  completedFiles: number;
  currentFile?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface MigrationPhase {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export interface SSEEvent {
  type:
    | 'log'
    | 'progress'
    | 'phase_change'
    | 'file_migrated'
    | 'complete'
    | 'error'
    | 'heartbeat';
  data: unknown;
  timestamp: string;
}

export interface ScanResult {
  sessionId: string;
  fileTree: FileNode[];
  detectedStack: DetectedStack;
}

export interface MigrateStartRequest {
  sessionId: string;
  targetStack: TargetStack;
  apiKey: string;
}

export interface ApiError {
  error: string;
  code: string;
}

export const AI_PROVIDERS: Record<AIProvider, { label: string; models: string[] }> = {
  anthropic: {
    label: 'Anthropic Claude',
    models: ['claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-opus-4-6', 'claude-opus-4-5'],
  },
  openai: {
    label: 'OpenAI GPT',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  google: {
    label: 'Google Gemini',
    models: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview'],
  },
  grok: {
    label: 'Grok (xAI)',
    models: ['grok-2', 'grok-2-mini'],
  },
  groq: {
    label: 'Groq',
    models: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
  },
  openrouter: {
    label: 'OpenRouter',
    models: ['meta-llama/llama-3-70b-instruct', 'deepseek/deepseek-chat', 'mistralai/mixtral-8x7b-instruct'],
  },
  huggingface: {
    label: 'Hugging Face',
    models: ['meta-llama/Meta-Llama-3-70B-Instruct', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
  },
};

export const MIGRATION_PHASES: MigrationPhase[] = [
  { id: 'scan',       label: 'Scan Codebase',         status: 'pending' },
  { id: 'plan',       label: 'Generate Plan',          status: 'pending' },
  { id: 'pseudocode', label: 'Write Pseudocode',       status: 'pending' },
  { id: 'migrate',    label: 'Migrate Files',          status: 'pending' },
  { id: 'install',    label: 'Install Dependencies',   status: 'pending' },
  { id: 'build',      label: 'Build Project',          status: 'pending' },
  { id: 'validate',   label: 'Validate & Fix',         status: 'pending' },
  { id: 'test',       label: 'Run Tests',              status: 'pending' },
  { id: 'report',     label: 'Final Report',           status: 'pending' },
];
