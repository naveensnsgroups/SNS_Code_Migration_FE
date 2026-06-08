'use client';

import { useState, useEffect } from 'react';
import { Search, Eye, EyeOff, Plus, Trash2, Sliders, Cpu, Key, HelpCircle, Check, Settings } from 'lucide-react';

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
    defaultValue: ['claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-opus-4-6', 'claude-opus-4-5'],
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
    defaultValue: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
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
    defaultValue: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview'],
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
    defaultValue: ['grok-2', 'grok-2-mini'],
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
    defaultValue: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
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
    defaultValue: ['meta-llama/llama-3-70b-instruct', 'deepseek/deepseek-chat', 'mistralai/mixtral-8x7b-instruct'],
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
    defaultValue: ['meta-llama/Meta-Llama-3-70B-Instruct', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
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
            {['Anthropic', 'OpenAI', 'Google', 'Grok', 'Groq', 'OpenRouter', 'Hugging Face', 'General'].map(cat => {
              const count = filteredFields.filter(f => f.category === cat).length;
              if (searchQuery && count === 0) return null;
              
              return (
                <li
                  key={cat}
                  className={`settings-category-item ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  <span className="category-item-text">{cat}</span>
                  <span className="category-item-count">{count}</span>
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

                {/* 4. LIST TYPE */}
                {field.type === 'list' && (
                  <div className="settings-list-editor" style={{ maxWidth: '480px' }}>
                    {/* List Items */}
                    <div className="settings-list-items">
                      {(settings[field.id] || []).map((val: string, index: number) => (
                        <div key={index} className="settings-list-item-row">
                          <span className="list-item-value-text">{val}</span>
                          <button
                            type="button"
                            className="list-item-delete-btn"
                            onClick={() => handleRemoveValue(field.id, index)}
                            title="Remove Model"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Item row */}
                    <div className="settings-list-add-row">
                      <input
                        type="text"
                        className="form-input-premium settings-list-add-input"
                        placeholder="Add Value..."
                        value={newModelInputs[field.id] || ''}
                        onChange={(e) => setNewModelInputs({ ...newModelInputs, [field.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddValue(field.id);
                        }}
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
                )}

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
