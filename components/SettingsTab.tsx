'use client';

import { useState, useEffect } from 'react';
import { Search, Eye, EyeOff, Plus, Trash2, Sliders, HelpCircle, Check, Settings } from 'lucide-react';
import { DEFAULT_PROVIDER_MODELS } from '@/constants/models';

interface SettingField {
  id: string;
  category: string;
  label: string;
  description: string;
  type: 'string' | 'password' | 'list' | 'boolean' | 'select';
  defaultValue: any;
  options?: { label: string; value: string }[];
}

const SETTING_FIELDS: SettingField[] = [
  {
    id: 'anthropic_api_key',
    category: 'Anthropic',
    label: 'Anthropic Api Key',
    description: 'Enter the API Key for your official Anthropic Claude account. By using this preference, the key is saved securely in your browser local storage.',
    type: 'password',
    defaultValue: '',
  },
  {
    id: 'anthropic_models',
    category: 'Anthropic',
    label: 'Anthropic Models',
    description: 'List of official and custom Anthropic Claude models available for code modernization.',
    type: 'list',
    defaultValue: DEFAULT_PROVIDER_MODELS.anthropic,
  },
  {
    id: 'openai_api_key',
    category: 'OpenAI',
    label: 'OpenAI Api Key',
    description: 'Enter the API Key for your OpenAI GPT developer account. This key is used to execute chat completions and code writers.',
    type: 'password',
    defaultValue: '',
  },
  {
    id: 'openai_models',
    category: 'OpenAI',
    label: 'OpenAI Models',
    description: 'List of official OpenAI GPT models available for modernization loops.',
    type: 'list',
    defaultValue: DEFAULT_PROVIDER_MODELS.openai,
  },
  {
    id: 'google_api_key',
    category: 'Google',
    label: 'Google Api Key',
    description: 'Enter the Google Gemini developer API Key. Make sure the Gemini API is enabled in your Google Cloud console.',
    type: 'password',
    defaultValue: '',
  },
  {
    id: 'google_models',
    category: 'Google',
    label: 'Google Models',
    description: 'Google Gemini generative models registered for scanning and conversions.',
    type: 'list',
    defaultValue: DEFAULT_PROVIDER_MODELS.google,
  },
  {
    id: 'google_max_retries',
    category: 'Google',
    label: 'Max Retries On Errors',
    description: 'Maximum number of retries in case of request errors. If smaller than 1, then the retry logic is disabled.',
    type: 'string',
    defaultValue: '3',
  },
  {
    id: 'google_retry_delay_rate_limit',
    category: 'Google',
    label: 'Retry Delay On Rate Limit Error',
    description: 'Delay in seconds between retries in case of rate limit errors (429 Too Many Requests).',
    type: 'string',
    defaultValue: '60',
  },
  {
    id: 'google_retry_delay_other',
    category: 'Google',
    label: 'Retry Delay On Other Errors',
    description: 'Delay in seconds between retries in case of other errors (syntax, 500, timeouts). Set to -1 to disable retries in these cases.',
    type: 'string',
    defaultValue: '-1',
  },
  {
    id: 'grok_api_key',
    category: 'Grok',
    label: 'Grok (xAI) Api Key',
    description: 'Enter the API Key for your xAI Grok developer account.',
    type: 'password',
    defaultValue: '',
  },
  {
    id: 'grok_models',
    category: 'Grok',
    label: 'Grok Models',
    description: 'List of Grok models available for code modernization.',
    type: 'list',
    defaultValue: DEFAULT_PROVIDER_MODELS.grok,
  },
  {
    id: 'groq_api_key',
    category: 'Groq',
    label: 'Groq Api Key',
    description: 'Enter the API Key for your official Groq developer account.',
    type: 'password',
    defaultValue: '',
  },
  {
    id: 'groq_models',
    category: 'Groq',
    label: 'Groq Models',
    description: 'List of official Groq models available for code modernization.',
    type: 'list',
    defaultValue: DEFAULT_PROVIDER_MODELS.groq,
  },
  {
    id: 'openrouter_api_key',
    category: 'OpenRouter',
    label: 'OpenRouter Api Key',
    description: 'Enter the API Key for your OpenRouter developer account.',
    type: 'password',
    defaultValue: '',
  },
  {
    id: 'openrouter_models',
    category: 'OpenRouter',
    label: 'OpenRouter Models',
    description: 'List of OpenRouter models available for code modernization.',
    type: 'list',
    defaultValue: DEFAULT_PROVIDER_MODELS.openrouter,
  },
  {
    id: 'mistral_api_key',
    category: 'Mistral',
    label: 'Mistral Api Key',
    description: 'Enter the API Key for your official Mistral AI (La Plateforme) account. Supports mistral-large, mistral-small, and codestral models.',
    type: 'password',
    defaultValue: '',
  },
  {
    id: 'mistral_models',
    category: 'Mistral',
    label: 'Mistral Models',
    description: 'List of Mistral AI models available for code modernization. codestral-latest is recommended for code-heavy migrations.',
    type: 'list',
    defaultValue: DEFAULT_PROVIDER_MODELS.mistral,
  },
  {
    id: 'mistral_max_retries',
    category: 'Mistral',
    label: 'Max Retries On Errors',
    description: 'Maximum number of retries in case of request errors. If smaller than 1, then the retry logic is disabled.',
    type: 'string',
    defaultValue: '3',
  },
  {
    id: 'mistral_retry_delay_rate_limit',
    category: 'Mistral',
    label: 'Retry Delay On Rate Limit Error',
    description: 'Delay in seconds between retries in case of rate limit errors (429 Too Many Requests).',
    type: 'string',
    defaultValue: '60',
  },
  {
    id: 'mistral_retry_delay_other',
    category: 'Mistral',
    label: 'Retry Delay On Other Errors',
    description: 'Delay in seconds between retries in case of other errors (syntax, 500, timeouts). Set to -1 to disable retries in these cases.',
    type: 'string',
    defaultValue: '-1',
  },
  {
    id: 'huggingface_api_key',
    category: 'Hugging Face',
    label: 'Hugging Face Api Key',
    description: 'Enter the API Token for your Hugging Face account.',
    type: 'password',
    defaultValue: '',
  },
  {
    id: 'huggingface_models',
    category: 'Hugging Face',
    label: 'Hugging Face Models',
    description: 'List of Hugging Face models available for code modernization.',
    type: 'list',
    defaultValue: DEFAULT_PROVIDER_MODELS.huggingface,
  },
  {
    id: 'general_backend_url',
    category: 'General',
    label: 'Backend API Service URL',
    description: 'The target port and host address of the running Express code migration server engine.',
    type: 'string',
    defaultValue: 'http://localhost:4000',
  },
  {
    id: 'general_local_output_path',
    category: 'General',
    label: 'Local Output Workspace Path',
    description: 'Specify an absolute local path on your computer where the modernized project files and reports should be written directly (e.g. E:\\Naveen\\modernized-app). If blank, they are saved inside the backend sessions folder.',
    type: 'string',
    defaultValue: '',
  },
  {
    id: 'general_telemetry',
    category: 'General',
    label: 'Enable Anonymous Telemetry',
    description: 'Transmit anonymous telemetry statistics to improve model translation and repair patterns.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'general_theme',
    category: 'General',
    label: 'Color Theme',
    description: 'Select the color theme of the editor workspace interface.',
    type: 'select',
    defaultValue: 'dark',
    options: [
      { label: 'Dark (Visual Studio)', value: 'dark' },
      { label: 'Light (Visual Studio)', value: 'light' },
      { label: 'High Contrast', value: 'hc' },
    ],
  },
];

