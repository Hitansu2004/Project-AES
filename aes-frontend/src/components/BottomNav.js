'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './BottomNav.module.css';

const customerTabs = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/services', label: 'Services', icon: 'services' },
  { href: '/tickets', label: 'My Tickets', icon: 'tickets' },
  { href: '/account', label: 'Account', icon: 'account' },
];

const crmTabs = [
  { href: '/crm', label: 'Inbox', icon: 'inbox' },
  { href: '/crm/all', label: 'All Tickets', icon: 'tickets' },
  { href: '/account', label: 'Account', icon: 'account' },
];

const adminTabs = [
  { href: '/admin', label: 'Escalation', icon: 'escalation' },
  { href: '/crm', label: 'CRM View', icon: 'inbox' },
  { href: '/account', label: 'Account', icon: 'account' },
];

const icons = {
  home: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ),
  services: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  tickets: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
      <path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>
    </svg>
  ),
  account: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  inbox: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  escalation: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v12"/><path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
      <path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
      <path d="M15 6a9 9 0 0 0-9 9"/><path d="M18 15v6"/><path d="M21 18h-6"/>
    </svg>
  ),
};

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  let tabs = customerTabs;
  if (user.role === 'ADMIN') tabs = adminTabs;
  else if (user.role === 'CRM_AGENT') tabs = crmTabs;
  else if (user.role === 'SERVICE_MANAGER') tabs = adminTabs;

  return (
    <nav className={styles.nav}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
        return (
          <Link key={tab.href} href={tab.href} className={`${styles.tab} ${isActive ? styles.active : ''}`}>
            <span className={styles.icon}>{icons[tab.icon]}</span>
            <span className={styles.label}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
