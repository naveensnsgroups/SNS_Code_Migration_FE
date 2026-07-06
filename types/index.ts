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
  | 'complete'
  | 'error'
  | 'paused';

// 'stream' = a raw streamed chunk of the model's own reasoning text (see
// AgentExecutor's 'log' broadcast with level: 'stream'), rendered distinctly
// by TerminalPanel — not a real log severity level.
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
  mistral:     { label: 'Mistral AI' },
  huggingface: { label: 'Hugging Face' },
};

export const MIGRATION_PHASES: MigrationPhase[] = [
  { id: 'scan',             label: 'Stack Detection',   status: 'pending' },
  { id: 'discovery',        label: 'Discovery',         status: 'pending' },
  { id: 'file-analysis',    label: 'File Analysis',     status: 'pending' },
  { id: 'graph-resolution', label: 'Graph Resolution',  status: 'pending' },
  { id: 'section-writing',  label: 'Section Writing',   status: 'pending' },
  { id: 'assembly',         label: 'Assembly',          status: 'pending' },
];
