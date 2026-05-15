import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: 'Arial Engineering Services — HVAC Customer Portal',
  description: 'Book AC installations, raise service tickets, and manage your HVAC equipment with Arial Engineering Services.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          <main>{children}</main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
