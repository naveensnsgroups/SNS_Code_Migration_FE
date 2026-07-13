// Applies the 'general_theme' setting ('dark' | 'light' | 'hc') to <html>,
// matching the :root.theme-light / :root.theme-hc selectors in globals.css.

// Exported so app/layout.tsx's pre-hydration init script can import the real
// mapping (at build/server time) instead of hand-duplicating it — one source
// of truth, no risk of the two drifting out of sync.
export const THEME_CLASSES: Record<string, string> = {
  light: 'theme-light',
  hc: 'theme-hc',
};

export function applyTheme(theme: string) {
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-hc');
  const cls = THEME_CLASSES[theme];
  if (cls) root.classList.add(cls);
}

export function getStoredTheme(): string {
  const raw = localStorage.getItem('setting_general_theme');
  if (!raw) return 'dark';
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
