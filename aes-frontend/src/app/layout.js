import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ThemeProvider, themeBootScript } from '@/context/ThemeContext';
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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets data-theme before first paint to avoid the white-flash on dark-mode reloads. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <meta name="theme-color" content="#003366" />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <NotificationProvider>
                <Shell>{children}</Shell>
              </NotificationProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
