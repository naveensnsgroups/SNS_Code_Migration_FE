// =============================================================================
//  hooks/useSettings.ts
//  Reads all user settings from localStorage in a single place.
//
//  Replaces duplicated localStorage reading in page.tsx (handleUpload, handleStart).
//
//  Usage:
//    const { backendUrl, provider, model, apiKey, allApiKeys } = useSettings();
// =============================================================================

import { useEffect, useState } from 'react';
import type { AIProvider } from '@/types';

const DEFAULT_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';


// ── Helper ────────────────────────────────────────────────────────────────────

function readStoredString(key: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return raw || fallback;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface AppSettings {
  backendUrl: string;
  provider: AIProvider;
  model: string;
  apiKey: string;
  localOutputPath: string;
  // Google-specific retry config
  googleMaxRetries: number;
  googleRetryDelayRateLimit: number;
  googleRetryDelayOther: number;
  googleTimeoutMs: number;
  // Mistral-specific retry config
  mistralMaxRetries: number;
  mistralRetryDelayRateLimit: number;
  mistralRetryDelayOther: number;
  allApiKeys: Record<string, string>;
  toolsConfig: Record<string, boolean>;
  aliasesConfig: Record<string, string>;
  promptFragments: Record<string, string>;
  /** User-supplied per-model $/1M-token rates. Empty unless the user configured
   *  one — never a hardcoded default. See TokensTab.tsx for the editor UI and
   *  the backend's agent-cost-estimator.ts for why this isn't a static table. */
  modelPricing: Record<string, { inputPerM: number; outputPerM: number; cacheWritePerM?: number; cacheReadPerM?: number }>;
}

export function useSettings(settingsTrigger = 0): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(() => readSettings());

  useEffect(() => {
    setSettings(readSettings());
  }, [settingsTrigger]);

  // Apply theme on mount and when settings change
  useEffect(() => {
    const theme = readStoredString('setting_general_theme', 'dark');
    document.documentElement.className = `theme-${theme}`;
  }, [settingsTrigger]);

  return settings;
}

/**
 * Pure function — reads all settings from localStorage.
 * Call this inside an effect or callback when you need fresh values.
 */
export function readSettings(): AppSettings {
  // Provider and model come ONLY from user Settings — no hardcoded fallbacks.
  // If not configured, empty string is returned; ActionButtons will block Start
  // and show a clear message telling the user to configure Settings first.
  const provider = readStoredString('setting_selected_provider', 'google') as AIProvider;
  const model    = readStoredString(`setting_${provider}_selected_model`, '');
  const apiKey   = readStoredString(`setting_${provider}_api_key`, '');

  return {
    backendUrl:      readStoredString('setting_general_backend_url', DEFAULT_BACKEND_URL),
    provider,
    model,
    apiKey,
    localOutputPath: readStoredString('setting_general_local_output_path', ''),
    googleMaxRetries: parseInt(readStoredString('setting_google_max_retries', '3'), 10),
    googleRetryDelayRateLimit: parseInt(readStoredString('setting_google_retry_delay_rate_limit', '60'), 10),
    googleRetryDelayOther: parseInt(readStoredString('setting_google_retry_delay_other', '-1'), 10),
    googleTimeoutMs: parseInt(readStoredString('setting_google_timeout_ms', '300000'), 10),
    mistralMaxRetries: parseInt(readStoredString('setting_mistral_max_retries', '3'), 10),
    mistralRetryDelayRateLimit: parseInt(readStoredString('setting_mistral_retry_delay_rate_limit', '60'), 10),
    mistralRetryDelayOther: parseInt(readStoredString('setting_mistral_retry_delay_other', '-1'), 10),
    allApiKeys: {
      anthropic:    readStoredString('setting_anthropic_api_key'),
      openai:       readStoredString('setting_openai_api_key'),
      google:       readStoredString('setting_google_api_key'),
      grok:         readStoredString('setting_grok_api_key'),
      groq:         readStoredString('setting_groq_api_key'),
      openrouter:   readStoredString('setting_openrouter_api_key'),
      mistral:      readStoredString('setting_mistral_api_key'),
      huggingface:  readStoredString('setting_huggingface_api_key'),
    },
    toolsConfig: (() => {
      try { return JSON.parse(localStorage.getItem('ai_config_tools') || '{}'); } catch { return {}; }
    })(),
    aliasesConfig: (() => {
      try { return JSON.parse(localStorage.getItem('ai_config_aliases') || '{}'); } catch { return {}; }
    })(),
    promptFragments: (() => {
      // Only 'system-agent-rules' is ever read by the backend (see FragmentsTab.tsx).
      const saved = localStorage.getItem('ai_prompt_fragment_system-agent-rules');
      const map: Record<string, string> = {};
      if (saved !== null) map['system-agent-rules'] = saved;
      return map;
    })(),
    modelPricing: (() => {
      try { return JSON.parse(localStorage.getItem('ai_config_model_pricing') || '{}'); } catch { return {}; }
    })(),
  };
}

/** Hook that returns just the backend URL and a refresher callback. */
export function useBackendUrl(settingsTrigger = 0): string {
  const [url, setUrl] = useState(DEFAULT_BACKEND_URL);

  useEffect(() => {
    setUrl(readStoredString('setting_general_backend_url', DEFAULT_BACKEND_URL));
  }, [settingsTrigger]);

  return url;
}
