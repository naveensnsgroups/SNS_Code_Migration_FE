'use client';

// =============================================================================
//  TerminalPanel.tsx — Exact SNS IDE Toolcall-Part-Renderer Pattern
//
//  Mirrors: snside/packages/ai-chat-ui/src/browser/chat-response-renderer/
//           toolcall-part-renderer.tsx + thinking-part-renderer.tsx
//
//  Key design decisions (copied from SNS IDE source):
//  1. <details>/<summary> — native HTML, browser handles expand/collapse
//  2. Tool call row: "Ran toolName(condensedArgs)" — SNS IDE line 258
//  3. Thinking block: <details><summary>Thinking</summary><pre>...</pre></details>
//  4. condenseArguments: show "key: value, key2: value2" truncated to 80 chars
//  5. Result data shown inside <details> expanded body — same as SNS IDE
//  6. Spinner for in-flight calls (not-yet-finished state)
// =============================================================================

import { LogEntry, LogLevel } from '@/types';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  Loader2,
  Brain,
  ListTodo,
} from 'lucide-react';

interface Props {
  logs: LogEntry[];
  isRunning: boolean;
  height?: number;
}

// ── condenseArguments — mirrors SNS IDE toolcall-utils.ts:167 ─────────────────
// Shows "key: value, key2: value2" truncated to 80 chars, same as SNS IDE

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
  // "[Tool Call] toolName({...}...)" or "[Tool Call] Executing tool "toolName"..."
  const body = msg.replace(/^\[Tool Call\]\s*/, '').trim()
                  .replace(/^Executing tool\s*"?/, '').replace(/"?\s*\.\.\.\s*$/, '').trim();
  const pi = body.indexOf('(');
  if (pi === -1) return { name: body, argsJson: '{}' };
  const name    = body.slice(0, pi).trim();
  const rawArgs = body.slice(pi + 1).replace(/\.\.\.?\)$|\)$/, '').trim();
  return { name, argsJson: rawArgs || '{}' };
}

// ── Render tool response data — mirrors SNS IDE renderResult() ────────────────

function ResultContent({ text }: { text: string }) {
  // Try to parse as JSON for pretty display
  let display = text;
  try {
    const parsed = JSON.parse(text);
    display = JSON.stringify(parsed, null, 2);
  } catch { /* keep as text */ }

  return (
    <div style={{
      padding: '6px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-secondary)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      lineHeight: '1.6',
      maxHeight: '200px',
      overflowY: 'auto',
      background: 'rgba(0,0,0,0.18)',
      borderRadius: '3px',
      margin: '0 0 4px 0',
    }}>
      {display}
    </div>
  );
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
  kind: 'thinking' | 'todo' | 'phase' | 'generic';
  log: LogEntry;
}
type Block = ToolGroup | StreamGroup | SingleLog;

