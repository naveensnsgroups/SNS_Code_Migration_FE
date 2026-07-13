'use client';

// Monaco-backed read-only code viewer — the same editor engine SNS IDE (Theia)
// and VS Code use. Gives real TextMate syntax highlighting, gutter, folding,
// bracket matching and minimap, replacing the old hand-rolled regex highlighter.
//
// Monaco is self-hosted from /public/monaco/vs (copied from the monaco-editor
// package) so there's no CDN dependency — works offline and under Turbopack.

import React, { useEffect, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';

// Point the loader at our local copy instead of the default jsDelivr CDN.
// Guarded to the browser — this module is also evaluated during SSR.
if (typeof window !== 'undefined') {
  loader.config({ paths: { vs: '/monaco/vs' } });
}

// File extension → Monaco language id. Anything unmapped falls back to
// 'plaintext' (still rendered, just without token colors), which matches how
// VS Code treats a language it has no grammar for.
const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  java: 'java',
  py: 'python',
  cs: 'csharp',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  c: 'c', h: 'c',
  go: 'go',
  rb: 'ruby',
  php: 'php',
  rs: 'rust',
  kt: 'kotlin', kts: 'kotlin',
  swift: 'swift',
  scala: 'scala',
  sql: 'sql',
  json: 'json',
  xml: 'xml', xsd: 'xml', wsdl: 'xml', pom: 'xml',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', less: 'less',
  yml: 'yaml', yaml: 'yaml',
  md: 'markdown', markdown: 'markdown',
  sh: 'shell', bash: 'shell',
  vb: 'vb',
  ini: 'ini', properties: 'ini', env: 'ini',
  dockerfile: 'dockerfile',
  graphql: 'graphql', gql: 'graphql',
};

function languageFor(fileName: string | null): string {
  if (!fileName) return 'plaintext';
  const base = fileName.split('/').pop() ?? fileName;
  if (base.toLowerCase() === 'dockerfile') return 'dockerfile';
  const ext = base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
  return EXT_TO_LANG[ext] ?? 'plaintext';
}

// Our theme classes on <html> → Monaco's built-in themes, which ARE VS Code's
// default Light+/Dark+/High-Contrast themes.
function monacoThemeFromDocument(): string {
  if (typeof document === 'undefined') return 'vs-dark';
  const cls = document.documentElement.classList;
  if (cls.contains('theme-light')) return 'vs';
  if (cls.contains('theme-hc')) return 'hc-black';
  return 'vs-dark';
}

interface Props {
  code: string;
  fileName: string | null;
}

export default function MonacoCodeBlock({ code, fileName }: Props) {
  const [theme, setTheme] = useState<string>('vs-dark');

  // Sync Monaco's theme with the app theme, and keep it in sync when the user
  // switches themes in Settings (which toggles the class on <html>).
  useEffect(() => {
    setTheme(monacoThemeFromDocument());
    const observer = new MutationObserver(() => setTheme(monacoThemeFromDocument()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <Editor
        height="100%"
        theme={theme}
        language={languageFor(fileName)}
        value={code}
        loading={<div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Loading editor…</div>}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: true },
          fontSize: 12,
          fontFamily: 'var(--font-mono), monospace',
          lineHeight: 20,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          renderLineHighlight: 'line',
          guides: { indentation: true, bracketPairs: true },
          bracketPairColorization: { enabled: true },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          folding: true,
          wordWrap: 'off',
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        }}
      />
    </div>
  );
}
