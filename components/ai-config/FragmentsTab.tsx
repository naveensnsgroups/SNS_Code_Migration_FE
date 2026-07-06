// =============================================================================
//  components/ai-config/FragmentsTab.tsx
//  AIConfig sub-tab: Editable prompt fragment (save/reset).
//
//  Only ONE fragment ID is actually read by the backend today:
//  'system-agent-rules' (see SNS_Code_Migration_BE planner-agent.ts,
//  CUSTOM_RULES_FRAGMENT_ID). It is appended as a <custom_rules> block to
//  every agent's system prompt for the session. Two other fragment IDs
//  ('validation-rules-strict', 'scanner-stack-detect') used to be listed
//  here but the backend never reads them — editing/saving them did nothing,
//  so they were removed rather than left as non-functional UI.
// =============================================================================
'use client';

import { useState } from 'react';

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
        background: 'rgba(30,30,30,0.3)',
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
              <button className="list-item-delete-btn" style={{ padding: '4px', fontSize: '10px' }} onClick={reset}>✕ Reset</button>
            )}
            <button
              className="list-item-delete-btn"
              style={{ padding: '4px', fontSize: '10px', color: editing ? 'var(--text-success)' : undefined }}
              onClick={() => {
                if (editing) save();
                else { setDraft(text); setEditing(true); }
              }}
            >
              {editing ? '✓ Save' : '✏️ Edit'}
            </button>
          </div>
        </div>

        {editing ? (
          <textarea
            value={draft ?? ''}
            onChange={e => setDraft(e.target.value)}
            placeholder="e.g. Always prefer async/await over callbacks. Never remove existing comments."
            style={{ width: '100%', minHeight: '120px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '8px', resize: 'vertical', boxSizing: 'border-box' }}
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
