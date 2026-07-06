// =============================================================================
//  constants/models.ts
//  SINGLE source of truth for the per-provider "seed" model lists shown in
//  Settings, and for the alias/agent model dropdowns elsewhere.
//
//  Before this file existed, the same seed list was independently hardcoded
//  in three places (SettingsTab.tsx, AIConfigTab.tsx, AliasesTab.tsx) with
//  different naming schemes ("claude-sonnet-4-6" vs "anthropic/claude-sonnet-4-6")
//  and no guarantee they stayed in sync. These are still hardcoded defaults —
//  the backend has no "list available models" endpoint — but now there is
//  exactly ONE place to update them.
//
//  Users can freely add/remove models per provider in Settings; those
//  customizations are stored separately (setting_<provider>_models) and take
//  priority over this seed list wherever it's consumed as a fallback.
// =============================================================================

import type { AIProvider } from '@/types';

export const DEFAULT_PROVIDER_MODELS: Record<AIProvider, string[]> = {
  anthropic:   ['claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-opus-4-6', 'claude-opus-4-5'],
  openai:      ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  google:      ['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemma-4-26b-a4b-it'],
  grok:        ['grok-2', 'grok-2-mini'],
  groq:        ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
  openrouter:  ['meta-llama/llama-3-70b-instruct', 'deepseek/deepseek-chat', 'mistralai/mixtral-8x7b-instruct'],
  mistral:     ['codestral-latest', 'mistral-large-latest', 'mistral-small-latest', 'devstral-latest'],
  huggingface: ['meta-llama/Meta-Llama-3-70B-Instruct', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
};

/** Flattened "provider/model" strings for every default model, across all providers. */
export function getAllDefaultModelOptions(): string[] {
  return (Object.keys(DEFAULT_PROVIDER_MODELS) as AIProvider[]).flatMap(provider =>
    DEFAULT_PROVIDER_MODELS[provider].map(model => `${provider}/${model}`)
  );
}

/**
 * Recommended starting alias map — derived from DEFAULT_PROVIDER_MODELS so it
 * can never drift from the seed list above. Only used the very first time a
 * user opens Model Aliases before they've customized anything.
 */
export function getDefaultAliases(): Record<string, string> {
  const anthropicDefault = `anthropic/${DEFAULT_PROVIDER_MODELS.anthropic[0]}`;
  const openaiDefault    = `openai/${DEFAULT_PROVIDER_MODELS.openai[1] ?? DEFAULT_PROVIDER_MODELS.openai[0]}`;
  return {
    'reasoning-model': anthropicDefault,
    'fast-model':      openaiDefault,
    'chat-model':      anthropicDefault,
  };
}
