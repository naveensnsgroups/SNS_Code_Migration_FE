// GitHub Device-Flow sign-in dialog. Requests a device code, shows the
// user_code + a link to github.com/login/device, then polls until the user
// authorizes (or it expires). Styled like the ConfirmDialog / Theia dialogs.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Check, ExternalLink, Loader2, X } from 'lucide-react';
import GithubLogo from './icons/GithubLogo';
import { startGithubDeviceFlow, pollGithubDeviceFlow, type GithubPollResponse } from '@/services/api';
import type { GithubUser } from '@/components/AccountMenu';

interface Props {
  open: boolean;
  backendUrl: string;
  /** Optional override — normally unset; the backend ships its own default. */
  clientId?: string;
  onSuccess: (token: string, user: GithubUser) => void;
  onClose: () => void;
}

type Phase = 'starting' | 'awaiting' | 'error';

export default function GithubSignInDialog({ open, backendUrl, clientId, onSuccess, onClose }: Props) {
  const [phase, setPhase]         = useState<Phase>('starting');
  const [userCode, setUserCode]   = useState('');
  const [verifyUri, setVerifyUri] = useState('https://github.com/login/device');
  const [errorMsg, setErrorMsg]   = useState('');
  const [copied, setCopied]       = useState(false);

  // Poll loop is driven by a ref-held timer so it can be cancelled cleanly on
  // unmount / close without racing React state.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    cancelledRef.current = false;
    setPhase('starting');
    setErrorMsg('');
    setCopied(false);

    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const fail = (msg: string) => {
      if (cancelledRef.current) return;
      setErrorMsg(msg);
      setPhase('error');
    };

    const runPoll = (deviceCode: string, intervalMs: number) => {
      pollTimer = setTimeout(async () => {
        if (cancelledRef.current) return;
        let result: GithubPollResponse;
        try {
          result = await pollGithubDeviceFlow(backendUrl, deviceCode, clientId);
        } catch (e) {
          fail(e instanceof Error ? e.message : 'Polling failed.');
          return;
        }
        if (cancelledRef.current) return;

        switch (result.status) {
          case 'authorized':
            if (result.accessToken && result.user) {
              onSuccess(result.accessToken, {
                login: result.user.login,
                name:  result.user.name,
              });
            } else {
              fail('GitHub authorized but returned no token.');
            }
            return;
          case 'pending':
            runPoll(deviceCode, intervalMs);
            return;
          case 'slow_down':
            // GitHub asks us to back off — add 5s per its guidance.
            runPoll(deviceCode, intervalMs + 5000);
            return;
          case 'expired':
            fail('The code expired before you authorized. Close and try again.');
            return;
          case 'denied':
            fail('Authorization was denied on GitHub.');
            return;
          default:
            fail(result.error || 'GitHub sign-in failed.');
        }
      }, intervalMs);
    };

    (async () => {
      try {
        const device = await startGithubDeviceFlow(backendUrl, clientId);
        if (cancelledRef.current) return;
        setUserCode(device.userCode);
        setVerifyUri(device.verificationUri || 'https://github.com/login/device');
        setPhase('awaiting');
        runPoll(device.deviceCode, Math.max(device.interval, 1) * 1000);
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Failed to start GitHub sign-in.');
      }
    })();

    return () => {
      cancelledRef.current = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [open, backendUrl, clientId, onSuccess]);

  if (!open) return null;

  const copyCode = () => {
    navigator.clipboard?.writeText(userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* clipboard blocked — user can still read the code */ });
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-block" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <GithubLogo size={14} /> Sign in with GitHub
          </span>
          <button type="button" className="dialog-title__close" onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </div>

        <div className="dialog-content">
          {phase === 'starting' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={14} className="spin" /> Requesting a device code from GitHub…
            </div>
          )}

          {phase === 'awaiting' && (
            <>
              <p style={{ marginBottom: 12 }}>
                Enter this code on GitHub to authorize. This window will finish automatically once you approve.
              </p>
              <div className="github-code-row">
                <span className="github-code">{userCode}</span>
                <button type="button" className="github-code__copy" onClick={copyCode} title="Copy code">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--text-secondary)' }}>
                <Loader2 size={13} className="spin" /> Waiting for you to authorize on GitHub…
              </div>
            </>
          )}

          {phase === 'error' && (
            <div style={{ color: 'var(--text-error)' }}>{errorMsg}</div>
          )}
        </div>

        <div className="dialog-control">
          <button type="button" className="theia-button secondary" onClick={onClose}>
            {phase === 'error' ? 'Close' : 'Cancel'}
          </button>
          {phase === 'awaiting' && (
            <a
              className="theia-button main"
              href={verifyUri}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              <ExternalLink size={13} /> Open GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
