'use client';

// Presentational row renderers for the Terminal panel — one component per
// Block kind produced by utils/logGrouping.ts's groupLogs().

import { useEffect, useState } from 'react';
import { Check, AlertTriangle, AlertCircle, Info, ChevronRight, Loader2, ListTodo } from 'lucide-react';
import type { LogEntry, LogLevel } from '@/types';
import { condenseArguments, parseToolCall, parseTagPrefix, type ToolGroup, type StreamGroup } from '@/utils/logGrouping';

// ── Result Content ────────────────────────────────────────────────────────────
function ResultContent({ text }: { text: string }) {
  let display = text;
  try {
    const parsed = JSON.parse(text);
    display = JSON.stringify(parsed, null, 2);
  } catch { /* keep as text */ }

  return <div className="tool-call__result-content">{display}</div>;
}

// ── ToolRow — mirrors SNS IDE <details className='theia-toolCall-finished'> ───
export function ToolRow({ group }: { group: ToolGroup }) {
  const { name, argsJson } = parseToolCall(group.callLog.message);
  const condensed = condenseArguments(argsJson);

  // Primary body: [Tool Data] log (actual output — file contents, search results, etc.)
  const dataText = group.dataLog?.message.replace(/^\[Tool Data\]\s*/, '').trim() ?? '';

  // Fallback body: [Tool Response] log (summary message — always present on finish)
  const responseText = group.responseLog?.message
    .replace(/^\[Tool Response\]\s*/, '')
    .trim() ?? '';

  // bodyText: use dataText if available, otherwise responseText, otherwise nothing
  const bodyText = dataText || responseText;

  const isFinished = !!group.responseLog;

  const [isOpen, setIsOpen] = useState(!isFinished);

  useEffect(() => {
    setIsOpen(!isFinished);
  }, [isFinished]);

  const summaryClass = `tool-call__summary ${isFinished ? 'tool-call__summary--finished' : 'tool-call__summary--running'}`;
  const chevronClass = `tool-call__chevron ${isOpen ? 'tool-call__chevron--open' : ''}`;

  return (
    <div className="tool-call">
      <details
        open={isOpen}
        onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className={summaryClass}>
          {/* Chevron */}
          <span className={chevronClass}>
            <ChevronRight size={10} />
          </span>

          {/* Status icon */}
          <span className={`tool-call__icon ${isFinished ? 'tool-call__icon--done' : 'tool-call__icon--running'}`}>
            {isFinished
              ? <Check size={11} />
              : <Loader2 size={11} className="spin" />
            }
          </span>

          {/* Label — matches SNS IDE: "Ran {name}({argsLabel})" or "Running {name}({argsLabel})" */}
          {isFinished ? (
            <>
              <span className="tool-call__verb">Ran </span>
              <strong className="tool-call__name">{name}</strong>
              <span className="tool-call__args">
                ({condensed || ''})
              </span>
            </>
          ) : (
            <>
              <span className="tool-call__verb tool-call__verb--running">Running </span>
              <strong className="tool-call__name">{name}</strong>
              {condensed && <span className="tool-call__args">({condensed})</span>}
            </>
          )}

          <span className="tool-call__time">{group.callLog.timestamp}</span>
        </summary>

        {/* Expanded body: full arguments the tool was called with, then the result */}
        {argsJson && argsJson.trim() !== '{}' && (
          <div className="tool-call__result">
            <div className="tool-call__result-label">Arguments</div>
            <ResultContent text={argsJson} />
          </div>
        )}
        {bodyText && (
          <div className="tool-call__result">
            <div className="tool-call__result-label">Result</div>
            <ResultContent text={bodyText} />
          </div>
        )}
      </details>
    </div>
  );
}

// ── TurnRow — subtle divider for "Submitting query to LLM (Turn N)" markers ──
// These are NOT reasoning; real reasoning is streamed and shown in StreamBlock.
export function TurnRow({ log }: { log: LogEntry }) {
  const body = log.message.replace(/^\[AI (Request|Response)\]\s*/, '').trim();
  return (
    <div className="turn-row">
      <span className="turn-row__text">{body}</span>
      <span className="turn-row__time">{log.timestamp}</span>
    </div>
  );
}

// ── StreamBlock — exact SNS IDE theia-thinking pattern for streaming AI text ─
export function StreamBlock({ group }: { group: StreamGroup }) {
  const text = group.chunks.map(c => c.message).join('');
  return (
    <div className="thinking-row">
      <details>
        <summary>Thinking</summary>
        <pre>{text}</pre>
      </details>
    </div>
  );
}

// ── TodoRow ───────────────────────────────────────────────────────────────────
export function TodoRow({ log }: { log: LogEntry }) {
  const body = log.message.replace('[Todo]', '').trim();
  return (
    <div className="todo-row">
      <span className="todo-row__icon"><ListTodo size={11} /></span>
      <span className="todo-row__text">{body}</span>
      <span className="todo-row__time">{log.timestamp}</span>
    </div>
  );
}

// ── PhaseRow ──────────────────────────────────────────────────────────────────
export function PhaseRow({ log }: { log: LogEntry }) {
  const isComplete = log.level === 'success' || log.message.includes('complete');
  return (
    <div className={`phase-row ${isComplete ? 'phase-row--complete' : 'phase-row--active'}`}>
      <span className="phase-row__icon">
        {isComplete
          ? <Check size={11} />
          : <Loader2 size={11} className="spin" />
        }
      </span>
      <span className={`phase-row__text ${isComplete ? 'phase-row__text--complete' : 'phase-row__text--active'}`}>
        {log.message}
      </span>
      <span className="phase-row__time">{log.timestamp}</span>
    </div>
  );
}

// ── GenericRow — with [Tag] badge ─────────────────────────────────────────────
export function GenericRow({ log }: { log: LogEntry }) {
  const iconMap: Record<LogLevel, React.ReactNode> = {
    success: <Check      size={12} style={{ color: 'var(--text-success)' }} />,
    error:   <AlertCircle   size={12} style={{ color: 'var(--text-error)' }} />,
    warning: <AlertTriangle size={12} style={{ color: 'var(--text-warning)' }} />,
    command: <ChevronRight  size={12} style={{ color: 'var(--accent-yellow)' }} />,
    info:    <Info          size={12} style={{ color: 'var(--text-info)', opacity: 0.8 }} />,
    // Never actually renders — exists only to satisfy the Record<LogLevel, ...> exhaustiveness check.
    stream:  <Info          size={12} style={{ color: 'var(--text-info)', opacity: 0.8 }} />,
  };

  const parsed = parseTagPrefix(log.message);
  const icon   = iconMap[log.level] ?? iconMap.info;

  return (
    <div className="log-row">
      <span className="log-row__time">{log.timestamp}</span>
      <span className="log-row__icon">{icon}</span>
      <span className="log-row__body">
        {/* Colored tag badge — only when [Tag] prefix detected */}
        {parsed && (
          <span className={`log-tag ${parsed.tagClass}`}>{parsed.tag}</span>
        )}
        <span className={`log-row__msg log-row__msg--${log.level}`}>
          {parsed ? parsed.body : log.message}
        </span>
      </span>
    </div>
  );
}
