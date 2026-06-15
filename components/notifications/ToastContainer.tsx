// =============================================================================
//  components/notifications/ToastContainer.tsx
//
//  SNS IDE NotificationToastsComponent pattern.
//
//  - Fixed bottom-right, above status bar (bottom: 36px, right: 16px)
//  - Max 3 toasts (SNS IDE: toasts.slice(-3))
//  - Each toast has: type icon, message, close ×, auto-dismiss progress bar
//  - Slide-in animation from right
// =============================================================================
'use client';

import { useNotifications, NotificationEntry, NotificationType } from '@/context/NotificationContext';
import { X, Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

// ── Icon per type ─────────────────────────────────────────────────────────────
function ToastIcon({ type }: { type: NotificationType }) {
  const size = 14;
  switch (type) {
    case 'success': return <CheckCircle2  size={size} />;
    case 'warning': return <AlertTriangle size={size} />;
    case 'error':   return <AlertCircle  size={size} />;
    default:        return <Info          size={size} />;
  }
}

// ── Single Toast Card ─────────────────────────────────────────────────────────
function Toast({ entry }: { entry: NotificationEntry }) {
  const { dismissToast } = useNotifications();
  return (
    <div className={`sns-toast sns-toast--${entry.type}`} role="alert">
      <div className="sns-toast__icon">
        <ToastIcon type={entry.type} />
      </div>
      <div className="sns-toast__message">{entry.message}</div>
      <button
        className="sns-toast__close"
        onClick={() => dismissToast(entry.id)}
        title="Dismiss"
        aria-label="Dismiss notification"
      >
        <X size={12} />
      </button>
      {/* Progress bar — shrinks to 0 matching auto-dismiss timer */}
      {!entry.persistent && (
        <div
          className="sns-toast__progress"
          style={{ animationDuration: entry.type === 'warning' ? '6s' : entry.type === 'info' ? '5s' : '4s' }}
        />
      )}
    </div>
  );
}

// ── Toast Container ───────────────────────────────────────────────────────────
export default function ToastContainer() {
  const { toasts } = useNotifications();
  if (toasts.length === 0) return null;

  return (
    <div className="sns-toast-container" aria-live="polite" aria-label="Notifications">
      {toasts.map(entry => (
        <Toast key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
