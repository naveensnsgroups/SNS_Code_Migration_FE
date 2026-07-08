// Model alias mapping (reasoning/fast/chat-model).
'use client';

import { Check } from 'lucide-react';

const ALIAS_DEFS = [
  { key: 'reasoning-model', label: 'reasoning-model (Default)', desc: 'Used by Planner + Analyzer agents for deep analysis.' },
  { key: 'fast-model',      label: 'fast-model (Default)',      desc: 'Used for lightweight classification and metadata tasks.' },
  { key: 'chat-model',      label: 'chat-model (Default)',      desc: 'Used for conversational chat and user-facing responses.' },
];

interface Props {
  aliases: Record<string, string>;
  /** Same model list computed in AIConfigTab, so this dropdown can't drift out of sync. */
  modelOptions: string[];
  onAliasChange: (key: string, value: string) => void;
}

export default function AliasesTab({ aliases, modelOptions, onAliasChange }: Props) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Model Alias Mapping</h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
        Bind logical system model aliases to target providers. Changes are saved to localStorage and sent with every migration start.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '500px' }}>
        {ALIAS_DEFS.map(alias => {
          const currentValue = aliases[alias.key] || '';
          // Show the saved value even if it's no longer in the live list, never hide it silently.
          const options = currentValue && !modelOptions.includes(currentValue)
            ? [currentValue, ...modelOptions]
            : modelOptions;

          return (
            <div key={alias.key} className="form-group">
              <label className="form-label">{alias.label}</label>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{alias.desc}</div>
              <select className="form-select-premium" value={currentValue} onChange={e => onAliasChange(alias.key, e.target.value)}>
                {options.length === 0 && <option value="">No models configured — add some in Settings</option>}
                {options.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-success)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Check size={12} /> Changes auto-saved to localStorage and applied on next migration start.
      </div>
    </div>
  );
}
