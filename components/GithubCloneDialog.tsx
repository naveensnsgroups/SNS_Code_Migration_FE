// "Clone from GitHub" — the repo-import counterpart to "Open Folder" in the
// Explorer welcome view. Public repos need no sign-in; private repos use
// whatever GitHub account is already connected (bottom-left Account menu).
'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import GithubLogo from './icons/GithubLogo';

interface Props {
  open: boolean;
  isSignedIn: boolean;
  onClone: (repoUrl: string, branch?: string) => Promise<void>;
  onClose: () => void;
}

export default function GithubCloneDialog({ open, isSignedIn, onClone, onClose }: Props) {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch]   = useState('');
  const [cloning, setCloning] = useState(false);
  const [error, setError]     = useState('');

  if (!open) return null;

  const handleClone = async () => {
    const trimmed = repoUrl.trim();
    if (!trimmed) { setError('Enter a repository URL.'); return; }
    setError('');
    setCloning(true);
    try {
      await onClone(trimmed, branch.trim() || undefined);
      // Success closes via the parent (it also switches to the file tree view).
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clone repository.');
      setCloning(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={() => !cloning && onClose()}>
      <div className="dialog-block" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <GithubLogo size={14} /> Clone from GitHub
          </span>
          <button type="button" className="dialog-title__close" onClick={onClose} title="Close" disabled={cloning}>
            <X size={14} />
          </button>
        </div>

        <div className="dialog-content">
          <div className="form-group">
            <label className="form-label" htmlFor="github-clone-url">Repository URL</label>
            <input
              id="github-clone-url"
              type="text"
              className="form-select-premium"
              style={{ fontFamily: 'var(--font-mono)' }}
              placeholder="https://github.com/owner/repo or owner/repo"
              value={repoUrl}
              disabled={cloning}
              onChange={e => setRepoUrl(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="github-clone-branch">Branch (optional)</label>
            <input
              id="github-clone-branch"
              type="text"
              className="form-select-premium"
              style={{ fontFamily: 'var(--font-mono)' }}
              placeholder="defaults to the repository's default branch"
              value={branch}
              disabled={cloning}
              onChange={e => setBranch(e.target.value)}
            />
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {isSignedIn
              ? 'Signed in to GitHub — private repositories you have access to can be cloned too.'
              : 'Not signed in — only public repositories can be cloned. Sign in (bottom-left) for private repos.'}
          </div>

          {error && <div style={{ marginTop: 10, color: 'var(--text-error)', fontSize: '12px' }}>{error}</div>}
        </div>

        <div className="dialog-control">
          <button type="button" className="theia-button secondary" onClick={onClose} disabled={cloning}>
            Cancel
          </button>
          <button type="button" className="theia-button main" onClick={handleClone} disabled={cloning}>
            {cloning ? <><Loader2 size={13} className="spin" style={{ marginRight: 6 }} />Cloning…</> : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  );
}
