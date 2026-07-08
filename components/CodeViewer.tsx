'use client';

import React from 'react';
import { X, Sparkles, Download } from 'lucide-react';
import { getFileIcon } from '../utils/labelProvider';
import MonacoCodeBlock from './MonacoCodeBlock';

interface Props {
  legacyCode: string | null;
  modernCode: string | null;
  legacyFile: string | null;
  modernFile: string | null;
  onClose?: () => void;
  onDownload?: (fileName: string) => void;
}

// Only files the backend actually produces — otherwise the download button appears for
// a file that can never exist.
const DOWNLOADABLE_FILES = ['Stage1_Analysis.md'];

export default function CodeViewer({ legacyCode, modernCode, legacyFile, modernFile, onClose, onDownload }: Props) {
  const fileName = legacyFile?.split('/').pop() ?? legacyFile ?? '';
  const isDownloadable = DOWNLOADABLE_FILES.includes(fileName) && !!onDownload;
  // Use explicit null checks, not truthiness: an empty (0-byte) file has content
  // '' which is falsy — treating that as "no file" would keep the Welcome screen
  // up and make empty files impossible to open.
  if (legacyCode === null && modernCode === null) {
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
              style={{
                width: '112px',
                height: '112px',
                opacity: 0.95,
                marginBottom: '20px',
                filter: 'drop-shadow(0 0 24px rgba(0, 122, 204, 0.35))',
              }}
            />
            <div
              className="editor-empty__text"
              style={{
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
              }}
            >
              Code Migration Platform
            </div>
            <div className="editor-empty__sub" style={{ fontSize: '13px', color: 'var(--text-primary)', opacity: 0.7, marginTop: '8px' }}>
              Select a file from the explorer or configure AI parameters to begin
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasValidLegacy = legacyCode !== null && !legacyCode.startsWith('// Error reading');

  return (
    <div className="editor-area">
      <div className="editor-tabs">
        {legacyFile && hasValidLegacy && (
          <div className="editor-tab active">
            <span className="editor-tab__icon">{getFileIcon(legacyFile)}</span>
            <span className="editor-tab__name">{legacyFile.split('/').pop() ?? legacyFile}</span>
            {isDownloadable && (
              <button
                className="editor-tab__close"
                onClick={() => onDownload!(fileName)}
                title={`Download ${fileName}`}
                style={{ color: 'var(--text-success)' }}
              >
                <Download size={12} />
              </button>
            )}
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
        {modernFile && modernCode !== null && (
          <div className="editor-tab active" style={{ borderTopColor: 'var(--text-success)' }}>
            <span className="editor-tab__icon" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {getFileIcon(modernFile)}
              <Sparkles size={10} style={{ color: 'var(--text-success)' }} />
            </span>
            <span className="editor-tab__name">{modernFile.split('/').pop() ?? modernFile} <span style={{ color: 'var(--text-success)', fontSize: '10px' }}>Modern</span></span>
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
        {hasValidLegacy && (
          <div className="editor-pane">
            <div className="editor-pane__label">
              Legacy — {legacyFile}
            </div>
            <MonacoCodeBlock code={legacyCode!} fileName={legacyFile} />
          </div>
        )}
        {modernCode !== null && (
          <div className={`editor-pane ${hasValidLegacy ? 'editor-pane--split' : ''}`} style={{ flex: 1 }}>
            <div className="editor-pane__label" style={{ color: 'var(--text-success)' }}>
              Modern — {modernFile || legacyFile}
            </div>
            <MonacoCodeBlock code={modernCode} fileName={modernFile || legacyFile} />
          </div>
        )}
      </div>
    </div>
  );
}
