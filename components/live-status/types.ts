/** A single completed tool call entry shown in the live tool feed. */
export interface ToolCallHistoryItem {
  /** Unique key for React list rendering. */
  id:        string;
  /** Tool function name, e.g. "getFileContent" */
  name:      string;
  /** Condensed args string, e.g. "path: src/index.ts" */
  args:      string;
  /** true = completed successfully, false = returned an error */
  success:   boolean;
  /** HH:MM:SS timestamp when the tool_response event arrived */
  timestamp: string;
}

export interface LiveStatusData {
  /** -1 = indeterminate (work happening, no % yet) */
  realPct:         number;
  fileCount:       { done: number; total: number; pct: number } | null;
  currentFile:     string;
  activeTool:      { name: string; args: string } | null;
  currentAgent:    string;
  currentStage:    string;
  alerts:          AlertItem[];
  /** Last 5 meaningful log messages (no tool/AI internals) */
  recentActivity:  string[];
  /** SSE-driven tool call history — last 20 completed calls, newest first */
  toolCallHistory: ToolCallHistoryItem[];
}

export interface AlertItem {
  id:        string;
  level:     'warning' | 'error';
  message:   string;
  timestamp: string;
}
