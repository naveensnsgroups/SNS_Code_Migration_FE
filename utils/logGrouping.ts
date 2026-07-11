// Pure log-parsing/grouping logic for the Terminal panel — condenses tool-call
// arguments, parses [Tag]/[Tool Call] prefixes, and groups consecutive raw log
// entries into the blocks TerminalPanel's row components render.
// condenseArguments mirrors SNS IDE toolcall-utils.ts:167.

import type { LogEntry } from '@/types';

const MAX_CONDENSED = 80;
const MAX_VAL_LEN   = 30;

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export function condenseArguments(rawArgs: string): string {
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
    if (Array.isArray(v))      return '[…]';
    if (typeof v === 'object' && v) return '{…}';
    return String(v);
  };

  if (entries.length === 1) return truncate(fmtVal(entries[0][1]), MAX_CONDENSED);
  return truncate(entries.map(([k, v]) => `${k}: ${fmtVal(v)}`).join(', '), MAX_CONDENSED);
}

// ── Parse [Tool Call] message → toolName + raw args JSON ─────────────────────
export function parseToolCall(msg: string): { name: string; argsJson: string } {
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

export interface ParsedTag {
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

export function parseTagPrefix(msg: string): ParsedTag | null {
  const m = msg.match(/^\[([A-Za-z][A-Za-z0-9\-_]*)\]\s*([\s\S]*)/);
  if (!m) return null;
  const tag = m[1];
  const body = m[2].trim();
  const tagClass = TAG_CLASS_MAP[tag] ?? 'log-tag--default';
  return { tag, body, tagClass };
}

// ── Group consecutive logs: [Tool Call] → [Tool Response] → [Tool Data] ───────
export interface ToolGroup {
  kind: 'tool';
  callLog: LogEntry;
  responseLog?: LogEntry;
  dataLog?: LogEntry;
}
export interface StreamGroup {
  kind: 'stream';
  chunks: LogEntry[];
}
export interface SingleLog {
  kind: 'turn' | 'todo' | 'phase' | 'generic';
  log: LogEntry;
}
export type Block = ToolGroup | StreamGroup | SingleLog;

export function groupLogs(logs: LogEntry[]): Block[] {
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