function groupLogs(logs: LogEntry[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < logs.length) {
    const log = logs[i];
    const msg = log.message;
    const lvl = (log as any).level as string;

    // Stream text — accumulate consecutive stream chunks into one block
    if (lvl === 'stream') {
      const chunks: LogEntry[] = [log]; i++;
      while (i < logs.length && (logs[i] as any).level === 'stream') {
        chunks.push(logs[i]); i++;
      }
      blocks.push({ kind: 'stream', chunks }); continue;
    }

    // Tool Call → consume Response + Data if immediately following
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

    // Orphan response/data (already consumed above — skip)
    if (msg.startsWith('[Tool Response]') || msg.startsWith('[Tool Data]')) {
      i++; continue;
    }

    if (msg.startsWith('[AI Request]') || msg.startsWith('[AI Response]')) {
      blocks.push({ kind: 'thinking', log }); i++; continue;
    }
    if (msg.includes('[Todo]') || msg.includes('tasks completed')) {
      blocks.push({ kind: 'todo', log }); i++; continue;
    }
    if (
      msg.includes('Stage') || msg.includes('Phase') ||
      msg.includes('complete') || msg.includes('Initializing') ||
      msg.startsWith('🎉') || msg.startsWith('🚀')
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
  const dataText  = group.dataLog?.message.replace(/^\[Tool Data\]\s*/, '').trim() ?? '';
  const isFinished = !!group.responseLog;

  const [isOpen, setIsOpen] = useState(!isFinished);

  // Sync open state when tool completion status changes
  useEffect(() => {
    setIsOpen(!isFinished);
  }, [isFinished]);

  return (
    <div style={{ margin: '1px 0', paddingLeft: '8px' }}>
      <details open={isOpen} onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)} style={{ listStyle: 'none' }}>
        <summary style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '3px 8px 3px 2px',
          cursor: 'pointer', userSelect: 'none',
          listStyle: 'none',
          fontFamily: 'var(--font-mono)', fontSize: '11.5px',
          // SNS IDE .theia-toolCall-finished style
          color: isFinished ? 'var(--text-secondary)' : '#569cd6',
          borderLeft: `2px solid ${isFinished ? '#264f78' : '#569cd6'}`,
          paddingLeft: '6px',
          background: 'rgba(30,80,120,0.06)',
          borderRadius: '0 3px 3px 0',
        }}>
          {/* Custom Chevron Indicator */}
          <span style={{
            display: 'inline-flex',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--text-muted)',
            flexShrink: 0
          }}>
            <ChevronRight size={10} />
          </span>

          {/* Status Icon */}
          {isFinished ? (
            <Check size={11} style={{ color: 'var(--text-success)', flexShrink: 0 }} />
          ) : (
            <Loader2 size={11} className="spin" style={{ color: '#569cd6', flexShrink: 0 }} />
          )}

          {/* Matches SNS IDE: "Ran {name}({argsLabel})" */}
          {isFinished ? (
            <>
              <span style={{ color: 'var(--text-muted)' }}>Ran </span>
              <strong style={{ color: '#dcdcaa' }}>{name}</strong>
              {condensed
                ? <span style={{ color: 'var(--text-muted)' }}>({condensed})</span>
                : <span style={{ color: 'var(--text-muted)' }}>()</span>
              }
            </>
          ) : (
            <>
              <span style={{ color: '#569cd6' }}>Running </span>
              <strong style={{ color: '#dcdcaa' }}>{name}</strong>
              {condensed && <span style={{ color: 'var(--text-muted)' }}>({condensed})</span>}
            </>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
            {group.callLog.timestamp}
          </span>
        </summary>

        {/* Response result body — mirrors SNS IDE <div className='theia-toolCall-response-result'> */}
        {dataText && (
          <div style={{ paddingLeft: '16px', paddingTop: '2px' }}>
            <ResultContent text={dataText} />
          </div>
        )}
      </details>
    </div>
  );
}

// ── ThinkingRow — mirrors SNS IDE <details><summary>Thinking</summary>... ─────

function ThinkingRow({ log }: { log: LogEntry }) {
  const body = log.message.replace(/^\[AI (Request|Response)\]\s*/, '').trim();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div style={{ margin: '1px 0', paddingLeft: '8px' }}>
      <details open={isOpen} onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}>
        <summary style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '3px 8px 3px 2px',
          cursor: 'pointer', userSelect: 'none',
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          color: 'var(--text-muted)', fontStyle: 'italic',
          listStyle: 'none',
        }}>
          {/* Custom Chevron Indicator */}
          <span style={{
            display: 'inline-flex',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--text-muted)',
            flexShrink: 0
          }}>
            <ChevronRight size={10} />
          </span>

          <Brain size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span>Thinking</span>
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
            {log.timestamp}
          </span>
        </summary>
        <pre style={{
          margin: '0 0 0 16px', padding: '4px 8px',
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          color: 'var(--text-muted)', whiteSpace: 'pre-wrap',
          wordBreak: 'break-word', lineHeight: '1.5',
          background: 'rgba(0,0,0,0.1)', borderRadius: '3px',
        }}>
          {body}
        </pre>
      </details>
    </div>
  );
}

// ── StreamGroup — SNS IDE stream chunks collected under a single Thinking block

function StreamBlock({ group }: { group: StreamGroup }) {
  const text = group.chunks.map(c => c.message).join('');
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div style={{ margin: '1px 0', paddingLeft: '8px' }}>
      <details open={isOpen} onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}>
        <summary style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '3px 8px 3px 2px', cursor: 'pointer', userSelect: 'none',
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          color: 'var(--text-muted)', fontStyle: 'italic', listStyle: 'none',
        }}>
          {/* Custom Chevron Indicator */}
          <span style={{
            display: 'inline-flex',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--text-muted)',
            flexShrink: 0
          }}>
            <ChevronRight size={10} />
          </span>

          <Brain size={11} className="spin" style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
          <span>Thinking</span>
        </summary>
        <pre style={{
          margin: '0 0 0 16px', padding: '4px 8px',
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          color: 'var(--text-muted)', whiteSpace: 'pre-wrap',
          wordBreak: 'break-word', lineHeight: '1.5',
          background: 'rgba(0,0,0,0.1)', borderRadius: '3px',
        }}>
          {text}
        </pre>
      </details>
    </div>
  );
}

