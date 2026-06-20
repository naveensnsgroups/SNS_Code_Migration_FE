// =============================================================================
//  components/ai-config/AliasesTab.tsx
//  AIConfig sub-tab: Model alias mapping (reasoning/fast/chat-model)
// =============================================================================
'use client';

const ALIAS_DEFS = [
  { key: 'reasoning-model', label: 'reasoning-model (Default)', desc: 'Used by Planner + Analyzer agents for deep analysis.' },
  { key: 'fast-model',      label: 'fast-model (Default)',      desc: 'Used for lightweight classification and metadata tasks.' },
  { key: 'chat-model',      label: 'chat-model (Default)',      desc: 'Used for conversational chat and user-facing responses.' },
];

interface Props {
  aliases: Record<string, string>;
  onAliasChange: (key: string, value: string) => void;
}

export default function AliasesTab({ aliases, onAliasChange }: Props) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Model Alias Mapping</h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
        Bind logical system model aliases to target providers. Changes are saved to localStorage and sent with every migration start.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '500px' }}>
        {ALIAS_DEFS.map(alias => (
          <div key={alias.key} className="form-group">
            <label className="form-label">{alias.label}</label>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{alias.desc}</div>
            <select className="form-select-premium" value={aliases[alias.key] || ''} onChange={e => onAliasChange(alias.key, e.target.value)}>
              <optgroup label="Anthropic">
                <option value="anthropic/claude-opus-4">anthropic/claude-opus-4</option>
                <option value="anthropic/claude-sonnet-4-5">anthropic/claude-sonnet-4-5</option>
                <option value="anthropic/claude-3-5-sonnet-20241022">anthropic/claude-3-5-sonnet-20241022</option>
                <option value="anthropic/claude-3-haiku-20240307">anthropic/claude-3-haiku-20240307</option>
              </optgroup>
              <optgroup label="OpenAI">
                <option value="openai/gpt-4o">openai/gpt-4o</option>
                <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
              </optgroup>
              <optgroup label="Google">
                <option value="google/gemini-2.0-flash">google/gemini-2.0-flash</option>
                <option value="google/gemini-1.5-pro">google/gemini-1.5-pro</option>
                <option value="google/gemini-1.5-flash">google/gemini-1.5-flash</option>
              </optgroup>
              <optgroup label="Groq">
                <option value="groq/llama3-70b-8192">groq/llama3-70b-8192</option>
              </optgroup>
              <optgroup label="Mistral">
                <option value="mistral/codestral-latest">mistral/codestral-latest</option>
                <option value="mistral/mistral-large-latest">mistral/mistral-large-latest</option>
                <option value="mistral/mistral-small-latest">mistral/mistral-small-latest</option>
                <option value="mistral/devstral-latest">mistral/devstral-latest</option>
              </optgroup>
            </select>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-success)', marginTop: '4px' }}>
        ✓ Changes auto-saved to localStorage and applied on next migration start.
      </div>
    </div>
  );
}
