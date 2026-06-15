// =============================================================================
//  components/ClientProviders.tsx
//
//  Client-side root wrapper.
//  SNS IDE pattern: NotificationsRenderer appends .theia-notifications-overlay
//  to document.body. We render it here (equivalent).
// =============================================================================
'use client';

import { NotificationProvider } from '@/context/NotificationContext';
import NotificationsOverlay from '@/components/notifications/NotificationsOverlay';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      {children}
      {/* SNS IDE: .theia-notifications-overlay appended to body */}
      <NotificationsOverlay />
    </NotificationProvider>
  );
}