// ── TodoRow ────────────────────────────────────────────────────────────────────

function TodoRow({ log }: { log: LogEntry }) {
  const body = log.message.replace('[Todo]', '').trim();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '2px 8px 2px 10px', margin: '1px 0',
      borderLeft: '2px solid rgba(220,196,80,0.4)',
    }}>
      <ListTodo size={11} style={{ color: '#dcc450', flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#dcc450' }}>{body}</span>
      <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
        {log.timestamp}
      </span>
    </div>
  );
}

// ── PhaseRow ───────────────────────────────────────────────────────────────────

function PhaseRow({ log }: { log: LogEntry }) {
  const isComplete = log.level === 'success' || log.message.includes('complete') || log.message.includes('🎉');
  const clean = log.message.replace(/^[🚀🎉✅⚠️❌]\s*/u, '').trim();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '4px 8px 4px 10px', margin: '2px 0',
      background: isComplete ? 'rgba(78,201,176,0.06)' : 'rgba(86,156,214,0.06)',
      borderLeft: `2px solid ${isComplete ? '#4ec9b0' : '#569cd6'}`,
    }}>
      {isComplete ? (
        <Check size={11} style={{ color: '#4ec9b0', flexShrink: 0 }} />
      ) : (
        <Loader2 size={11} className="spin" style={{ color: '#569cd6', flexShrink: 0 }} />
      )}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px',
        color: isComplete ? '#4ec9b0' : '#569cd6', fontWeight: 600,
      }}>{clean}</span>
      <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
        {log.timestamp}
      </span>
    </div>
  );
}

// ── GenericRow ─────────────────────────────────────────────────────────────────

function GenericRow({ log }: { log: LogEntry }) {
  const cfg: Record<LogLevel, { color: string; icon: React.ReactNode }> = {
    success: { color: '#4ec9b0', icon: <Check size={12} style={{ color: '#4ec9b0' }} /> },
    error:   { color: '#f48771', icon: <AlertCircle size={12} style={{ color: '#f48771' }} /> },
    warning: { color: '#cca700', icon: <AlertTriangle size={12} style={{ color: '#cca700' }} /> },
    command: { color: '#dcdcaa', icon: <ChevronRight size={12} style={{ color: '#dcdcaa' }} /> },
    info:    { color: 'var(--text-secondary)', icon: <Info size={12} style={{ color: 'var(--text-info)', opacity: 0.8 }} /> },
  };
  const { color, icon } = cfg[log.level] ?? cfg.info;
  const clean = log.message.replace(/^[✅❌⚠️🔧📋🎉🚀]\s*/u, '').trim();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '2px 8px', margin: '1px 0' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0, minWidth: '56px' }}>
        {log.timestamp}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', height: '18px', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '11px', color, flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {clean}
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

  const blocks = groupLogs(logs);

  return (
    <div className="bottom-panel" style={{ height: height ? `${height}px` : undefined }}>
      {/* Tab bar */}
      <div className="bottom-panel__tabs">
        <div className="bottom-panel__tab active">Terminal</div>
        <div className="bottom-panel__tab">Output</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8 }}>
          {isRunning && (
            <span style={{ fontSize: 11, color: 'var(--text-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 6, height: 6, background: 'var(--text-success)',
                borderRadius: '50%', display: 'inline-block', animation: 'blink 1s infinite',
              }} />
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
          <div style={{
            color: 'var(--text-muted)', padding: '8px 12px',
            fontFamily: 'var(--font-mono)', fontSize: '11px',
          }}>
            Ready. Upload a project and click Start Migration.
          </div>
        ) : (
          blocks.map((block, idx) => {
            if (block.kind === 'tool')     return <ToolRow     key={block.callLog.id} group={block} />;
            if (block.kind === 'stream')   return <StreamBlock key={block.chunks[0].id} group={block} />;
            if (block.kind === 'thinking') return <ThinkingRow key={block.log.id} log={block.log} />;
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
