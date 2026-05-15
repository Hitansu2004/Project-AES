import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ToastProvider } from '@/components/ui/Toast';
import Shell from '@/components/Shell';

export const metadata = {
  title: 'Arial Engineering Services — HVAC Customer Portal',
  description:
    'Book AC installations, raise service tickets, and manage your HVAC equipment with Arial Engineering Services.',
  applicationName: 'AES Portal',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#003366',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>
            <NotificationProvider>
              <Shell>{children}</Shell>
            </NotificationProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
