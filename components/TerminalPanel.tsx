'use client';

// Renders tool-call/thinking log blocks using native <details>/<summary> for expand/collapse.

import { LogEntry, LogLevel } from '@/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  Loader2,
  ListTodo,
} from 'lucide-react';

interface Props {
  logs: LogEntry[];
  isRunning: boolean;
  height?: number;
}

// ── condenseArguments — mirrors SNS IDE toolcall-utils.ts:167 ─────────────────
const MAX_CONDENSED = 80;
const MAX_VAL_LEN   = 30;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\u2026' : s;
}

function condenseArguments(rawArgs: string): string {
  if (!rawArgs || rawArgs.trim() === '{}' || rawArgs.trim() === '') return '';
  let parsed: unknown;
  try { parsed = JSON.parse(rawArgs); } catch { return truncate(rawArgs, MAX_CONDENSED); }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return truncate(JSON.stringify(parsed), MAX_CONDENSED);
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) return '';

  const fmtVal = (v: unknown): string => {
    if (typeof v === 'string') return truncate(v, MAX_VAL_LEN);
    if (Array.isArray(v))      return '[\u2026]';
    if (typeof v === 'object' && v) return '{\u2026}';
    return String(v);
  };

  if (entries.length === 1) return truncate(fmtVal(entries[0][1]), MAX_CONDENSED);
  return truncate(entries.map(([k, v]) => `${k}: ${fmtVal(v)}`).join(', '), MAX_CONDENSED);
}

// ── Parse [Tool Call] message → toolName + raw args JSON ─────────────────────
function parseToolCall(msg: string): { name: string; argsJson: string } {
  const body = msg.replace(/^\[Tool Call\]\s*/, '').trim()
                  .replace(/^Executing tool\s*"?/, '').replace(/"?\s*\.\.\.\s*$/, '').trim();
  const pi = body.indexOf('(');
  if (pi === -1) return { name: body, argsJson: '{}' };
  const name    = body.slice(0, pi).trim();
  const rawArgs = body.slice(pi + 1).replace(/\.\.\.?\)$|\)$/, '').trim();
  return { name, argsJson: rawArgs || '{}' };
}

// ── Tag Badge System ──────────────────────────────────────────────────────────
// Parses "[Tag] message body" and returns { tag, body, tagClass }

interface ParsedTag {
  tag: string;
  body: string;
  tagClass: string;
}

const TAG_CLASS_MAP: Record<string, string> = {
  'KnowledgeGraph': 'log-tag--knowledge',
  'PlannerAgent':   'log-tag--planner',
  'Progress':       'log-tag--progress',
  'Todo':           'log-tag--todo',
  'Context':        'log-tag--context',
};

function parseTagPrefix(msg: string): ParsedTag | null {
  const m = msg.match(/^\[([A-Za-z][A-Za-z0-9\-_]*)\]\s*([\s\S]*)/);
  if (!m) return null;
  const tag = m[1];
  const body = m[2].trim();
  const tagClass = TAG_CLASS_MAP[tag] ?? 'log-tag--default';
  return { tag, body, tagClass };
}

// ── Result Content ────────────────────────────────────────────────────────────
function ResultContent({ text }: { text: string }) {
  let display = text;
  try {
    const parsed = JSON.parse(text);
    display = JSON.stringify(parsed, null, 2);
  } catch { /* keep as text */ }

  return <div className="tool-call__result-content">{display}</div>;
}

// ── Group consecutive logs: [Tool Call] → [Tool Response] → [Tool Data] ───────
interface ToolGroup {
  kind: 'tool';
  callLog: LogEntry;
  responseLog?: LogEntry;
  dataLog?: LogEntry;
}
interface StreamGroup {
  kind: 'stream';
  chunks: LogEntry[];
}
interface SingleLog {
  kind: 'turn' | 'todo' | 'phase' | 'generic';
  log: LogEntry;
}
type Block = ToolGroup | StreamGroup | SingleLog;

function groupLogs(logs: LogEntry[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < logs.length) {
    const log = logs[i];
    const msg = log.message;
    const lvl = log.level;

    if (lvl === 'stream') {
      const chunks: LogEntry[] = [log]; i++;
      while (i < logs.length && logs[i].level === 'stream') {
        chunks.push(logs[i]); i++;
      }
      blocks.push({ kind: 'stream', chunks }); continue;
    }

    if (msg.startsWith('[Tool Call]')) {
      const group: ToolGroup = { kind: 'tool', callLog: log }; i++;
      if (i < logs.length && logs[i].message.startsWith('[Tool Response]')) {
        group.responseLog = logs[i]; i++;
      }
      if (i < logs.length && logs[i].message.startsWith('[Tool Data]')) {
        group.dataLog = logs[i]; i++;
      }
      blocks.push(group); continue;
    }

    if (msg.startsWith('[Tool Response]') || msg.startsWith('[Tool Data]')) {
      i++; continue;
    }
    if (msg.startsWith('[AI Request]') || msg.startsWith('[AI Response]')) {
      // These are turn markers ("Submitting query to LLM (Turn N)"), NOT the
      // model's reasoning. Real reasoning arrives as 'stream' chunks (StreamBlock).
      blocks.push({ kind: 'turn', log }); i++; continue;
    }
    if (msg.includes('[Todo]') || msg.includes('tasks completed')) {
      blocks.push({ kind: 'todo', log }); i++; continue;
    }
    if (
      msg.includes('Stage') || msg.includes('Phase') ||
      msg.includes('complete') || msg.includes('Initializing') ||
      msg.startsWith('[PlannerAgent]') || msg.startsWith('[Scanner')
    ) {
      blocks.push({ kind: 'phase', log }); i++; continue;
    }
    blocks.push({ kind: 'generic', log }); i++;
  }

  return blocks;
}

// ── ToolRow — mirrors SNS IDE <details className='theia-toolCall-finished'> ───
function ToolRow({ group }: { group: ToolGroup }) {
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
function TurnRow({ log }: { log: LogEntry }) {
  const body = log.message.replace(/^\[AI (Request|Response)\]\s*/, '').trim();
  return (
    <div className="turn-row">
      <span className="turn-row__text">{body}</span>
      <span className="turn-row__time">{log.timestamp}</span>
    </div>
  );
}

// ── StreamBlock — exact SNS IDE theia-thinking pattern for streaming AI text ─
function StreamBlock({ group }: { group: StreamGroup }) {
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
function TodoRow({ log }: { log: LogEntry }) {
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
function PhaseRow({ log }: { log: LogEntry }) {
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
function GenericRow({ log }: { log: LogEntry }) {
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

// ── Main TerminalPanel ─────────────────────────────────────────────────────────
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
