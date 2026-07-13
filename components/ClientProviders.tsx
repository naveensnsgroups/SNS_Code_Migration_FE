// Client-side root wrapper — mounts the notifications overlay alongside app content.
'use client';

import { useEffect } from 'react';
import { NotificationProvider } from '@/context/NotificationContext';
import NotificationsOverlay from '@/components/notifications/NotificationsOverlay';
import { applyTheme, getStoredTheme } from '@/utils/theme';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  return (
    <NotificationProvider>
      {children}
      <NotificationsOverlay />
    </NotificationProvider>
  );
}
