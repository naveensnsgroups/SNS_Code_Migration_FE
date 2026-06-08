'use client';

import { DetectedStack, MigrationStatus, MigrationPhase, TargetStack, AIProvider, AI_PROVIDERS } from '@/types';
import { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  Play, 
  Pause, 
  Square, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  Database, 
  Terminal, 
  Settings, 
  Key, 
  Sparkles,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

interface Props {
  detectedStack: DetectedStack | null;
  status: MigrationStatus;
  phases: MigrationPhase[];
  progress: number;
  currentFile: string;
  onStart: (target: TargetStack) => void;
  onStop: () => void;
  onPause: () => void;
  settingsTrigger?: number;
  onSettingsSaved?: () => void;
  width?: number;
}

const FRAMEWORK_OPTIONS: Record<string, string[]> = {
  'Express.js':  ['Fastify', 'NestJS', 'Hono', 'Elysia'],
  'Flask':       ['FastAPI', 'Django', 'Starlette'],
  'Django':      ['FastAPI', 'Flask'],
  'Spring':      ['Quarkus', 'Micronaut', 'Spring Boot 3'],
  'Laravel':     ['Symfony', 'Slim'],
  'Rails':       ['Sinatra', 'Hanami'],
};

const DB_OPTIONS: Record<string, string[]> = {
  'MongoDB':    ['PostgreSQL', 'MySQL', 'SQLite'],
  'MySQL':      ['PostgreSQL', 'SQLite', 'MongoDB'],
  'PostgreSQL': ['MySQL', 'SQLite', 'MongoDB'],
  'SQLite':     ['PostgreSQL', 'MySQL'],
};

const LANG_OPTIONS: Record<string, string[]> = {
  'JavaScript': ['TypeScript'],
  'Python 2':   ['Python 3'],
  'Java 8':     ['Java 21'],
  'PHP 7':      ['PHP 8'],
};

const PROVIDER_COLORS: Record<AIProvider, string> = {
  anthropic: '#e57373', // Coral
  openai: '#10a37f',    // OpenAI Green
  google: '#4285f4',    // Google Blue
  grok: '#ffffff',      // xAI White/Silver
  groq: '#f55d2b',      // Groq Orange
  openrouter: '#0072f5', // OpenRouter Blue
  huggingface: '#ffac33', // Hugging Face Yellow
};

export default function AIPanel({
  detectedStack,
  status,
  phases,
  progress,
  currentFile,
  onStart,
  onStop,
  onPause,
  settingsTrigger = 0,
  onSettingsSaved,
  width,
}: Props) {
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [model, setModel] = useState(AI_PROVIDERS.anthropic.models[0]);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [targetFramework, setTargetFramework] = useState('');
  const [targetDb, setTargetDb] = useState('');
  const [targetLang, setTargetLang] = useState('');
  const [testFramework, setTestFramework] = useState('vitest');

  const isRunning = ['scanning', 'planning', 'pseudocode', 'migrating', 'building', 'validating', 'testing'].includes(status);
  const isIdle = status === 'idle';
  const isComplete = status === 'complete';

  const planPhaseDone = phases.find(p => p.id === 'plan')?.status === 'done';
  const buttonText = planPhaseDone ? 'Start Modernisation' : 'Start Stage-1 Analysis';

  const getStoredSetting = (key: string, defaultValue: any) => {
    if (typeof window === 'undefined') return defaultValue;
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch {
        return saved;
      }
    }
    return defaultValue;
  };

  const updateSettingValue = (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
    if (onSettingsSaved) onSettingsSaved();
  };

  // Synchronize settings from localStorage
  useEffect(() => {
    const storedProvider = getStoredSetting('setting_selected_provider', 'anthropic') as AIProvider;
    setProvider(storedProvider);

    const storedModel = getStoredSetting(`setting_${storedProvider}_selected_model`, AI_PROVIDERS[storedProvider].models[0]);
    setModel(storedModel);

    const storedApiKey = getStoredSetting(`setting_${storedProvider}_api_key`, '');
    setApiKey(storedApiKey);

    setTargetFramework(getStoredSetting('setting_target_framework', ''));
    setTargetDb(getStoredSetting('setting_target_database', ''));
    setTestFramework(getStoredSetting('setting_testing_framework', 'vitest'));
    setTargetLang(getStoredSetting('setting_target_lang', ''));
  }, [settingsTrigger]);

  // Sync state on provider change (internal or external)
  useEffect(() => {
    const defaultModel = AI_PROVIDERS[provider].models[0];
    const storedModel = getStoredSetting(`setting_${provider}_selected_model`, defaultModel);
    setModel(storedModel);

    const storedApiKey = getStoredSetting(`setting_${provider}_api_key`, '');
    setApiKey(storedApiKey);
  }, [provider]);

  // Check if at least one API key is set
  const hasApiKey = () => {
    if (apiKey.trim()) return true;
    if (typeof window === 'undefined') return false;
    
    const providers = ['anthropic', 'openai', 'google', 'grok'];
    for (const p of providers) {
      const saved = localStorage.getItem(`setting_${p}_api_key`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.trim()) return true;
        } catch {
          if (saved.trim()) return true;
        }
      }
    }
    return false;
  };

  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    updateSettingValue('setting_selected_provider', p);
    
    const defaultModel = AI_PROVIDERS[p].models[0];
    const savedModel = getStoredSetting(`setting_${p}_selected_model`, defaultModel);
    setModel(savedModel);
    
    const savedApiKey = getStoredSetting(`setting_${p}_api_key`, '');
    setApiKey(savedApiKey);
  };

  const handleModelChange = (m: string) => {
    setModel(m);
    updateSettingValue(`setting_${provider}_selected_model`, m);
  };

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    updateSettingValue(`setting_${provider}_api_key`, val);
  };

  const handleFrameworkChange = (val: string) => {
    setTargetFramework(val);
    updateSettingValue('setting_target_framework', val);
  };

  const handleDbChange = (val: string) => {
    setTargetDb(val);
    updateSettingValue('setting_target_database', val);
  };

  const handleTestFrameworkChange = (val: string) => {
    setTestFramework(val);
    updateSettingValue('setting_testing_framework', val);
  };

  const handleStart = () => {
    onStart({
      provider,
      model,
      framework: targetFramework || (detectedStack ? FRAMEWORK_OPTIONS[detectedStack.framework]?.[0] ?? '' : ''),
      database: targetDb || (detectedStack ? DB_OPTIONS[detectedStack.database]?.[0] ?? '' : ''),
      language: targetLang || (detectedStack ? LANG_OPTIONS[detectedStack.language]?.[0] ?? detectedStack.language : ''),
      testFramework,
      outputMode: 'direct',
    });
  };

  const phaseIcon = (s: MigrationPhase['status']) => {
    switch (s) {
      case 'done':
        return <CheckCircle2 className="phase-item__icon-svg text-success" size={14} />;
      case 'active':
        return <RefreshCw className="phase-item__icon-svg spin text-blue" size={14} />;
      case 'error':
        return <AlertCircle className="phase-item__icon-svg text-error" size={14} />;
      default:
        return <div className="phase-item__icon-dot" />;
    }
  };

  return (
    <aside className="ai-panel" style={{ width: width ? `${width}px` : undefined }}>
      <div className="ai-panel__header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>Operational Panel</span>
      </div>
      <div className="ai-panel__body">

        {/* Section 1: Detected Stack */}
        <div className="ai-section">
          <div className="ai-section__title">
            <Cpu size={12} />
            <span>Detected Stack</span>
          </div>
          {detectedStack ? (
            <div className="stack-badge-premium">
              <div className="stack-badge-grid">
                <div className="badge-pill">
                  <span className="badge-pill__label">Language</span>
                  <span className="badge-pill__value lang-color">{detectedStack.language}</span>
                </div>
                <div className="badge-pill">
                  <span className="badge-pill__label">Framework</span>
                  <span className="badge-pill__value fw-color">{detectedStack.framework}</span>
                </div>
                <div className="badge-pill">
                  <span className="badge-pill__label">Database</span>
                  <span className="badge-pill__value db-color">{detectedStack.database}</span>
                </div>
                <div className="badge-pill">
                  <span className="badge-pill__label">Files Count</span>
                  <span className="badge-pill__value files-color">{detectedStack.fileCount}</span>
                </div>
              </div>

              {/* Architectural Layers Analysis */}
              <div className="architectural-layers" style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#858585', marginBottom: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.5px' }}>
                  <Database size={10} style={{ color: '#007acc' }} />
                  <span>Layer Analysis</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="layer-item" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#858585' }}>Frontend (Client)</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{detectedStack.frontend || 'Not Detected'}</span>
                  </div>
                  <div className="layer-item" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#858585' }}>API / Bridge Layer</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{detectedStack.apiLayer || 'Not Detected'}</span>
                  </div>
                  <div className="layer-item" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#858585' }}>Backend (Server)</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{detectedStack.backend || 'Not Detected'}</span>
                  </div>
                  <div className="layer-item" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#858585' }}>Database (Storage)</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{detectedStack.databaseLayer || 'Not Detected'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="stack-badge-empty">
              <FolderOpen size={16} />
              <span>Select legacy project directory to detect stack</span>
            </div>
          )}
        </div>



        {/* Section 3: Target Stack Config */}
        {detectedStack && planPhaseDone && (
          <div className="ai-section">
            <div className="ai-section__title">
              <Terminal size={12} />
              <span>Target Configuration</span>
            </div>

            <div className="form-group">
              <label className="form-label">Target Framework</label>
              <select className="form-select-premium" value={targetFramework} onChange={e => handleFrameworkChange(e.target.value)} disabled={isRunning}>
                <option value="">Auto-detect best mapping</option>
                {(FRAMEWORK_OPTIONS[detectedStack.framework] ?? []).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target Database</label>
              <select className="form-select-premium" value={targetDb} onChange={e => handleDbChange(e.target.value)} disabled={isRunning}>
                <option value="">Keep current database adapter</option>
                {(DB_OPTIONS[detectedStack.database] ?? []).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Testing Framework</label>
              <select className="form-select-premium" value={testFramework} onChange={e => handleTestFrameworkChange(e.target.value)} disabled={isRunning}>
                {['vitest', 'jest', 'mocha', 'pytest', 'junit'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Section 4: Progress Panel */}
        {isRunning && (
          <div className="ai-section progress-section-premium">
            <div className="progress-header">
              <span>Modernisation Pipeline</span>
              <span className="progress-percentage">{progress}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill-premium" style={{ width: `${progress}%` }} />
            </div>
            {currentFile && (
              <div className="progress-current-file">
                <span className="pulse-indicator" />
                <span className="file-name-text">Processing: {currentFile}</span>
              </div>
            )}
          </div>
        )}

        {/* Section 5: Phase Badges */}
        {(isRunning || isComplete) && (
          <div className="ai-section">
            <div className="ai-section__title">
              <span>Pipeline Stages</span>
            </div>
            <div className="phase-list-premium">
              {phases.map(p => (
                <div key={p.id} className={`phase-item-premium ${p.status}`}>
                  <span className="phase-item-icon-wrapper">{phaseIcon(p.status)}</span>
                  <span className="phase-item-label-text">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 6: Action Buttons */}
        <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(isIdle || isComplete) && (
            <button
              className="btn-premium btn-premium--primary"
              onClick={handleStart}
              disabled={!detectedStack || !hasApiKey()}
            >
              <Play size={13} />
              <span>{buttonText}</span>
            </button>
          )}
          {isRunning && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn-premium btn-premium--secondary" 
                onClick={onPause}
                style={{ flex: 1 }}
              >
                <Pause size={13} />
                <span>Pause</span>
              </button>
              <button 
                className="btn-premium btn-premium--danger" 
                onClick={onStop}
                style={{ flex: 1 }}
              >
                <Square size={12} />
                <span>Stop</span>
              </button>
            </div>
          )}
          {status === 'paused' && (
            <button className="btn-premium btn-premium--primary" onClick={handleStart}>
              <Play size={13} />
              <span>Resume Migration</span>
            </button>
          )}
        </div>

        {isComplete && (
          <div className="completion-badge-premium">
            <CheckCircle2 size={16} />
            <span>Modernisation process succeeded!</span>
          </div>
        )}

      </div>
    </aside>
  );
}
