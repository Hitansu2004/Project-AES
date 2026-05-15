'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './Header.module.css';

const navLinks = {
  CUSTOMER: [
    { href: '/dashboard', label: 'Home' },
    { href: '/services', label: 'Services' },
    { href: '/tickets', label: 'My Tickets' },
    { href: '/account', label: 'Account' },
  ],
  CRM_AGENT: [
    { href: '/crm', label: 'My Inbox' },
    { href: '/crm/all', label: 'All Tickets' },
    { href: '/account', label: 'Account' },
  ],
  SERVICE_MANAGER: [
    { href: '/admin', label: 'Escalation' },
    { href: '/crm', label: 'CRM View' },
    { href: '/account', label: 'Account' },
  ],
  ADMIN: [
    { href: '/admin', label: 'Escalation' },
    { href: '/crm', label: 'CRM View' },
    { href: '/account', label: 'Account' },
  ],
};

export default function Header() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const links = navLinks[user.role] || navLinks.CUSTOMER;
  const roleLabel = {
    CUSTOMER: '',
    CRM_AGENT: 'CRM Dashboard — Level 1',
    SERVICE_MANAGER: 'Escalation Management',
    ADMIN: 'Admin Console',
  }[user.role] || '';

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <Link href="/dashboard" className={styles.brand}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            <span className={styles.brandName}>Arial Engineering</span>
          </Link>
          {roleLabel && <span className={styles.roleLabel}>{roleLabel}</span>}
        </div>

        <nav className={styles.nav}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname === link.href || pathname.startsWith(link.href + '/') ? styles.navLinkActive : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.right}>
          <span className={styles.greeting}>
            {user.role === 'CUSTOMER' ? '' : `Agent: ${user.name?.split(' ')[0] || 'User'}`}
          </span>
          <div className={styles.avatar}>
            {(user.name || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
