'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, ChevronRight, Inbox, Filter, Star, ArrowRight, Sparkles,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { tickets as ticketsApi } from '@/lib/api';
import PriorityBadge from '@/components/ui/PriorityBadge';
import SlaCountdown from '@/components/ui/SlaCountdown';
import Logo from '@/components/ui/Logo';
import styles from './tickets.module.css';

const FILTERS = [
  { key: 'all',      label: 'All',         match: () => true },
  { key: 'open',     label: 'Open',        match: (t) => ['OPEN', 'ACKNOWLEDGED', 'ASSIGNED'].includes(t.status) && (t.currentLevel || 1) === 1 },
  { key: 'in',       label: 'In Progress', match: (t) => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED' },
  { key: 'resolved', label: 'Resolved',    match: (t) => t.status === 'RESOLVED' || t.status === 'CLOSED' },
  { key: 'esc',      label: 'Escalated',   match: (t) => (t.currentLevel || 1) > 1 && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status) },
];

const STATUS_TONE = {
  OPEN: 'open',
  ACKNOWLEDGED: 'open',
  ASSIGNED: 'open',
  IN_PROGRESS: 'open',
  RESOLVED: 'resolved',
  CLOSED: 'resolved',
  CANCELLED: 'neutral',
};

const STATUS_LABEL = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved ✓',
  CLOSED: 'Closed ✓',
  CANCELLED: 'Cancelled',
};

const PROBLEM_LABEL = {
  NOT_COOLING: 'Not Cooling',
  NOISE: 'Noise',
  LEAKING: 'Water Leak',
  NOT_TURNING_ON: 'Not Turning On',
  NO_AIRFLOW: 'No Airflow',
  REMOTE_WIFI: 'Remote / Wi-Fi',
  OTHER: 'Other Issue',
};

function relativeShort(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ticketTitle(t) {
  const issue = PROBLEM_LABEL[t.problemCategory] || t.problemCategory || 'Service';
  return `${issue} — ${t.acUnitRoom || ''}`;
}

export default function TicketsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [ticketList, setTicketList] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/tickets'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router]);

  // Initial fetch
  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;
    let cancelled = false;
    (async () => {
      try {
        const data = await ticketsApi.list();
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : data?.content || [];
        setTicketList(arr);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const data = await ticketsApi.list();
      const arr = Array.isArray(data) ? data : data?.content || [];
      setTicketList(arr);
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  const filterFn = useMemo(
    () => (FILTERS.find((f) => f.key === filter) || FILTERS[0]).match,
    [filter]
  );
  const filtered = useMemo(
    () => ticketList.filter(filterFn),
    [ticketList, filterFn]
  );

  if (authLoading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo />
        <button type="button" className={styles.iconBtn} aria-label="Notifications">
          <Bell size={20} />
        </button>
      </header>

      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>My Tickets</h1>
          <p className={styles.subtitle}>
            {ticketList.length === 0
              ? 'You have no tickets yet'
              : `${ticketList.length} ${ticketList.length === 1 ? 'ticket' : 'tickets'} in total`}
          </p>
        </div>
        <button type="button" onClick={refresh} className={styles.refreshBtn} disabled={refreshing} aria-label="Refresh">
          <Filter size={18} />
        </button>
      </div>

      <div className={styles.filterScroll}>
        {FILTERS.map((f) => {
          const count = ticketList.filter(f.match).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className={styles.filterCount}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className={styles.list}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 132 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filterKey={filter} />
      ) : (
        <motion.div
          className={styles.list}
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((t) => (
              <motion.div
                key={t.id || t.ticketNumber}
                layout
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                exit={{ opacity: 0 }}
              >
                <TicketCard ticket={t} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function TicketCard({ ticket }) {
  const escalated = (ticket.currentLevel || 1) > 1
    && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status);
  const resolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  const needsRating = ticket.status === 'RESOLVED' && !ticket.customerRating;

  const accent = escalated
    ? 'esc'
    : resolved
      ? 'resolved'
      : ticket.priority === 'P1' ? 'amc' : ticket.priority === 'P3' ? 'paid' : 'warranty';

  return (
    <Link href={`/tickets/${ticket.ticketNumber}`} className={`${styles.card} ${styles[`accent_${accent}`]}`}>
      <div className={styles.cardAccentBar} />
      <div className={styles.cardBody}>
        <div className={styles.cardHeadRow}>
          <span className={styles.ticketNumber}>{ticket.ticketNumber}</span>
          <PriorityBadge priority={ticket.priority} />
          <span className={`${styles.statusPill} ${styles[`status_${escalated ? 'esc' : STATUS_TONE[ticket.status] || 'neutral'}`]}`}>
            {escalated ? 'Escalated' : (STATUS_LABEL[ticket.status] || ticket.status)}
          </span>
        </div>

        <h3 className={styles.cardTitle}>{ticketTitle(ticket)}</h3>

        {escalated && (
          <p className={styles.escLine}>
            <span className={styles.escDot} />
            Level {ticket.currentLevel} — {ticket.currentLevel === 2 ? 'Service Managers' : 'Management'}
          </p>
        )}

        <div className={styles.cardFooter}>
          {!resolved && ticket.slaDeadlineL1 && (ticket.currentLevel || 1) === 1 && !ticket.acknowledgedAt && (
            <SlaCountdown deadlineISO={ticket.slaDeadlineL1} />
          )}
          {!resolved && ticket.slaDeadlineL2 && (ticket.currentLevel || 1) === 2 && (
            <SlaCountdown deadlineISO={ticket.slaDeadlineL2} />
          )}
          {resolved && ticket.resolvedAt && (
            <span className={styles.metaText}>
              Resolved {relativeShort(ticket.resolvedAt)}
            </span>
          )}
          {!resolved && !ticket.slaDeadlineL1 && (
            <span className={styles.metaText}>Created {relativeShort(ticket.createdAt)}</span>
          )}
          <span className={styles.dotSep}>•</span>
          <span className={styles.metaText}>{relativeShort(ticket.createdAt)}</span>
        </div>

        {needsRating && (
          <span className={styles.rateLink}>
            <Star size={14} /> Rate your experience <ArrowRight size={12} />
          </span>
        )}
      </div>
      <ChevronRight size={20} className={styles.chev} />
    </Link>
  );
}

function EmptyState({ filterKey }) {
  const isAll = filterKey === 'all';
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Inbox size={26} />
      </div>
      <h3>{isAll ? 'No tickets yet' : 'Nothing in this view'}</h3>
      <p>
        {isAll
          ? 'Raise a service ticket and our CRM team will respond within 30 minutes.'
          : 'Try a different filter to see your other tickets.'}
      </p>
      {isAll && (
        <Link href="/services/ticket" className="btn btn-primary">
          <Sparkles size={16} /> Raise a Service Ticket
        </Link>
      )}
    </div>
  );
}
