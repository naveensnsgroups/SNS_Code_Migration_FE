// =============================================================================
//  components/notifications/NotificationToasts.tsx
//
//  SNS IDE faithful — mirrors:
//    packages/messages/src/browser/notification-toasts-component.tsx
//    packages/messages/src/browser/notification-component.tsx
//
//  Layout (exactly SNS IDE):
//    ┌──────────────────────────────────────────┐
//    │ [icon]  message text               [×]   │
//    │ ▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ← timer│
//    └──────────────────────────────────────────┘
//  - Bottom-right, above status bar (bottom: 30px, right: 16px)
//  - Width: 500px (SNS IDE: width: 500px)
//  - Max 3 toasts (SNS IDE: toasts.slice(-3))
//  - Each toast has box-shadow + border like SNS IDE .theia-notification-list-item
// =============================================================================
'use client';

import { useNotifications, NotificationEntry, NotificationType } from '@/context/NotificationContext';

// ── Codicon-style SVG icons (matches SNS IDE's codicon icon set) ──────────────
// SNS IDE: codicon('info'), codicon('warning'), codicon('error'), codicon('close')

function SvgIcon({ type }: { type: NotificationType }) {
  if (type === 'error') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.5h1.5v5h-1.5v-5ZM8 11.5a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z"/>
    </svg>
  );
  if (type === 'warning') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1ZM8 2.28 2.28 13H13.7L8 2.28Zm-.5 4.22h1v4H7.5v-4Zm.5 5.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"/>
    </svg>
  );
  if (type === 'success') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm11.56-1.94L7 11.62l-3.06-3.06.88-.88L7 9.86l3.68-3.68.88.88Z"/>
    </svg>
  );
  // info (default)
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm6.5-2.5h1.5v1H6.5v-1ZM7 7h1.5v4.5H7V7Z"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
    </svg>
  );
}

// ── Single Toast ──────────────────────────────────────────────────────────────

function ToastItem({ entry }: { entry: NotificationEntry }) {
  const { dismissToast } = useNotifications();

  // Compute animation duration in seconds matching the timeout
  const durationSec = entry.persistent ? 0 :
    entry.type === 'warning' ? 6 :
    entry.type === 'success' ? 4 : 5;

  return (
    <div
      className={`theia-notification-list-item-container theia-toast-item`}
      role="alert"
      aria-live="assertive"
    >
      <div className="theia-notification-list-item">
        <div className="theia-notification-list-item-content">
          <div className="theia-notification-list-item-content-main">
            {/* Icon — matches SNS IDE .theia-notification-icon */}
            <div className={`theia-notification-icon theia-notification-icon--${entry.type}`}>
              <SvgIcon type={entry.type} />
            </div>

            {/* Message */}
            <div className="theia-notification-message">
              {entry.message}
            </div>

            {/* Actions: just close × for toasts */}
            <ul className="theia-notification-actions">
              <li
                className="theia-notification-action-btn"
                title="Clear Notification"
                onClick={() => dismissToast(entry.id)}
                aria-label="Clear"
              >
                <CloseIcon />
              </li>
            </ul>
          </div>
        </div>

        {/* Auto-dismiss progress bar — shrinks to 0 over timeout duration */}
        {!entry.persistent && durationSec > 0 && (
          <div className="theia-notification-item-progress">
            <div
              className="theia-notification-item-progressbar theia-notification-item-progressbar--auto"
              style={{ animationDuration: `${durationSec}s` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toast Container ───────────────────────────────────────────────────────────
// SNS IDE: .theia-notifications-container.theia-notification-toasts
// open when visibilityState === 'toasts'

export default function NotificationToasts() {
  const { toasts, visibilityState } = useNotifications();

  return (
    <div className={`theia-notifications-container theia-notification-toasts ${visibilityState === 'toasts' ? 'open' : 'closed'}`}>
      <div className="theia-notification-list">
        {toasts.map(entry => (
          <ToastItem key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
