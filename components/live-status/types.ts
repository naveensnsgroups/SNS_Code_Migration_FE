// =============================================================================
//  components/live-status/types.ts
//  Shared TypeScript types for the Live Status Overlay system.
// =============================================================================

export interface LiveStatusData {
  /** -1 = indeterminate (work happening, no % yet) */
  realPct:        number;
  fileCount:      { done: number; total: number; pct: number } | null;
  currentFile:    string;
  activeTool:     { name: string; args: string } | null;
  currentAgent:   string;
  currentStage:   string;
  alerts:         AlertItem[];
  /** Last 5 meaningful log messages (no tool/AI internals) */
  recentActivity: string[];
}

export interface AlertItem {
  id:        string;
  level:     'warning' | 'error';
  message:   string;
  timestamp: string;
}
