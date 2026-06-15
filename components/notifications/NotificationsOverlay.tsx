// =============================================================================
//  components/notifications/NotificationsOverlay.tsx
//
//  SNS IDE faithful — mirrors notifications-renderer.tsx
//
//  SNS IDE mounts both ToastsComponent + CenterComponent inside ONE overlay div:
//    <div class="theia-notifications-overlay">
//      <NotificationToastsComponent />
//      <NotificationCenterComponent />
//    </div>
//
//  Both containers use position:absolute so the overlay height:0 doesn't matter.
//  The overlay is appended to document.body in SNS IDE.
//  In Next.js, we render it in ClientProviders as a portal.
// =============================================================================
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
