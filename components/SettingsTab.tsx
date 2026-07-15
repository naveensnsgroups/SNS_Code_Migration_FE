'use client';

import { useState, useEffect, useRef, type ComponentType } from 'react';
import { Search, Sliders, Check, Settings, X } from 'lucide-react';
import { ALL_PROVIDERS } from '@/constants/models';
import { SETTING_FIELDS, type SettingField } from '@/constants/settingFields';
import { applyTheme } from '@/utils/theme';
import { useNotifications } from '@/context/NotificationContext';
import PasswordField   from '@/components/settings/PasswordField';
import StringField     from '@/components/settings/StringField';
import BooleanToggle   from '@/components/settings/BooleanToggle';
import SelectField     from '@/components/settings/SelectField';
import ModelListEditor from '@/components/settings/ModelListEditor';
import {
  AnthropicLogo, OpenAILogo, GoogleGeminiLogo, GrokLogo, GroqLogo,
  OpenRouterLogo, MistralLogo, HuggingFaceLogo,
} from '@/components/icons/ProviderLogos';

// Provider category name -> its logo component. "General" has no provider logo.
const CATEGORY_LOGO: Record<string, ComponentType<{ size?: number }>> = {
  'Anthropic':    AnthropicLogo,
  'OpenAI':       OpenAILogo,
  'Google':       GoogleGeminiLogo,
  'Grok':         GrokLogo,
  'Groq':         GroqLogo,
  'OpenRouter':   OpenRouterLogo,
  'Mistral':      MistralLogo,
  'Hugging Face': HuggingFaceLogo,
};

interface Props {
  onSettingsSaved?: () => void;
  onClose?: () => void;
  settingsTrigger?: number;
}

// Builds a concise, Theia-style confirmation message for a committed setting.
// Pure (params only) → module-level so it isn't recreated each render.
function messageForField(field: SettingField, value: any): string {
  switch (field.id) {
    case 'general_theme': {
      const label = field.options?.find(o => o.value === value)?.label ?? value;
      return `Color theme changed to ${label}`;
    }
    case 'general_backend_url':
      return 'Backend API service URL updated';
    case 'general_local_output_path':
      return value ? 'Output workspace path updated' : 'Output workspace path cleared';
    case 'general_desktop_notifications':
      return value ? 'Desktop notifications enabled' : 'Desktop notifications disabled';
  }
  if (field.type === 'password')
    return value ? `${field.category} API key saved` : `${field.category} API key cleared`;
  return `${field.label} updated`;
}

