// ── Shared Types for Code Migration Platform ──────────────────────────

export type MigrationStatus =
  | 'idle'
  | 'scanning'
  | 'planning'
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

// AI_PROVIDERS: provider labels only.
// Model lists are fully user-managed in Settings — no hardcoded defaults here.
// Each provider's available models are stored in localStorage by the user.
export const AI_PROVIDERS: Record<AIProvider, { label: string }> = {
  anthropic:   { label: 'Anthropic Claude' },
  openai:      { label: 'OpenAI GPT' },
  google:      { label: 'Google Gemini' },
  grok:        { label: 'Grok (xAI)' },
  groq:        { label: 'Groq' },
  openrouter:  { label: 'OpenRouter' },
  huggingface: { label: 'Hugging Face' },
};

export const MIGRATION_PHASES: MigrationPhase[] = [
  { id: 'scan',       label: 'Scan Codebase',         status: 'pending' },
  { id: 'plan',       label: 'Generate Plan',          status: 'pending' },
];
