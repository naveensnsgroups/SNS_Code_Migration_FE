'use client';

import { LogEntry } from '@/types';
import { useEffect, useRef } from 'react';

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

  const levelClass = (level: LogEntry['level']) => {
    const map: Record<LogEntry['level'], string> = {
      success: 'terminal__msg--success',
      error:   'terminal__msg--error',
      warning: 'terminal__msg--warning',
      info:    'terminal__msg--info',
      command: 'terminal__msg--command',
    };
    return map[level] ?? '';
  };

  const levelPrefix = (level: LogEntry['level']) => {
    const prefixes: Record<LogEntry['level'], string> = {
      success: '✅ ',
      error:   '❌ ',
      warning: '⚠️  ',
      info:    '   ',
      command: '$ ',
    };
    return prefixes[level] ?? '';
  };

  return (
    <div className="bottom-panel" style={{ height: height ? `${height}px` : undefined }}>
      <div className="bottom-panel__tabs">
        <div className="bottom-panel__tab active">Terminal</div>
        <div className="bottom-panel__tab">Output</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, paddingRight: 8 }}>
          {isRunning && (
            <span style={{ fontSize: 11, color: 'var(--text-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, background: 'var(--text-success)', borderRadius: '50%', display: 'inline-block', animation: 'blink 1s infinite' }} />
              Running
            </span>
          )}
        </div>
      </div>
      <div className="terminal">
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '4px 0' }}>
            Ready. Upload a project and click Start Migration.
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="terminal__line">
              <span className="terminal__time">{log.timestamp}</span>
              <span className={`terminal__msg ${levelClass(log.level)}`}>
                {levelPrefix(log.level)}{log.message}
              </span>
            </div>
          ))
        )}
        {isRunning && (
          <div className="terminal__line">
            <span className="terminal__time">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span className="terminal__msg">
              <span className="terminal__cursor" />
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
