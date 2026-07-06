// =============================================================================
//  components/ai-config/VariablesTab.tsx
//  Global variables shared across all agents — editable values persisted
//  to localStorage. Mirrors the SNS IDE AI Variables panel.
//
//  Every row below reads/writes a localStorage key that another real part of
//  the app actually uses. Rows for values with NO real client-side source
//  (targetStack, legacyPath, modernPath — these live only in the backend
//  session and are never sent to the browser) were removed rather than
//  wired to a fake key, since that would just move the problem.
// =============================================================================
'use client';

import { useState, useEffect } from 'react';
import { Globe, Edit3, Check, X } from 'lucide-react';

interface GlobalVar {
  id: string;
  name: string;
  description: string;
  storageKey: string;
}

const PROVIDERS = ['anthropic', 'openai', 'google', 'grok', 'groq', 'openrouter', 'mistral', 'huggingface'];

// These map to the SAME localStorage keys the rest of the app actually reads/writes —
// verified against hooks/useSettings.ts, hooks/useMigration.ts, and AIConfigTab.tsx.
const GLOBAL_VARIABLES: GlobalVar[] = [
  { id: 'session-id',       name: 'sessionId',        description: 'The most recently active migration session identifier (used to restore the session on page reload).', storageKey: 'last_session_id' },
  { id: 'local-output',     name: 'localOutputPath',  description: 'Optional user-specified local folder to write the modernized project.',       storageKey: 'setting_general_local_output_path' },
  { id: 'backend-url',      name: 'backendUrl',       description: 'The Code Migration backend URL (host:port).',                                 storageKey: 'setting_general_backend_url'       },
  { id: 'tools-config',     name: 'toolsConfig',      description: 'JSON map of tool IDs → enabled (true/false). Overrides default tool set.',   storageKey: 'ai_config_tools'          },
  { id: 'aliases-config',   name: 'aliasesConfig',    description: 'JSON map of model aliases → model identifiers.',                              storageKey: 'ai_config_aliases'        },
  { id: 'prompt-fragment',  name: 'systemAgentRules',  description: 'Custom rules appended to every agent\'s system prompt (the only prompt fragment ID the backend currently reads).', storageKey: 'ai_prompt_fragment_system-agent-rules' },
];

// Always returns a string safe for rendering as a React child.
// If the stored value is a JSON object/array, shows it as compact JSON.
function readStored(key: string): string {
  if (typeof window === 'undefined') return '';
  const raw = localStorage.getItem(key);
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed);
    return JSON.stringify(parsed);
  } catch {
    // Fragment text is stored as a raw string, not JSON — return as-is.
    return raw;
  }
}

interface EditableRowProps {
  variable: GlobalVar;
}

function EditableRow({ variable }: EditableRowProps) {
  const [value,   setValue]   = useState('');
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  const isComplexValue = (() => {
    if (!value) return false;
    try { const p = JSON.parse(value); return typeof p === 'object' && p !== null; } catch { return false; }
  })();

  useEffect(() => {
    setValue(readStored(variable.storageKey));
  }, [variable.storageKey]);

  const commit = () => {
    localStorage.setItem(variable.storageKey, JSON.stringify(draft));
    setValue(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  return (
    <div style={{
      background: 'rgba(30,30,30,0.3)', border: '1px solid var(--border-color)',
      borderRadius: '6px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--text-info)' }}>
            {variable.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {variable.description}
          </div>
        </div>
        {!editing && !isComplexValue && (
          <button
            onClick={startEdit}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', marginLeft: '8px' }}
            title="Edit value"
          >
            <Edit3 size={13} />
          </button>
        )}
      </div>

      {editing && !isComplexValue ? (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="text"
            className="form-select-premium"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', flex: 1 }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            autoFocus
          />
          <button onClick={commit} style={{ background: 'none', border: 'none', color: 'var(--text-success)', cursor: 'pointer' }}>
            <Check size={14} />
          </button>
          <button onClick={cancel} style={{ background: 'none', border: 'none', color: 'var(--text-error)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      ) : isComplexValue ? (
        <pre style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: 'var(--text-secondary)',
          background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '3px',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '80px', overflowY: 'auto',
          margin: 0,
        }}>
          {(() => { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } })()}
        </pre>
      ) : (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          color: value ? 'var(--accent-green)' : 'var(--text-muted)',
          background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '3px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%'
        }}>
          {value || '— not set —'}
        </div>
      )}
    </div>
  );
}

// API key status is derived across all 8 providers (there's no single
// "the" API key) — read-only, real, sourced from the exact keys Settings writes.
function ApiKeyStatusRow() {
  const [configured, setConfigured] = useState<string[]>([]);

  useEffect(() => {
    const found = PROVIDERS.filter(p => {
      const raw = localStorage.getItem(`setting_${p}_api_key`);
      if (!raw) return false;
      try { return !!JSON.parse(raw)?.trim(); } catch { return !!raw.trim(); }
    });
    setConfigured(found);
  }, []);

  return (
    <div style={{
      background: 'rgba(30,30,30,0.3)', border: '1px solid var(--border-color)',
      borderRadius: '6px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px'
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--text-info)' }}>
        apiKey
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
        Read-only — an API key is per-provider. Edit in Settings.
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px',
        color: configured.length > 0 ? 'var(--accent-green)' : 'var(--text-muted)',
        background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '3px',
      }}>
        {configured.length > 0 ? `Configured: ${configured.join(', ')}` : '— not set —'}
      </div>
    </div>
  );
}

export default function VariablesTab() {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Globe size={14} style={{ color: 'var(--accent-blue)' }} />
        <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Global Variables</h3>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{GLOBAL_VARIABLES.length + 1} variables</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Variables shared across all agents. Values are read from localStorage and sent to the backend on each migration start.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <ApiKeyStatusRow />
        {GLOBAL_VARIABLES.map(v => (
          <EditableRow key={v.id} variable={v} />
        ))}
      </div>
    </div>
  );
}
