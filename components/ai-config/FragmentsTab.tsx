// =============================================================================
//  components/ai-config/FragmentsTab.tsx
//  AIConfig sub-tab: Editable prompt fragments (save/reset per fragment)
// =============================================================================
'use client';

import { useState } from 'react';

const FRAGMENTS = [
  {
    id: 'system-agent-rules',
    title: 'system-agent-rules.md',
    type: 'Built-in',
    desc: 'Base agent instructions enforcing structured JSON outputs, zero preambles, and Markdown logging formats.',
    template: '# General System Prompt\nYou are an AI Modernisation planner agent...\nEnforce clean structures and correct types.',
  },
  {
    id: 'validation-rules-strict',
    title: 'validation-rules-strict.md',
    type: 'Built-in',
    desc: 'Strict error feedback loop template enforcing typescript compiler resolutions and zod parser bounds.',
    template: '# Strict Validation Prompt\nWhen fixing compilation errors, first write detailed explanations...\nFocus on type compatibility.',
  },
  {
    id: 'scanner-stack-detect',
    title: 'scanner-stack-detect.md',
    type: 'Built-in',
    desc: 'Parser mappings for lockfiles (package-lock, cargo.lock, go.mod) and file trees.',
    template: "# Scanner Prompt\nAnalyze imports and file extension frequencies...",
  },
];

const ALL_IDS = FRAGMENTS.map(f => f.id);

function readFragment(id: string, template: string): string {
  const saved = localStorage.getItem(`ai_prompt_fragment_${id}`);
  return saved !== null ? saved : template;
}

export default function FragmentsTab() {
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [drafts, setDrafts]         = useState<Record<string, string>>({});

  const isCustom    = (id: string) => localStorage.getItem(`ai_prompt_fragment_${id}`) !== null;
  const currentText = (id: string, template: string) => drafts[id] ?? readFragment(id, template);

  const saveFragment = (id: string) => {
    const draft = drafts[id];
    if (draft !== undefined) localStorage.setItem(`ai_prompt_fragment_${id}`, draft);
    setEditingId(null);
  };

  const resetFragment = (id: string, template: string) => {
    localStorage.removeItem(`ai_prompt_fragment_${id}`);
    setDrafts(prev => ({ ...prev, [id]: template }));
  };

  const resetAll = () => {
    ALL_IDS.forEach(id => localStorage.removeItem(`ai_prompt_fragment_${id}`));
    setDrafts({});
    setEditingId(null);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Prompt Variant Sets</h3>
        <button className="btn-premium btn-premium--secondary" style={{ width: 'auto', padding: '4px 10px', fontSize: '11px' }} onClick={resetAll}>
          Reset all prompt fragments
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {FRAGMENTS.map(frag => {
          const text     = currentText(frag.id, frag.template);
          const isEditing = editingId === frag.id;
          const custom   = isCustom(frag.id);

          return (
            <div key={frag.id} style={{
              background: 'rgba(30,30,30,0.3)',
              border: `1px solid ${custom ? 'rgba(78,201,176,0.3)' : 'var(--border-color)'}`,
              borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600 }}>{frag.title}</span>
                  <span style={{ fontSize: '9px', background: custom ? 'rgba(78,201,176,0.15)' : 'rgba(0,122,204,0.15)', color: custom ? 'var(--text-success)' : 'var(--text-info)', padding: '1px 5px', borderRadius: '3px' }}>
                    {custom ? 'Custom' : frag.type}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {custom && (
                    <button className="list-item-delete-btn" style={{ padding: '4px', fontSize: '10px' }} onClick={() => resetFragment(frag.id, frag.template)}>✕ Reset</button>
                  )}
                  <button
                    className="list-item-delete-btn"
                    style={{ padding: '4px', fontSize: '10px', color: isEditing ? 'var(--text-success)' : undefined }}
                    onClick={() => {
                      if (isEditing) {
                        saveFragment(frag.id);
                      } else {
                        setDrafts(prev => ({ ...prev, [frag.id]: text }));
                        setEditingId(frag.id);
                      }
                    }}
                  >
                    {isEditing ? '✓ Save' : '✏️ Edit'}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{frag.desc}</div>

              {isEditing ? (
                <textarea
                  value={text}
                  onChange={e => setDrafts(prev => ({ ...prev, [frag.id]: e.target.value }))}
                  style={{ width: '100%', minHeight: '120px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '8px', resize: 'vertical', boxSizing: 'border-box' }}
                />
              ) : (
                <details style={{ fontSize: '11px', cursor: 'pointer' }}>
                  <summary style={{ color: 'var(--text-info)', fontWeight: 500, outline: 'none' }}>View Prompt Template Text</summary>
                  <pre style={{ marginTop: '6px', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                    {text}
                  </pre>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
