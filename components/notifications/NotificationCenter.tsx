// NotificationCenter panel (full history list) + NotificationBell (status bar badge).
'use client';

import { useNotifications, NotificationEntry, NotificationType } from '@/context/NotificationContext';

// ── SVG Icons (codicon-style, same as ToastItem) ──────────────────────────────

function TypeIcon({ type }: { type: NotificationType }) {
  if (type === 'error') return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.5h1.5v5h-1.5v-5ZM8 11.5a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z"/>
    </svg>
  );
  if (type === 'warning') return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1ZM8 2.28 2.28 13H13.7L8 2.28Zm-.5 4.22h1v4H7.5v-4Zm.5 5.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"/>
    </svg>
  );
  if (type === 'success') return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm11.56-1.94L7 11.62l-3.06-3.06.88-.88L7 9.86l3.68-3.68.88.88Z"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm6.5-2.5h1.5v1H6.5v-1ZM7 7h1.5v4.5H7V7Z"/>
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 15a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2Zm7-4.5c0 .83-.67 1.5-1.5 1.5H2.5C1.67 12 1 11.33 1 10.5c0-.5.25-.97.67-1.27C2.3 8.8 2.75 7.6 2.75 6.25 2.75 3.9 5.15 2 8 2s5.25 1.9 5.25 4.25c0 1.35.45 2.55 1.08 2.98.42.3.67.77.67 1.27Z"/>
    </svg>
  );
}

function BellDotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 15a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2Zm5.68-2.43C13.27 12.2 13 11.4 13 10.5V6.25C13 3.9 10.75 2 8 2S3 3.9 3 6.25v4.25c0 .9-.27 1.7-.68 2.07a.5.5 0 0 0 .33.93h10.7a.5.5 0 0 0 .33-.93Z"/>
      <circle cx="12" cy="3" r="2.5" fill="var(--notif-bell-dot-color, #007acc)"/>
    </svg>
  );
}

function CloseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
    </svg>
  );
}

function ClearAllIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.234 3.216 11 2.116A.5.5 0 0 0 10.634 1.3L9.5 2H6.5l-1.134-.7a.5.5 0 0 0-.366.816L5.766 3.216 2 6.5v8a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-8l-3.766-3.284ZM6.5 3h3l.866.617L8 5.36 5.634 3.617 6.5 3Zm5 10.5H4.5v-7l3.5-3 3.5 3v7Z"/>
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 10.5l5-5 5 5-1 1-4-4-4 4-1-1z"/>
    </svg>
  );
}

// ── Relative time ─────────────────────────────────────────────────────────────

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── Single Notification Row (in Center) ───────────────────────────────────────
// Mirrors notification-component.tsx .theia-notification-list-item

function NotifItem({ entry }: { entry: NotificationEntry }) {
  const { dismissFromHistory } = useNotifications();

  return (
    <div className={`theia-notification-list-item-container ${!entry.read ? 'theia-notification-item--unread' : ''}`}>
      <div className="theia-notification-list-item" tabIndex={0}>
        <div className="theia-notification-list-item-content">
          <div className="theia-notification-list-item-content-main">
            {/* Icon */}
            <div className={`theia-notification-icon theia-notification-icon--${entry.type}`}>
              <TypeIcon type={entry.type} />
            </div>

            {/* Message */}
            <div className="theia-notification-message">
              {entry.message}
            </div>

            {/* Actions */}
            <ul className="theia-notification-actions">
              <li
                className="theia-notification-action-btn"
                title="Clear"
                onClick={() => dismissFromHistory(entry.id)}
                aria-label="Clear notification"
              >
                <CloseIcon />
              </li>
            </ul>
          </div>

          {/* Source / timestamp row */}
          <div className="theia-notification-list-item-content-bottom">
            <div className="theia-notification-source">
              <span>{relTime(entry.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Notification Center Panel ──────────────────────────────────────────────────

export function NotificationCenterPanel() {
  const { history, unreadCount, closeCenter, markAllRead, clearAll } = useNotifications();

  const isEmpty = history.length === 0;
  const title   = isEmpty
    ? 'No New Notifications'
    : unreadCount > 0
    ? `Notifications (${unreadCount} new)`
    : 'Notifications';

  return (
    <div className={`theia-notifications-container theia-notification-center open`}>
      {/* Header — matches .theia-notification-center-header */}
      <div className="theia-notification-center-header">
        <div className="theia-notification-center-header-title">{title}</div>
        <div className="theia-notification-center-header-actions">
          <ul className="theia-notification-actions">
            {unreadCount > 0 && (
              <li
                className="theia-notification-action-btn theia-notification-action-btn--text"
                title="Mark all as read"
                onClick={markAllRead}
              >
                Mark read
              </li>
            )}
            {!isEmpty && (
              <li
                className="theia-notification-action-btn"
                title="Clear All Notifications"
                onClick={clearAll}
              >
                <ClearAllIcon />
              </li>
            )}
            <li
              className="theia-notification-action-btn"
              title="Hide Notifications"
              onClick={closeCenter}
            >
              <CollapseIcon />
            </li>
          </ul>
        </div>
      </div>

      {/* Notification list — matches .theia-notification-list-scroll-container */}
      <div className="theia-notification-list-scroll-container">
        <div className="theia-notification-list">
          {isEmpty ? (
            <div className="theia-notification-center-empty">
              <span className="theia-notification-center-empty-icon"><BellIcon /></span>
              <span>No notifications</span>
            </div>
          ) : (
            history.map(entry => (
              <NotifItem key={entry.id} entry={entry} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bell Icon Button (for Status Bar) ─────────────────────────────────────────

export function NotificationBell() {
  const { unreadCount, centerOpen, toggleCenter, markAllRead } = useNotifications();

  const handleClick = () => {
    toggleCenter();
    if (!centerOpen) markAllRead();
  };

  return (
    <>
      {/* Bell button in status bar */}
      <button
        id="theia-notification-bell"
        className={`theia-statusBar-element theia-notification-bell ${centerOpen ? 'active' : ''}`}
        onClick={handleClick}
        title={
          unreadCount > 0
            ? `${unreadCount} New Notification${unreadCount > 1 ? 's' : ''}`
            : 'No Notifications'
        }
        aria-label="Notifications"
      >
        {unreadCount > 0 ? <BellDotIcon /> : <BellIcon />}
        {unreadCount > 0 && (
          <span className="theia-notification-bell-count">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification center — rendered relative to bell (portal-like) */}
      {centerOpen && <NotificationCenterPanel />}
    </>
  );
}

export default NotificationCenterPanel;
