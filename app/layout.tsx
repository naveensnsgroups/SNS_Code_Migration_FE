import type { Metadata } from 'next';
import './globals.css';
import 'file-icons-js/css/style.css';
import ClientProviders from '@/components/ClientProviders';
import { THEME_CLASSES } from '@/utils/theme';

export const metadata: Metadata = {
  title: 'Code Migration Platform',
  description: 'Autonomous legacy-to-modern code migration powered by AI',
  icons: {
    icon: '/favicon.png',
  }
};

// Applies the saved theme class to <html> before the page paints — must run as a
// plain blocking <script> in <head>, not a React effect. useEffect only runs AFTER
// the browser's first paint, so the page would flash the default dark theme (or
// vice versa) for a frame on every refresh before JS caught up and switched it.
//
// layout.tsx is a Server Component (runs in Node at build/request time), so the
// real THEME_CLASSES mapping is imported and baked into the script below via
// JSON.stringify — a single source of truth, not a hand-copied duplicate that
// could silently drift from utils/theme.ts.
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var THEME_CLASSES = ${JSON.stringify(THEME_CLASSES)};
    var raw = localStorage.getItem('setting_general_theme');
    var theme = raw ? JSON.parse(raw) : 'dark';
    var cls = THEME_CLASSES[theme];
    if (cls) document.documentElement.classList.add(cls);
  } catch (e) {}
})();
`;

// suppressHydrationWarning below: the theme-init script intentionally adds a class
// to <html> before React hydrates (that's the whole point — it must run pre-paint
// to avoid a flash of the wrong theme). This tells React that a mismatch on THIS
// element's attributes is expected, not a real bug — the same fix used by every
// theme-flash-prevention script (e.g. next-themes).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}

