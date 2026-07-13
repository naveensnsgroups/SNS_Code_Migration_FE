// Bottom-left account popover — mirrors SNS IDE / Theia's ACCOUNTS_MENU
// (common-frontend-contribution.ts addBottomMenu). Signed-out shows a
// "Sign in with GitHub" action; signed-in shows the account + Sign out.
'use client';

import { useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import GithubLogo from '@/components/icons/GithubLogo';

export interface GithubUser {
  login: string;
  name?: string;
}

interface Props {
  open: boolean;
  user: GithubUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

export default function AccountMenu({ open, user, onSignIn, onSignOut, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on outside click / Escape — standard popover behaviour.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} className="account-menu" role="menu">
      {user ? (
        <>
          <div className="account-menu__header">
            <span className="account-menu__avatar account-menu__avatar--fallback">
              <GithubLogo size={15} />
            </span>
            <div className="account-menu__id">
              <span className="account-menu__name">{user.name || user.login}</span>
              <span className="account-menu__login">@{user.login} · GitHub</span>
            </div>
          </div>
          <button type="button" className="account-menu__item" onClick={onSignOut} role="menuitem">
            <LogOut size={14} /> Sign out
          </button>
        </>
      ) : (
        <>
          <div className="account-menu__empty">Not signed in</div>
          <button type="button" className="account-menu__item account-menu__item--primary" onClick={onSignIn} role="menuitem">
            <GithubLogo size={14} /> Sign in with GitHub
          </button>
        </>
      )}
    </div>
  );
}
