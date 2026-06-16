// =============================================================================
//  context/NotificationContext.tsx
//
//  SNS IDE-faithful notification context.
//  Mirrors: packages/messages/src/browser/notifications-manager.ts
//
//  Two stores (exactly like NotificationManager):
//    toasts   — bottom-right, max 3 visible, auto-dismiss
//    history  — full list shown in Notification Center (newest first)
//
//  visibilityState: 'hidden' | 'toasts' | 'center'  (SNS IDE pattern)
// =============================================================================
'use client';

import {
  createContext, useContext, useCallback, useRef, useState, ReactNode,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationEntry {
  id:         string;
  type:       NotificationType;
  message:    string;
  timestamp:  number;
  persistent: boolean;   // true → no auto-dismiss  (SNS IDE: actions.length > 0)
  read:       boolean;
}

export interface NotifyOptions {
  type:        NotificationType;
  message:     string;
  persistent?: boolean;  // errors are always persistent
  timeout?:    number;   // ms override
}

// SNS IDE visibilityState
type VisibilityState = 'hidden' | 'toasts' | 'center';

interface NotificationContextValue {
  toasts:             NotificationEntry[];   // max 3, SNS IDE: toasts.slice(-3)
  history:            NotificationEntry[];   // full list, newest first
  unreadCount:        number;
  visibilityState:    VisibilityState;
  centerOpen:         boolean;
  notify:             (opts: NotifyOptions) => void;
  dismissToast:       (id: string) => void;
  dismissFromHistory: (id: string) => void;
  toggleCenter:       () => void;
  closeCenter:        () => void;
  markAllRead:        () => void;
  clearAll:           () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ── Timeout per type (SNS IDE default 5000ms preference) ──────────────────────

function autoTimeout(type: NotificationType): number {
  switch (type) {
    case 'error':   return 0;      // always persistent
    case 'warning': return 6000;
    case 'success': return 4000;
    case 'info':    return 5000;
  }
}

let _seq = 0;
const uid = () => `notif-${Date.now()}-${++_seq}`;

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts,           setToasts]           = useState<NotificationEntry[]>([]);
  const [history,          setHistory]          = useState<NotificationEntry[]>([]);
  const [visibilityState,  setVisibilityState]  = useState<VisibilityState>('hidden');
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── dismiss one toast ───────────────────────────────────────────────────────
  const dismissToast = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setToasts(prev => {
      const next = prev.filter(n => n.id !== id);
      // SNS IDE: when last toast dismissed → back to hidden
      if (next.length === 0) setVisibilityState('hidden');
      return next;
    });
  }, []);

  // ── remove from history ─────────────────────────────────────────────────────
  const dismissFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(n => n.id !== id));
  }, []);

  // ── post a new notification ─────────────────────────────────────────────────
  const notify = useCallback((opts: NotifyOptions) => {
    const id         = uid();
    const persistent = opts.persistent ?? opts.type === 'error';
    const entry: NotificationEntry = {
      id, type: opts.type, message: opts.message,
      timestamp: Date.now(), persistent, read: false,
    };

    // Add to history (newest first, cap at 100)
    setHistory(prev => [entry, ...prev].slice(0, 100));

    // Add to toasts — SNS IDE: toasts.slice(-3)
    setToasts(prev => {
      const next = [...prev, entry].slice(-3);
      return next;
    });

    // Update visibilityState → 'toasts' (SNS IDE pattern)
    setVisibilityState(prev => prev === 'center' ? 'center' : 'toasts');

    // Auto-dismiss
    const ms = persistent ? 0 : (opts.timeout ?? autoTimeout(opts.type));
    if (ms > 0) {
      const timer = setTimeout(() => {
        dismissToast(id);
      }, ms);
      timers.current.set(id, timer);
    }
  }, [dismissToast]);

  // ── center toggle / close ───────────────────────────────────────────────────
  const toggleCenter = useCallback(() => {
    setVisibilityState(prev => {
      if (prev === 'center') {
        // SNS IDE: hide → also clear toasts from view
        setToasts([]);
        return 'hidden';
      }
      return 'center';
    });
  }, []);

  const closeCenter = useCallback(() => {
    setVisibilityState('hidden');
    setToasts([]);
  }, []);

  // ── mark all read ───────────────────────────────────────────────────────────
  const markAllRead = useCallback(() => {
    setHistory(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // ── clear all ───────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    timers.current.forEach(t => clearTimeout(t));
    timers.current.clear();
    setToasts([]);
    setHistory([]);
    setVisibilityState('hidden');
  }, []);

  const centerOpen    = visibilityState === 'center';
  const unreadCount   = history.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      toasts, history, unreadCount, visibilityState, centerOpen,
      notify, dismissToast, dismissFromHistory,
      toggleCenter, closeCenter, markAllRead, clearAll,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}
