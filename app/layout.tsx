import type { Metadata } from 'next';
import './globals.css';
import 'file-icons-js/css/style.css';
import ClientProviders from '@/components/ClientProviders';

export const metadata: Metadata = {
  title: 'Code Migration Platform',
  description: 'Autonomous legacy-to-modern code migration powered by AI',
  icons: {
    icon: '/favicon.png',
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}

