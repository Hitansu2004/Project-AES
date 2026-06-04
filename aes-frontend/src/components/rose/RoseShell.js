'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import {
  Plus,
  LayoutDashboard,
  Wrench,
  Cpu,
  ScrollText,
  Settings,
  HelpCircle,
  LogOut,
  Search,
  Bell,
  X,
  Snowflake,
  Inbox,
  Layers,
  Receipt,
  Package,
  Building2,
  Users,
  AlertOctagon,
  TicketCheck,
  BarChart3,
  Tag,
  Shield,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import styles from './RoseShell.module.css';

/**
 * Role-aware sidebar navigation for the Rose Luxury redesign.
 * Each role gets its own primary + secondary action so the same
 * shell renders for customer, CRM agent, ops, engineer, admin.
 */
const NAV = {
  CUSTOMER: {
    primary: { href: '/services/installation', label: 'New Service Request', icon: Plus },
    items: [
      { href: '/dashboard',     label: 'Dashboard',        icon: LayoutDashboard },
      { href: '/tickets',       label: 'Service Requests', icon: Wrench },
      { href: '/installations', label: 'My Projects',      icon: Cpu },
      { href: '/services',      label: 'Services',         icon: Layers },
      { href: '/account',       label: 'Settings',         icon: Settings },
    ],
  },
  CRM_AGENT: {
    primary: { href: '/services/ticket', label: 'New Ticket on Behalf', icon: Plus },
    items: [
      { href: '/crm',     label: "Today's Pool", icon: Inbox },
      { href: '/tickets', label: 'All Tickets',  icon: TicketCheck },
      { href: '/account', label: 'Settings',     icon: Settings },
    ],
  },
  OPS_MANAGER: {
    primary: { href: '/services/ticket', label: 'Quick Ticket', icon: Plus },
    items: [
      { href: '/ops',     label: 'Triage Board', icon: Inbox },
      { href: '/tickets', label: 'All Tickets',  icon: TicketCheck },
      { href: '/account', label: 'Settings',     icon: Settings },
    ],
  },
  SITE_ENGINEER: {
    primary: { href: '/engineer', label: 'My Schedule', icon: Plus },
    items: [
      { href: '/engineer', label: 'My Jobs',     icon: Wrench },
      { href: '/tickets',  label: 'All Tickets', icon: TicketCheck },
      { href: '/account',  label: 'Settings',    icon: Settings },
    ],
  },
  SERVICE_MANAGER: {
    primary: { href: '/admin', label: 'Escalation Triage', icon: Plus },
    items: [
      { href: '/admin',   label: 'Escalations', icon: AlertOctagon },
      { href: '/crm',     label: 'CRM View',    icon: Users },
      { href: '/tickets', label: 'All Tickets', icon: TicketCheck },
      { href: '/account', label: 'Settings',    icon: Settings },
    ],
  },
  ADMIN: {
    primary: { href: '/admin', label: 'Operations Triage', icon: Plus },
    items: [
      { href: '/admin',         label: 'Escalations', icon: AlertOctagon },
      { href: '/crm',           label: 'CRM View',    icon: Users },
      { href: '/admin/coupons', label: 'Coupons',     icon: Tag },
      { href: '/admin/revenue', label: 'Revenue',     icon: BarChart3 },
      { href: '/account',       label: 'Settings',    icon: Settings },
    ],
  },
  SUPER_ADMIN: {
    primary: { href: '/admin/revenue', label: 'Revenue HQ', icon: Plus },
    items: [
      { href: '/admin/revenue', label: 'Revenue',     icon: BarChart3 },
      { href: '/admin',         label: 'Operations',  icon: Shield },
      { href: '/crm',           label: 'CRM View',    icon: Users },
      { href: '/admin/coupons', label: 'Coupons',     icon: Tag },
      { href: '/account',       label: 'Settings',    icon: Settings },
    ],
  },
};

/**
 * RoseShell — desktop sidebar + top-right header that wraps page content.
 *
 *   <RoseShell title="Dashboard" subtitle="...">
 *     {pageContent}
 *   </RoseShell>
 *
 * The `title`/`subtitle` are rendered above the children as the page hero.
 * Pass `bare` if the page renders its own hero (e.g. dashboard greeting).
 */
