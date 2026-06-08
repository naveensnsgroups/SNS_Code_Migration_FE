'use client';

import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { getFileIcon } from '../utils/labelProvider';

interface Props {
  legacyCode: string | null;
  modernCode: string | null;
  legacyFile: string | null;
  modernFile: string | null;
  onClose?: () => void;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <pre style={{
      margin: 0,
      padding: '12px 16px',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      lineHeight: '1.7',
      color: 'var(--text-primary)',
      whiteSpace: 'pre',
      overflow: 'auto',
    }}>
      {code.split('\n').map((line, i) => (
        <div key={i} style={{ display: 'flex', gap: '16px' }}>
          <span style={{ color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right', userSelect: 'none', flexShrink: 0 }}>
            {i + 1}
          </span>
          <span style={{ flex: 1 }}>{highlightLine(line)}</span>
        </div>
      ))}
    </pre>
  );
}

function highlightLine(line: string): React.ReactNode {
  // Simple keyword highlighting
  const parts = line.split(/(\/\/.*)|('.*?'|".*?"|`.*?`)|\b(const|let|var|function|class|import|export|from|return|async|await|if|else|for|while|try|catch|throw|new|this|typeof|interface|type|extends|implements|public|private|protected|static|readonly)\b|\b(\d+)\b/g);

  return parts.map((part, i) => {
    if (!part) return null;
    if (/^\/\//.test(part)) return <span key={i} style={{ color: '#6a9955' }}>{part}</span>;
    if (/^['"`]/.test(part)) return <span key={i} style={{ color: '#ce9178' }}>{part}</span>;
    if (/^(const|let|var|function|class|import|export|from|return|async|await|if|else|for|while|try|catch|throw|new|this|typeof|interface|type|extends|implements|public|private|protected|static|readonly)$/.test(part)) {
      return <span key={i} style={{ color: '#569cd6' }}>{part}</span>;
    }
    if (/^\d+$/.test(part)) return <span key={i} style={{ color: '#b5cea8' }}>{part}</span>;
    return <span key={i}>{part}</span>;
  });
}

export default function CodeViewer({ legacyCode, modernCode, legacyFile, modernFile, onClose }: Props) {
  if (!legacyCode && !modernCode) {
    return (
      <div className="editor-area">
        <div className="editor-tabs">
          <div className="editor-tab active">Welcome</div>
        </div>
        <div className="editor-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="editor-empty" style={{ textAlign: 'center' }}>
            <img 
              src="/agent_workbench_logo.png" 
              alt="Agent Workbench Logo" 
              style={{ width: '96px', height: '96px', opacity: 0.15, marginBottom: '16px', filter: 'grayscale(20%)' }} 
            />
            <div className="editor-empty__text" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Code Migration Platform
            </div>
            <div className="editor-empty__sub" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Select a file from the explorer or configure AI parameters to begin
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasValidLegacy = legacyCode && !legacyCode.startsWith('// Error reading');

  return (
    <div className="editor-area">
      <div className="editor-tabs">
        {legacyFile && legacyCode && hasValidLegacy && (
          <div className="editor-tab active">
            <span className="editor-tab__icon">{getFileIcon(legacyFile)}</span>
            <span className="editor-tab__name">{legacyFile.split('/').pop() ?? legacyFile}</span>
            {onClose && (
              <button
                className="editor-tab__close"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                title="Close file"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
        {modernFile && modernCode && (
          <div className="editor-tab active" style={{ borderTopColor: 'var(--text-success)' }}>
            <span className="editor-tab__icon" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {getFileIcon(modernFile)}
              <Sparkles size={10} style={{ color: 'var(--text-success)' }} />
            </span>
            <span className="editor-tab__name">{modernFile.split('/').pop() ?? modernFile} <span style={{ color: 'var(--text-success)', fontSize: '10px' }}>✦ Modern</span></span>
            {onClose && (
              <button
                className="editor-tab__close"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                title="Close file"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="editor-content">
        {legacyCode && hasValidLegacy && (
          <div className="editor-pane">
            <div className="editor-pane__label">
              Legacy — {legacyFile}
            </div>
            <CodeBlock code={legacyCode} />
          </div>
        )}
        {modernCode && (
          <div className={`editor-pane ${hasValidLegacy ? 'editor-pane--split' : ''}`} style={{ flex: 1 }}>
            <div className="editor-pane__label" style={{ color: 'var(--text-success)' }}>
              Modern — {modernFile || legacyFile}
            </div>
            <CodeBlock code={modernCode} />
          </div>
        )}
      </div>
    </div>
  );
}