export default function SettingsTab({ onSettingsSaved, onClose, settingsTrigger }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeScope, setActiveScope] = useState<'user' | 'workspace'>('user');
  const [activeCategory, setActiveCategory] = useState<string>('Anthropic');
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newModelInputs, setNewModelInputs] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  // Tracks the active selected model per provider: { google: 'gemini-2.0-flash', ... }
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  // Tracks which provider is currently active (set when user clicks a model in any provider's list)
  const [activeProvider, setActiveProvider] = useState<string>('');
  // Providers referenced by a per-agent "Override Model" pick (AI Config → Agents) —
  // these are genuinely doing work for that agent too, alongside (or instead of)
  // whichever provider is the plain default above.
  const [agentOverrideProviders, setAgentOverrideProviders] = useState<Set<string>>(new Set());

  // SNS IDE-style notifications on setting changes (toast + history).
  const { notify } = useNotifications();
  // Value captured when a text/password field gains focus — so blur only notifies
  // if the value actually changed (no toast storm on every focus/blur).
  const focusValueRef = useRef<Record<string, string>>({});

  // Load settings from localStorage
  useEffect(() => {
    const loadedSettings: Record<string, any> = {};
    SETTING_FIELDS.forEach(field => {
      const saved = localStorage.getItem(`setting_${field.id}`);
      if (saved !== null) {
        try {
          loadedSettings[field.id] = JSON.parse(saved);
        } catch {
          loadedSettings[field.id] = saved;
        }
      } else {
        loadedSettings[field.id] = field.defaultValue;
      }
    });
    setSettings(loadedSettings);

    // Load selected model per provider from localStorage
    const sel: Record<string, string> = {};
    for (const p of ALL_PROVIDERS) {
      const raw = localStorage.getItem(`setting_${p}_selected_model`);
      if (raw) {
        try { sel[p] = JSON.parse(raw); } catch { sel[p] = raw; }
      }
    }
    setSelectedModels(sel);

    // Load active provider from localStorage
    const raw = localStorage.getItem('setting_selected_provider');
    if (raw) {
      try { setActiveProvider(JSON.parse(raw)); } catch { setActiveProvider(raw); }
    } else {
      setActiveProvider('google'); // default
    }

    // Load per-agent overrides (AI Config → Agents → Override Model) and collect
    // every provider they point at. A saved selectedModel is only a real override
    // when it's a "provider/model" string (see AgentsTab's modelOptions / handleUpdateModel) —
    // an alias identifier like "alias:reasoning-model" is just the unset default
    // shown for display and doesn't pin a specific provider on its own.
    const overrideProviders = new Set<string>();
    try {
      const agentOverrides: Record<string, { selectedModel?: string }> =
        JSON.parse(localStorage.getItem('ai_config_agents') || '{}');
      Object.values(agentOverrides).forEach(entry => {
        const value = entry?.selectedModel;
        const slash = value?.indexOf('/') ?? -1;
        if (value && slash > 0) overrideProviders.add(value.slice(0, slash));
      });
    } catch {}
    setAgentOverrideProviders(overrideProviders);
  }, [settingsTrigger]);

  // Filter settings based on query
  const filteredFields = SETTING_FIELDS.filter(field => {
    const text = `${field.category} ${field.label} ${field.description}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  // Unique categories in search result
  const availableCategories = Array.from(
    new Set(filteredFields.map(f => f.category))
  );

  // Auto-switch category if current is not in search
  useEffect(() => {
    if (searchQuery && availableCategories.length > 0 && !availableCategories.includes(activeCategory)) {
      setActiveCategory(availableCategories[0]);
    }
  }, [searchQuery, activeCategory, availableCategories]);

  // Save changes for a field. `emitNotification` is opt-in so text/password fields
  // (which call this on every keystroke) can stay silent and notify on blur instead.
  const updateSetting = (id: string, value: any, emitNotification = false) => {
    const updated = { ...settings, [id]: value };
    setSettings(updated);
    localStorage.setItem(`setting_${id}`, JSON.stringify(value));

    if (id === 'general_theme') applyTheme(value);

    // Trigger callback
    if (onSettingsSaved) onSettingsSaved();

    setSaveStatus('Settings updated');
    setTimeout(() => setSaveStatus(null), 1500);

    if (emitNotification) {
      const field = SETTING_FIELDS.find(f => f.id === id);
      if (field) notify({ type: 'success', message: messageForField(field, value) });
    }
  };

  const handleAddValue = (fieldId: string) => {
    const val = newModelInputs[fieldId]?.trim();
    if (!val) return;

    const list = [...(settings[fieldId] || [])];
    if (!list.includes(val)) {
      list.push(val);
      updateSetting(fieldId, list);
      const field = SETTING_FIELDS.find(f => f.id === fieldId);
      notify({ type: 'success', message: `Model "${val}" added${field ? ` to ${field.category}` : ''}` });
    }
    setNewModelInputs({ ...newModelInputs, [fieldId]: '' });
  };

  const handleRemoveValue = (fieldId: string, index: number) => {
    const list = [...(settings[fieldId] || [])];
    const removed = list[index];
    list.splice(index, 1);
    updateSetting(fieldId, list);
    if (removed) notify({ type: 'info', message: `Model "${removed}" removed` });
  };

  const handleSelectModel = (field: SettingField, model: string) => {
    // Derive provider name from field id: 'google_models' → 'google'
    const provider = field.id.replace('_models', '');

    // Save the active model for this provider
    const key = `setting_${provider}_selected_model`;
    localStorage.setItem(key, JSON.stringify(model));
    setSelectedModels(prev => ({ ...prev, [provider]: model }));

    // Clicking a model makes its provider the active one for the next run.
    localStorage.setItem('setting_selected_provider', JSON.stringify(provider));
    setActiveProvider(provider); // ← update sidebar badge instantly

    if (onSettingsSaved) onSettingsSaved();
    setSaveStatus(`Active provider → ${provider}  ·  model → ${model}`);
    setTimeout(() => setSaveStatus(null), 3000);

    notify({ type: 'success', message: `Default model set to ${model} (${field.category})` });
  };

  // Text/password fields: capture value on focus, notify on blur only if it changed.
  const handleTextFocus = (field: SettingField) => {
    focusValueRef.current[field.id] = settings[field.id] || '';
  };
  const handleTextBlur = (field: SettingField) => {
    const current = settings[field.id] || '';
    if (current !== (focusValueRef.current[field.id] ?? '')) {
      notify({ type: 'success', message: messageForField(field, current) });
    }
  };

  // Boolean toggles. 'general_desktop_notifications' needs special handling: the
  // browser's Notification.requestPermission() must be called synchronously from
  // within a real click handler (a user gesture) — calling it later from an effect
  // gets silently ignored or auto-denied by most browsers. So permission is
  // requested right here, at the moment of the click, and the setting is only
  // ever turned on if the user actually granted it — never left showing "on"
  // while permission was denied.
  const handleBooleanToggle = (field: SettingField) => {
    const turningOn = !settings[field.id];

    if (field.id === 'general_desktop_notifications' && turningOn) {
      if (typeof Notification === 'undefined') {
        notify({ type: 'warning', message: 'This browser does not support desktop notifications.' });
        return;
      }
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          updateSetting(field.id, true, true);
        } else {
          notify({ type: 'warning', message: 'Desktop notifications were not enabled — permission denied.' });
        }
      });
      return; // Don't flip the setting until the permission promise resolves.
    }

    updateSetting(field.id, turningOn, true);
  };

  return (
    <div className="editor-area settings-editor-page">
      {/* Settings Top Bar */}
      <div className="settings-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={15} style={{ color: 'var(--accent-blue)' }} />
          <span className="settings-title">Settings</span>
          {onClose && (
            <button className="settings-close" onClick={onClose} title="Close Settings">
              <X size={13} />
            </button>
          )}
        </div>
        {saveStatus && (
          <div className="settings-save-alert">
            <Check size={12} />
            <span>{saveStatus}</span>
          </div>
        )}
      </div>

      {/* Settings Navigation and Query Input */}
      <div className="settings-sub-header">
        <div className="settings-search-wrapper">
          <input
            type="text"
            className="form-input-premium settings-search-input"
            placeholder="Search settings (e.g. key, models, url)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={14} className="settings-search-icon" />
          <span className="settings-results-count">
            {filteredFields.length} Settings Found
          </span>
        </div>

        <div className="settings-scope-tabs">
          <button
            className={`settings-scope-tab ${activeScope === 'user' ? 'active' : ''}`}
            onClick={() => setActiveScope('user')}
          >
            User
          </button>
          <button
            className={`settings-scope-tab ${activeScope === 'workspace' ? 'active' : ''}`}
            onClick={() => setActiveScope('workspace')}
          >
            Workspace
          </button>
        </div>
      </div>

      {/* Settings Main Content Area */}
      <div className="settings-content-wrapper">

        {/* Categories Sidebar (Left) */}
        <div className="settings-sidebar">
          <div className="settings-sidebar__title">
            <Sliders size={12} />
            <span>AI Features ({filteredFields.length})</span>
          </div>
          <ul className="settings-category-list">
            {['Anthropic', 'OpenAI', 'Google', 'Grok', 'Groq', 'OpenRouter', 'Mistral', 'Hugging Face', 'General'].map(cat => {
              const count = filteredFields.filter(f => f.category === cat).length;
              if (searchQuery && count === 0) return null;

              // Map category display name → provider key (for activeProvider comparison)
              const catToProvider: Record<string, string> = {
                'Anthropic': 'anthropic', 'OpenAI': 'openai', 'Google': 'google',
                'Grok': 'grok', 'Groq': 'groq', 'OpenRouter': 'openrouter',
                'Mistral': 'mistral', 'Hugging Face': 'huggingface',
              };
              const provider = catToProvider[cat];
              // Two independent reasons a provider can be doing real work, and both
              // can be true for different providers at once: it's the plain fallback
              // (activeProvider) used by every agent with no override, and/or at least
              // one agent in AI Config → Agents has an explicit Override Model pointed
              // at it. Showing only one badge for the single activeProvider was
              // misleading once per-agent overrides existed — e.g. the Scanner
              // overridden to Google while everything else defaults to Anthropic used
              // to leave Google looking unused here.
              const isDefaultProvider = provider === activeProvider;
              const isAgentOverrideProvider = agentOverrideProviders.has(provider);

              return (
                <li
                  key={cat}
                  className={`settings-category-item ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  <span className="category-item-text" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    {CATEGORY_LOGO[cat] && (() => { const Logo = CATEGORY_LOGO[cat]; return <Logo size={16} />; })()}
                    {cat}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isDefaultProvider && (
                      // Solid green chip with white text — a fixed status color so it
                      // reads on a normal row, the blue selected row, and in every theme
                      // (the old faint-green-on-faint-green vanished on the selected row).
                      <span style={{
                        fontSize: '9px', fontWeight: 700, color: '#ffffff',
                        background: '#1a7f37', border: '1px solid #1a7f37',
                        borderRadius: '3px', padding: '1px 5px', letterSpacing: '0.4px',
                      }}>DEFAULT</span>
                    )}
                    {isAgentOverrideProvider && (
                      // Separate blue chip — this provider is pinned by at least one
                      // agent's own Override Model, independent of the global default.
                      <span style={{
                        fontSize: '9px', fontWeight: 700, color: '#ffffff',
                        background: '#0969da', border: '1px solid #0969da',
                        borderRadius: '3px', padding: '1px 5px', letterSpacing: '0.4px',
                      }}>AGENT</span>
                    )}
                    <span className="category-item-count">{count}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Form Fields Viewer (Right) */}
        <div className="settings-fields-pane">
          {filteredFields.filter(f => f.category === activeCategory).map(field => (
            <div key={field.id} className="settings-field-block">
              {/* Field Breadcrumb — muted path, prominent current setting (VS Code style) */}
              <div className="field-block__breadcrumb">
                <span className="field-block__crumb">Ai-features</span>
                <span className="field-block__crumb-sep">›</span>
                <span className="field-block__crumb" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  {CATEGORY_LOGO[field.category] && (() => { const Logo = CATEGORY_LOGO[field.category]; return <Logo size={13} />; })()}
                  {field.category}
                </span>
                <span className="field-block__crumb-sep">›</span>
                <span className="field-block__crumb-current">{field.label}</span>
              </div>

              {/* Field Description */}
              <div className="field-block__description">
                {field.description}
              </div>

              {/* Render Field Input based on type */}
              <div className="field-block__input-area">
                {field.type === 'password' && (
                  <PasswordField
                    value={settings[field.id] || ''}
                    visible={!!showKeys[field.id]}
                    onChange={(v) => updateSetting(field.id, v)}
                    onToggleVisible={() => setShowKeys({ ...showKeys, [field.id]: !showKeys[field.id] })}
                    onFocus={() => handleTextFocus(field)}
                    onBlur={() => handleTextBlur(field)}
                  />
                )}

                {field.type === 'string' && (
                  <StringField
                    value={settings[field.id] || ''}
                    onChange={(v) => updateSetting(field.id, v)}
                    onFocus={() => handleTextFocus(field)}
                    onBlur={() => handleTextBlur(field)}
                  />
                )}

                {field.type === 'boolean' && (
                  <BooleanToggle
                    checked={!!settings[field.id]}
                    onToggle={() => handleBooleanToggle(field)}
                  />
                )}

                {field.type === 'list' && (
                  <ModelListEditor
                    values={settings[field.id] || []}
                    activeModel={selectedModels[field.id.replace('_models', '')] ?? ''}
                    newModelInput={newModelInputs[field.id] || ''}
                    onSelectModel={(model) => handleSelectModel(field, model)}
                    onRemoveValue={(index) => handleRemoveValue(field.id, index)}
                    onNewModelInputChange={(v) => setNewModelInputs({ ...newModelInputs, [field.id]: v })}
                    onAddValue={() => handleAddValue(field.id)}
                  />
                )}

                {field.type === 'select' && (
                  <SelectField
                    value={settings[field.id] || field.defaultValue}
                    options={field.options || []}
                    onChange={(v) => updateSetting(field.id, v, true)}
                  />
                )}
              </div>
            </div>
          ))}

          {filteredFields.filter(f => f.category === activeCategory).length === 0 && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
              No settings match your search filters in this category.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
