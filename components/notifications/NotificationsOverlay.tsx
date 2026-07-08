// Mounts both toasts and the notification center in one overlay div, rendered via
// ClientProviders as a portal.
'use client';

import NotificationToasts from './NotificationToasts';
import { NotificationCenterPanel } from './NotificationCenter';
import { useNotifications } from '@/context/NotificationContext';

export default function NotificationsOverlay() {
  const { centerOpen } = useNotifications();
  return (
    <div className="theia-notifications-overlay">
      {/* Toasts — bottom-right stack, max 3 */}
      <NotificationToasts />
      {/* Notification Center — full panel, bottom-right */}
      {centerOpen && <NotificationCenterPanel />}
    </div>
  );
}
