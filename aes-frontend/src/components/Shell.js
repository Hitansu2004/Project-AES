'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import NotificationToastBridge from '@/components/NotificationToastBridge';

/**
 * Routes that should render fullscreen with no global chrome (Header/BottomNav).
 * Auth pages, the install/service wizards, and the success screens all manage
 * their own top bar.
 */
const NO_CHROME_PREFIXES = [
  '/',          // root splash redirector
  '/login',
  '/services',
  '/ops',
  '/crm',
  '/engineer',
  '/admin',
  '/notifications',
  '/quotes',
  // Rose redesign — these pages render their own RoseShell sidebar
  '/dashboard',
  '/tickets',
  '/installations',
  '/account',
];

function shouldHideChrome(pathname) {
  if (!pathname) return true;
  return NO_CHROME_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export default function Shell({ children }) {
  const pathname = usePathname();
  const hide = shouldHideChrome(pathname);

  return (
    <>
      {!hide && <Header />}
      <main>{children}</main>
      {!hide && <BottomNav />}
      <NotificationToastBridge />
    </>
  );
}
