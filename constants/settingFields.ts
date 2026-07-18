// General settings schema — the Settings tab now only covers workspace-level
// preferences. Provider/API-key/model configuration was removed once the
// backend became webhook-driven and no longer needs client-supplied keys.
import { DEFAULT_BACKEND_URL } from '@/hooks/useSettings';

export interface SettingField {
  id: string;
  category: string;
  label: string;
  description: string;
  type: 'string' | 'boolean' | 'select';
  defaultValue: any;
  options?: { label: string; value: string }[];
}

export const SETTING_FIELDS: SettingField[] = [
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
  {
    id: 'general_backend_url',
    category: 'General',
    label: 'Backend API Service URL',
    description: 'The target port and host address of the running code migration server engine.',
    type: 'string',
    defaultValue: DEFAULT_BACKEND_URL,
  },
  {
    id: 'general_agentbuilder_webhook_url',
    category: 'General',
    label: 'AgentBuilder Webhook Base URL',
    description: 'Base URL of your AgentBuilder webhooks (e.g. https://api.agents.snsihub.ai/webhook) — no agent path on the end. Each agent\'s own path is appended automatically (the Scanner Agent button posts to /api/scanner-agent). Separate from the Backend API Service URL above, which handles everything else (session polling, file content, etc).',
    type: 'string',
    defaultValue: '',
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
    id: 'general_desktop_notifications',
    category: 'General',
    label: 'Desktop Notifications for Checkpoints',
    description: 'Show a native OS notification when a migration reaches a checkpoint (Stage 1 complete, awaiting graph review, error) while this tab isn\'t focused. Requires browser permission.',
    type: 'boolean',
    defaultValue: false,
  },
  {
    id: 'general_github_client_id',
    category: 'General',
    label: 'GitHub OAuth App Client ID (Override)',
    description: '"Sign in with GitHub" (bottom-left) already works with no setup, using this platform\'s own default OAuth App. Only set this if you are self-hosting and want GitHub sign-in to use YOUR OWN OAuth App (Device Flow enabled) instead of the platform default. Leave blank otherwise.',
    type: 'string',
    defaultValue: '',
  },
];
