'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Inbox,
  RefreshCw,
  Star,
  ArrowRight,
  Sparkles,
  Plus,
  Search,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { tickets as ticketsApi } from '@/lib/api';
import PriorityBadge from '@/components/ui/PriorityBadge';
import SlaCountdown from '@/components/ui/SlaCountdown';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
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
  ASSIGNED: 'progress',
  IN_PROGRESS: 'progress',
  RESOLVED: 'resolved',
  CLOSED: 'resolved',
  CANCELLED: 'neutral',
};
const STATUS_LABEL = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
const PROBLEM_LABEL = {
  NOT_COOLING: 'Not Cooling',
  NOISE: 'Loud Noise',
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
  const mins = Math.floor((now - d) / 60000);
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
  return `${issue}${t.acUnitRoom ? ` — ${t.acUnitRoom}` : ''}`;
}

export default function TicketsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [ticketList, setTicketList] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/tickets'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router]);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ticketList.filter((t) => {
      if (!filterFn(t)) return false;
      if (!q) return true;
      return [
        t.ticketNumber,
        t.problemCategory,
        t.acUnitRoom,
        t.propertyLabel,
      ].filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
    });
  }, [ticketList, filterFn, search]);

  if (authLoading || !user) return <RoseSplash message="Loading your tickets…" />;

  const openCount = ticketList.filter((t) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length;

  const hero = (
    <div className={styles.heroRow}>
      <div className={styles.heroText}>
        <h1 className={styles.heroTitle}>Service Requests</h1>
        <p className={styles.heroSub}>
          {ticketList.length === 0
            ? 'You have no service tickets yet — raise one and our CRM team responds in 30 minutes.'
            : `${openCount} active · ${ticketList.length} total tickets across all your properties.`}
        </p>
      </div>
      <div className={styles.heroActions}>
        <div className={styles.searchBox}>
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket number, room, problem…"
          />
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw size={15} className={refreshing ? styles.spin : ''} />
        </button>
        <Link href="/services/ticket" className={styles.newBtn}>
          <Plus size={15} /> Raise Ticket
        </Link>
      </div>
    </div>
  );

  return (
    <RoseShell hero={hero}>
      <div className={styles.filterRow}>
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
            <div key={i} className="skeleton" style={{ height: 124, borderRadius: 16 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filterKey={filter} hasSearch={!!search.trim()} />
      ) : (
        <motion.div
          className={styles.list}
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
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
    </RoseShell>
  );
}

function TicketCard({ ticket }) {
  const escalated = (ticket.currentLevel || 1) > 1
    && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status);
  const resolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  const needsRating = ticket.status === 'RESOLVED' && !ticket.customerRating;

  const tone = escalated ? 'esc'
    : resolved ? 'resolved'
    : STATUS_TONE[ticket.status] || 'open';

  return (
    <Link
      href={`/tickets/${ticket.ticketNumber}`}
      className={`${styles.card} ${styles[`card_${tone}`]}`}
    >
      <span className={styles.cardAccent} aria-hidden="true" />
      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <span className={styles.ticketNumber}>{ticket.ticketNumber}</span>
          <PriorityBadge priority={ticket.priority} />
          <span className={`${styles.statusPill} ${styles[`status_${tone}`]}`}>
            {escalated ? `Escalated · L${ticket.currentLevel}` : (STATUS_LABEL[ticket.status] || ticket.status)}
          </span>
        </div>

        <h3 className={styles.cardTitle}>{ticketTitle(ticket)}</h3>

        {ticket.propertyLabel && (
          <p className={styles.cardMeta}>{ticket.propertyLabel}</p>
        )}

        <div className={styles.cardFooter}>
          {!resolved && ticket.slaDeadlineL1 && (ticket.currentLevel || 1) === 1 && !ticket.acknowledgedAt && (
            <SlaCountdown deadlineISO={ticket.slaDeadlineL1} />
          )}
          {!resolved && ticket.slaDeadlineL2 && (ticket.currentLevel || 1) === 2 && (
            <SlaCountdown deadlineISO={ticket.slaDeadlineL2} />
          )}
          {resolved && ticket.resolvedAt && (
            <span className={styles.metaText}>Resolved {relativeShort(ticket.resolvedAt)}</span>
          )}
          {!resolved && !ticket.slaDeadlineL1 && (
            <span className={styles.metaText}>Created {relativeShort(ticket.createdAt)}</span>
          )}
          <span className={styles.dotSep}>·</span>
          <span className={styles.metaText}>Opened {relativeShort(ticket.createdAt)}</span>
        </div>

        {needsRating && (
          <span className={styles.rateLink}>
            <Star size={13} /> Rate your experience <ArrowRight size={11} />
          </span>
        )}
      </div>
      <ChevronRight size={20} className={styles.chev} />
    </Link>
  );
}

function EmptyState({ filterKey, hasSearch }) {
  const isAll = filterKey === 'all' && !hasSearch;
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Inbox size={26} />
      </div>
      <h3>{isAll ? 'No tickets yet' : 'Nothing matches this view'}</h3>
      <p>
        {isAll
          ? 'Raise a service ticket and our CRM team will respond within 30 minutes.'
          : hasSearch
            ? 'Try a different search term or clear the filter.'
            : 'Try a different filter to see your other tickets.'}
      </p>
      {isAll && (
        <Link href="/services/ticket" className={styles.emptyCta}>
          <Sparkles size={14} /> Raise a service ticket
        </Link>
      )}
    </div>
  );
}