interface Props {
  onSettingsSaved?: () => void;
  onClose?: () => void;
  settingsTrigger?: number;
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
    const providers = ['anthropic', 'openai', 'google', 'grok', 'groq', 'openrouter', 'mistral', 'huggingface'];
    const sel: Record<string, string> = {};
    for (const p of providers) {
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

  // Save changes for a field
  const updateSetting = (id: string, value: any) => {
    const updated = { ...settings, [id]: value };
    setSettings(updated);
    localStorage.setItem(`setting_${id}`, JSON.stringify(value));
    
    // Trigger callback
    if (onSettingsSaved) onSettingsSaved();
    
    setSaveStatus('Settings updated');
    setTimeout(() => setSaveStatus(null), 1500);
  };

  const handleAddValue = (fieldId: string) => {
    const val = newModelInputs[fieldId]?.trim();
    if (!val) return;

    const list = [...(settings[fieldId] || [])];
    if (!list.includes(val)) {
      list.push(val);
      updateSetting(fieldId, list);
    }
    setNewModelInputs({ ...newModelInputs, [fieldId]: '' });
  };

  const handleRemoveValue = (fieldId: string, index: number) => {
    const list = [...(settings[fieldId] || [])];
    list.splice(index, 1);
    updateSetting(fieldId, list);
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
              ✕
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
              const isActiveProvider = catToProvider[cat] === activeProvider;

              return (
                <li
                  key={cat}
                  className={`settings-category-item ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  <span className="category-item-text">{cat}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isActiveProvider && (
                      <span style={{
                        fontSize: '9px', fontWeight: 700, color: 'var(--accent-green)',
                        background: 'rgba(0,200,100,0.12)', border: '1px solid rgba(0,200,100,0.3)',
                        borderRadius: '3px', padding: '1px 4px', letterSpacing: '0.3px',
                      }}>ACTIVE</span>
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
              {/* Field Breadcrumb */}
              <div className="field-block__breadcrumb">
                Ai-features › {field.category} › {field.label}
              </div>

              {/* Field Description */}
              <div className="field-block__description">
                {field.description}
              </div>

              {/* Render Field Input based on type */}
              <div className="field-block__input-area">
                {/* 1. PASSWORD TYPE */}
                {field.type === 'password' && (
                  <div className="input-with-button" style={{ maxWidth: '480px' }}>
                    <input
                      type={showKeys[field.id] ? 'text' : 'password'}
                      className="form-input-premium settings-text-input"
                      placeholder="key not set (uses env variable fallback)"
                      value={settings[field.id] || ''}
                      onChange={(e) => updateSetting(field.id, e.target.value)}
                    />
                    <button
                      type="button"
                      className="input-visibility-toggle"
                      onClick={() => setShowKeys({ ...showKeys, [field.id]: !showKeys[field.id] })}
                    >
                      {showKeys[field.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                )}

                {/* 2. STRING TYPE */}
                {field.type === 'string' && (
                  <input
                    type="text"
                    className="form-input-premium settings-text-input"
                    style={{ maxWidth: '480px' }}
                    value={settings[field.id] || ''}
                    onChange={(e) => updateSetting(field.id, e.target.value)}
                  />
                )}

                {/* 3. BOOLEAN TYPE */}
                {field.type === 'boolean' && (
                  <div 
                    className="toggle-switch" 
                    onClick={() => updateSetting(field.id, !settings[field.id])}
                    style={{ cursor: 'pointer' }}
                  >
                    <input 
                      type="checkbox" 
                      checked={!!settings[field.id]} 
                      onChange={() => {}} 
                    />
                    <span className="toggle-slider"></span>
                  </div>
                )}

                {/* 4. LIST TYPE — model list with click-to-select active model */}
                {field.type === 'list' && (() => {
                  // Derive provider name from field id: 'google_models' → 'google'
                  const provider = field.id.replace('_models', '');
                  const activeModel = selectedModels[provider] ?? '';

                  const handleSelectModel = (model: string) => {
                    // Save the active model for this provider
                    const key = `setting_${provider}_selected_model`;
                    localStorage.setItem(key, JSON.stringify(model));
                    setSelectedModels(prev => ({ ...prev, [provider]: model }));

                    // ── AUTO-SWITCH PROVIDER ────────────────────────────────────
                    // Clicking a model in any provider's list makes that provider
                    // the ACTIVE provider for the next migration run.
                    localStorage.setItem('setting_selected_provider', JSON.stringify(provider));
                    setActiveProvider(provider); // ← update sidebar badge instantly

                    if (onSettingsSaved) onSettingsSaved();
                    setSaveStatus(`Active provider → ${provider}  ·  model → ${model}`);
                    setTimeout(() => setSaveStatus(null), 3000);
                  };

                  return (
                    <div className="settings-list-editor" style={{ maxWidth: '480px' }}>
                      {/* Active model indicator — single line, no duplication with list highlight */}
                      <div style={{
                        fontSize: '11px',
                        color: activeModel ? 'var(--accent-green)' : 'var(--text-warning)',
                        marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px'
                      }}>
                        {activeModel
                          ? <><Check size={11} /><span>Click a model below to select it as active</span></>
                          : <><HelpCircle size={11} /><span>Click a model below to select it as active</span></>}
                      </div>

                      {/* List Items */}
                      <div className="settings-list-items">
                        {(settings[field.id] || []).map((val: string, index: number) => {
                          const isActive = val === activeModel;
                          return (
                            <div
                              key={index}
                              className="settings-list-item-row"
                              style={{
                                cursor: 'pointer',
                                background: isActive ? 'rgba(0,200,100,0.08)' : undefined,
                                border: isActive ? '1px solid rgba(0,200,100,0.25)' : undefined,
                                borderRadius: isActive ? '4px' : undefined,
                              }}
                              onClick={() => handleSelectModel(val)}
                              title={`Click to set "${val}" as active model`}
                            >
                              {/* Active indicator dot */}
                              <span style={{
                                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                background: isActive ? 'var(--accent-green)' : 'var(--border-color)',
                                display: 'inline-block', marginRight: '8px',
                              }} />
                              <span className="list-item-value-text" style={{ flex: 1, fontWeight: isActive ? 600 : 400 }}>
                                {val}
                              </span>
                              {isActive && <Check size={12} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />}
                              <button
                                type="button"
                                className="list-item-delete-btn"
                                onClick={(e) => { e.stopPropagation(); handleRemoveValue(field.id, index); }}
                                title="Remove Model"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Item row */}
                      <div className="settings-list-add-row">
                        <input
                          type="text"
                          className="form-input-premium settings-list-add-input"
                          placeholder="Add Value..."
                          value={newModelInputs[field.id] || ''}
                          onChange={(e) => setNewModelInputs({ ...newModelInputs, [field.id]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddValue(field.id); }}
                        />
                        <button
                          type="button"
                          className="settings-list-add-btn"
                          onClick={() => handleAddValue(field.id)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 5. SELECT TYPE */}
                {field.type === 'select' && (
                  <div className="select-container" style={{ maxWidth: '240px' }}>
                    <select
                      className="form-select-premium"
                      value={settings[field.id] || field.defaultValue}
                      onChange={(e) => updateSetting(field.id, e.target.value)}
                    >
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
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
