// Only 'system-agent-rules' is actually read by the backend (appended to every agent's
// system prompt) — other fragment IDs were removed since editing them did nothing.
'use client';

import { useState } from 'react';
import { X, Check, Pencil } from 'lucide-react';

const FRAGMENT_ID    = 'system-agent-rules';
const FRAGMENT_TITLE = 'system-agent-rules';
const STORAGE_KEY     = `ai_prompt_fragment_${FRAGMENT_ID}`;

function readFragment(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export default function FragmentsTab() {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState<string | null>(null);

  const saved = readFragment();
  const text  = draft ?? saved;
  const isCustom = saved.length > 0;

  const save = () => {
    if (draft !== null) {
      if (draft.trim().length > 0) localStorage.setItem(STORAGE_KEY, draft);
      else localStorage.removeItem(STORAGE_KEY);
    }
    setEditing(false);
    setDraft(null);
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDraft('');
    setEditing(false);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Custom Agent Rules</h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Free text appended as an extra <code>&lt;custom_rules&gt;</code> block to every agent's
        system prompt for this session. Leave empty to use each agent's default prompt unmodified.
      </p>

      <div style={{
        background: 'var(--bg-tertiary)',
        border: `1px solid ${isCustom ? 'rgba(78,201,176,0.3)' : 'var(--border-color)'}`,
        borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{FRAGMENT_TITLE}</span>
            <span style={{
              fontSize: '9px',
              background: isCustom ? 'rgba(78,201,176,0.15)' : 'rgba(0,122,204,0.15)',
              color: isCustom ? 'var(--text-success)' : 'var(--text-info)',
              padding: '1px 5px', borderRadius: '3px'
            }}>
              {isCustom ? 'Custom' : 'Default (empty)'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {isCustom && !editing && (
              <button className="list-item-delete-btn" style={{ padding: '4px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={reset}><X size={11} /> Reset</button>
            )}
            <button
              className="list-item-delete-btn"
              style={{ padding: '4px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', color: editing ? 'var(--text-success)' : undefined }}
              onClick={() => {
                if (editing) save();
                else { setDraft(text); setEditing(true); }
              }}
            >
              {editing ? <><Check size={11} /> Save</> : <><Pencil size={11} /> Edit</>}
            </button>
          </div>
        </div>

        {editing ? (
          <textarea
            value={draft ?? ''}
            onChange={e => setDraft(e.target.value)}
            placeholder="e.g. Always prefer async/await over callbacks. Never remove existing comments."
            style={{ width: '100%', minHeight: '120px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '8px', resize: 'vertical', boxSizing: 'border-box' }}
          />
        ) : (
          <div style={{ fontSize: '11px', color: text ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
            {text || '— empty, no custom rules applied —'}
          </div>
        )}
      </div>
    </div>
  );
}