export default function RoseShell({
  children,
  title,
  subtitle,
  hero,
  bare = false,
  contentClassName = '',
  showSearch = true,
  hideBottomNav = false,
  focused = false,
}) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { user, logout } = useAuth();
  const { unread } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role || 'CUSTOMER';
  const nav = NAV[role] || NAV.CUSTOMER;

  const initials = useMemo(() => {
    const name = user?.name || 'User';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'U';
  }, [user]);

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/') && !pathname.startsWith('/admin/revenue') && !pathname.startsWith('/admin/coupons');
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleLogout = async () => {
    await logout?.();
    router.replace('/login');
  };

  // Focused flow (wizards, detail pages) hides chrome on all viewports —
  // the page renders its own minimal back-button header.
  const effectiveHideBottomNav = hideBottomNav || focused;
  const rootClass = [
    styles.root,
    effectiveHideBottomNav ? styles.noBottomNav : '',
    focused ? styles.focused : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {/* ── Mobile/tablet glass top app bar ── */}
      <nav className={styles.mobileNav}>
        <button
          type="button"
          className={styles.mobileAvatar}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X size={18} /> : initials}
        </button>
        <Link href="/dashboard" className={styles.mobileBrand}>
          ARIAL ENGINEERING
        </Link>
        <Link
          href="/notifications"
          className={styles.mobileBell}
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className={styles.mobileBellBadge}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>
      </nav>

      {/* ── Sidebar (desktop persistent / mobile slide-in) ── */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarTop}>
          <Link href="/dashboard" className={styles.brand}>
            ARIAL ENGINEERING
          </Link>

          <Link
            href={nav.primary.href}
            className={styles.primaryCta}
            onClick={() => setMobileOpen(false)}
          >
            <nav.primary.icon size={16} strokeWidth={2.4} />
            <span>{nav.primary.label}</span>
          </Link>
        </div>

        <nav className={styles.navList}>
          {nav.items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <span className={styles.navAccent} aria-hidden="true" />
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFoot}>
          <Link href="/notifications" className={styles.navLink} onClick={() => setMobileOpen(false)}>
            <span className={styles.navAccent} aria-hidden="true" />
            <HelpCircle size={18} strokeWidth={1.8} />
            <span>Support</span>
          </Link>
          <button type="button" className={styles.navLink} onClick={handleLogout}>
            <span className={styles.navAccent} aria-hidden="true" />
            <LogOut size={18} strokeWidth={1.8} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Main canvas ── */}
      <div className={styles.canvas}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft} aria-hidden="true" />
          <div className={styles.topBarRight}>
            {showSearch && (
              <button type="button" className={styles.iconBtn} aria-label="Search">
                <Search size={20} />
              </button>
            )}
            <Link href="/notifications" className={styles.iconBtn} aria-label="Notifications">
              <Bell size={20} />
              {unread > 0 && (
                <span className={styles.bellBadge}>{unread > 99 ? '99+' : unread}</span>
              )}
            </Link>
            <Link href="/account" className={styles.avatar} aria-label="Account">
              {initials}
            </Link>
          </div>
        </header>

        <main className={`${styles.main} ${contentClassName}`}>
          {!bare && (title || subtitle || hero) && (
            <header className={styles.pageHero}>
              {hero ? hero : (
                <>
                  {title && <h1 className={styles.pageTitle}>{title}</h1>}
                  {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
                </>
              )}
            </header>
          )}
          {children}
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerLinks}>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Compliance</a>
            <a href="#">Contact</a>
          </div>
          <p className={styles.footerCopy}>
            © {new Date().getFullYear()} Arial Engineering Systems. All rights reserved.
          </p>
        </footer>
      </div>

      {/* ── Mobile bottom nav (glassmorphic, ≤768px) ── */}
      {!hideBottomNav && (
        <nav className={styles.bottomNav} aria-label="Primary navigation">
          {nav.items.slice(0, 4).map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.bottomNavItem} ${active ? styles.bottomNavItemActive : ''}`}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
                <span>{item.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
