// Single source of truth for per-provider seed model lists (the backend has no
// "list available models" endpoint). Users can override per-provider in Settings.

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

/** Single source of truth for the list of supported provider IDs — derive from here, never re-hardcode. */
export const ALL_PROVIDERS: AIProvider[] = Object.keys(DEFAULT_PROVIDER_MODELS) as AIProvider[];

/** Flattened "provider/model" strings for every default model, across all providers. */
export function getAllDefaultModelOptions(): string[] {
  return (Object.keys(DEFAULT_PROVIDER_MODELS) as AIProvider[]).flatMap(provider =>
    DEFAULT_PROVIDER_MODELS[provider].map(model => `${provider}/${model}`)
  );
}

/** Starting alias map before the user customizes anything — derived so it can't drift from the seed list. */
export function getDefaultAliases(): Record<string, string> {
  const anthropicDefault = `anthropic/${DEFAULT_PROVIDER_MODELS.anthropic[0]}`;
  const openaiDefault    = `openai/${DEFAULT_PROVIDER_MODELS.openai[1] ?? DEFAULT_PROVIDER_MODELS.openai[0]}`;
  return {
    'reasoning-model': anthropicDefault,
    'fast-model':      openaiDefault,
    'chat-model':      anthropicDefault,
  };
}
