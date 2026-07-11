'use client';

// Scroll container + block-dispatch switch for the Terminal panel. Log parsing
// lives in utils/logGrouping.ts; row rendering lives in components/terminal/LogRows.tsx.

import { LogEntry } from '@/types';
import { useEffect, useMemo, useRef } from 'react';
import { groupLogs } from '@/utils/logGrouping';
import { ToolRow, TurnRow, StreamBlock, TodoRow, PhaseRow, GenericRow } from '@/components/terminal/LogRows';

interface Props {
  logs: LogEntry[];
  isRunning: boolean;
  height?: number;
}

export default function TerminalPanel({ logs, isRunning, height }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Memoized so a re-render NOT caused by new logs (resize, parent state
  // changes elsewhere in AIPanel, etc.) doesn't re-walk the whole list.
  const blocks = useMemo(() => groupLogs(logs), [logs]);

  return (
    <div className="bottom-panel" style={height ? { height: `${height}px` } : undefined}>
      {/* Tab bar */}
      <div className="bottom-panel__tabs">
        <div className="bottom-panel__tab active">Terminal</div>
        <div className="bottom-panel__tab">Output</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8 }}>
          {isRunning && (
            <span className="terminal-running-label">
              <span className="terminal-running-dot" />
              Running
            </span>
          )}
          {!isRunning && logs.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{logs.length} entries</span>
          )}
        </div>
      </div>

      {/* Log body */}
      <div className="terminal" style={{ padding: '4px 0' }}>
        {logs.length === 0 ? (
          <div className="terminal-empty">
            Ready. Upload a project and click Start Migration.
          </div>
        ) : (
          blocks.map((block) => {
            if (block.kind === 'tool')     return <ToolRow     key={block.callLog.id} group={block} />;
            if (block.kind === 'stream')   return <StreamBlock key={block.chunks[0].id} group={block} />;
            if (block.kind === 'turn')     return <TurnRow     key={block.log.id} log={block.log} />;
            if (block.kind === 'todo')     return <TodoRow     key={block.log.id} log={block.log} />;
            if (block.kind === 'phase')    return <PhaseRow    key={block.log.id} log={block.log} />;
            return <GenericRow key={block.log.id} log={block.log} />;
          })
        )}

        {isRunning && (
          <div style={{ padding: '2px 12px' }}>
            <span className="terminal__cursor" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
