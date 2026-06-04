'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Wrench,
  Sparkles,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
import styles from './notifications.module.css';

const TYPE_META = {
  TICKET_RAISED:       { icon: <Wrench size={18} />,        tone: 'info'    },
  TICKET_ASSIGNED:     { icon: <Wrench size={18} />,        tone: 'info'    },
  TICKET_ESCALATED:    { icon: <AlertTriangle size={18} />, tone: 'warning' },
  TICKET_RESOLVED:     { icon: <CheckCheck size={18} />,    tone: 'success' },
  AMC_REMINDER:        { icon: <Calendar size={18} />,      tone: 'amc'     },
  INSTALLATION_UPDATE: { icon: <Sparkles size={18} />,      tone: 'info'    },
};

function formatStamp(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = (() => {
    const y = new Date(); y.setDate(today.getDate() - 1);
    return y.toDateString() === date.toDateString();
  })();
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) + `, ${time}`;
}

function bucketOf(iso) {
  if (!iso) return 'Earlier';
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const aWeekAgo = new Date(); aWeekAgo.setDate(today.getDate() - 7);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (date >= aWeekAgo) return 'This week';
  return 'Earlier';
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { items, unread, loading, refresh, markRead, markAllRead } = useNotifications();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login?next=/notifications');
  }, [user, authLoading, router]);

  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  const grouped = useMemo(() => {
    const buckets = { Today: [], Yesterday: [], 'This week': [], Earlier: [] };
    (items || []).forEach((n) => {
      const key = bucketOf(n.createdAt);
      (buckets[key] ||= []).push(n);
    });
    return buckets;
  }, [items]);

  if (authLoading || !user) {
    return <RoseSplash message="Loading notifications…" />;
  }

  const hero = (
    <div className={styles.heroRow}>
      <div className={styles.heroText}>
        <h1 className={styles.heroTitle}>Notifications</h1>
        <p className={styles.heroSub}>
          {unread > 0
            ? `${unread} unread · ${items.length} total`
            : items.length > 0
              ? `You’re all caught up · ${items.length} total`
              : 'No notifications yet — we’ll let you know when something happens.'}
        </p>
      </div>
      {unread > 0 && (
        <button
          type="button"
          className={styles.markAllBtn}
          onClick={markAllRead}
          aria-label="Mark all read"
        >
          <CheckCheck size={14} /> Mark all read
        </button>
      )}
    </div>
  );

  return (
    <RoseShell hero={hero}>
      {loading && items.length === 0 && (
        <div className={styles.skeletonStack}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`skeleton ${styles.skeletonCard}`} />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><Bell size={28} /></div>
          <h2>No notifications yet</h2>
          <p>Ticket updates, escalations, and reminders will show up here.</p>
          <Link href={defaultRouteForRole(user.role)} className={styles.emptyCta}>
            Back to dashboard
          </Link>
        </div>
      )}

      <AnimatePresence initial={false}>
        {Object.entries(grouped).map(([bucket, list]) => list.length === 0 ? null : (
          <motion.section
            key={bucket}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={styles.section}
          >
            <h3 className={styles.sectionTitle}>{bucket}</h3>
            <ul className={styles.list}>
              <AnimatePresence initial={false}>
                {list.map((n) => (
                  <motion.li
                    key={n.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                  >
                    <NotificationCard
                      notification={n}
                      onClick={() => {
                        if (!n.read) markRead(n.id);
                        if (n.link) router.push(n.link);
                      }}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>
        ))}
      </AnimatePresence>
    </RoseShell>
  );
}

function NotificationCard({ notification, onClick }) {
  const meta = TYPE_META[notification.type] || { icon: <Bell size={18} />, tone: 'info' };
  return (
    <button
      type="button"
      className={`${styles.card} ${notification.read ? styles.cardRead : styles.cardUnread} ${styles[`tone_${meta.tone}`]}`}
      onClick={onClick}
    >
      <span className={`${styles.cardIcon} ${styles[`icon_${meta.tone}`]}`}>
        {meta.icon}
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>
          {notification.title}
          {!notification.read && <span className={styles.cardDot} aria-hidden />}
        </span>
        <span className={styles.cardText}>{notification.body}</span>
        <span className={styles.cardStamp}>{formatStamp(notification.createdAt)}</span>
      </span>
      <ChevronRight size={18} className={styles.cardChev} />
    </button>
  );
}
