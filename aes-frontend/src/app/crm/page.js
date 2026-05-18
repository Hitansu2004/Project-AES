'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox, ListChecks, AlertTriangle, CheckCircle2, Settings, LogOut,
  Bell, Phone, Check, ArrowUp, Wrench, Filter, Search,
  X, MapPin, User, Send, PackageSearch, Package, Clock, Timer,
  FileText, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import {
  tickets as ticketsApi,
  ticketActions,
  dashboard as dashboardApi,
  offers as offersApi,
  parts as partsApi,
  quotes as quotesApi,
} from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import PriorityBadge, { PriorityDot } from '@/components/ui/PriorityBadge';
import SlaCountdown from '@/components/ui/SlaCountdown';
import useSlaCountdown, { formatRemaining } from '@/hooks/useSlaCountdown';
import useStompTopic from '@/hooks/useStompTopic';
import Logo from '@/components/ui/Logo';
import ShiftToggle from '@/components/ui/ShiftToggle';
import styles from './crm.module.css';

const VIEWS = [
  { key: 'offers',    label: 'Offers',         icon: Send },
  { key: 'inbox',     label: 'My Tickets',     icon: Inbox },
  { key: 'parts',     label: 'Parts Approval', icon: PackageSearch },
  { key: 'quotes',    label: 'My Quotes',      icon: FileText },
  { key: 'all',       label: 'All Tickets',    icon: ListChecks },
  { key: 'escalated', label: 'Escalated',      icon: AlertTriangle },
  { key: 'resolved',  label: 'Resolved Today', icon: CheckCircle2 },
];

const PRIORITY_FILTERS = ['All', 'P1', 'P2', 'P3'];
const SORT_OPTIONS = [
  { key: 'sla',     label: 'SLA Critical' },
  { key: 'newest',  label: 'Newest First' },
  { key: 'oldest',  label: 'Oldest First' },
];

const PROBLEM_LABEL = {
  NOT_COOLING: 'AC Not Cooling',
  NOISE: 'Loud Noise',
  LEAKING: 'Water Leak',
  NOT_TURNING_ON: 'Not Turning On',
  NO_AIRFLOW: 'No Airflow',
  REMOTE_WIFI: 'Remote / Wi-Fi Issue',
  OTHER: 'Other Issue',
};

function ticketTitle(t) {
  const issue = PROBLEM_LABEL[t.problemCategory] || t.problemCategory || 'Service';
  return `${issue} — ${t.acUnitRoom || ''}`;
}

function relMin(stamp) {
  if (!stamp) return '';
  const ms = Date.now() - new Date(stamp).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CrmDashboard() {
  const router = useRouter();
  const { user, loading: authLoading, logout, fetchUser } = useAuth();
  const { unread } = useNotifications();
  const toast = useToast();

  const [view, setView] = useState('offers');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sortBy, setSortBy] = useState('sla');
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [offers, setOffers] = useState([]);
  const [partsQueue, setPartsQueue] = useState([]);
  const [myQuotes, setMyQuotes] = useState([]);
  const [opsEngineers, setOpsEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});       // ticketNumber → action label
  const [showResolve, setShowResolve] = useState(null); // ticket
  const [showAssign, setShowAssign] = useState(null);   // ticket
  const [search, setSearch] = useState('');

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/crm'); return; }
    const allowed = ['CRM_AGENT', 'ADMIN', 'SERVICE_MANAGER'];
    if (!allowed.includes(user.role)) router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router]);

  // Fetch tickets + stats + offers + parts queue + my quotes + engineer board
  const fetchAll = async () => {
    try {
      const [list, dash, mine, queue, qs, opsDash] = await Promise.allSettled([
        ticketsApi.list(),
        dashboardApi.crm(),
        offersApi.mine(),
        partsApi.queue(),
        quotesApi.queue().catch(() => []), // CRM may not have queue rights
        dashboardApi.ops().catch(() => null), // for engineer board (optional)
      ]);
      if (list.status === 'fulfilled') {
        const arr = Array.isArray(list.value) ? list.value : list.value?.content || [];
        setTickets(arr);
      }
      if (dash.status === 'fulfilled') setStats(dash.value || null);
      if (mine.status === 'fulfilled') setOffers(Array.isArray(mine.value) ? mine.value : []);
      if (queue.status === 'fulfilled') setPartsQueue(Array.isArray(queue.value) ? queue.value : []);
      if (qs.status === 'fulfilled')   setMyQuotes(Array.isArray(qs.value) ? qs.value : []);
      if (opsDash.status === 'fulfilled' && opsDash.value)
        setOpsEngineers(Array.isArray(opsDash.value.engineers) ? opsDash.value.engineers : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAll();
    const id = setInterval(fetchAll, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Live: new tickets land in the inbox immediately
  useStompTopic(
    user?.role === 'CRM_AGENT' || user?.role === 'ADMIN' ? '/topic/crm/inbox' : null,
    (msg) => {
      if (msg?.event === 'NEW_TICKET') {
        toast.info(`New ticket ${msg.ticketNumber} • ${msg.priority}`);
      }
      fetchAll();
    },
  );

  // Filtered list
  const visibleTickets = useMemo(() => {
    let list = tickets.slice();
    // View filter
    if (view === 'inbox') {
      // My owned tickets (CRM agent is currentAssignee).
      list = list.filter((t) => (t.currentLevel || 1) === 1
        && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)
        && (!user || (t.currentAssignee?.id ?? t.currentAssigneeId) === user.id));
    } else if (view === 'escalated') {
      list = list.filter((t) => (t.currentLevel || 1) > 1
        && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status));
    } else if (view === 'resolved') {
      list = list.filter((t) => {
        if (!['RESOLVED', 'CLOSED'].includes(t.status)) return false;
        const stamp = t.resolvedAt || t.updatedAt;
        if (!stamp) return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return new Date(stamp) >= today;
      });
    }
    // Priority filter
    if (priorityFilter !== 'All') {
      list = list.filter((t) => t.priority === priorityFilter);
    }
    // Search
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      list = list.filter((t) =>
        (t.ticketNumber || '').toLowerCase().includes(needle)
        || (t.customerName || '').toLowerCase().includes(needle)
        || (t.acUnitRoom   || '').toLowerCase().includes(needle)
        || (PROBLEM_LABEL[t.problemCategory] || '').toLowerCase().includes(needle)
      );
    }
    // Sort
    if (sortBy === 'sla') {
      list.sort((a, b) => {
        const aRem = a.slaRemainingSecondsL1 ?? a.slaRemainingSecondsL2 ?? a.slaRemainingSecondsFinal ?? Infinity;
        const bRem = b.slaRemainingSecondsL1 ?? b.slaRemainingSecondsL2 ?? b.slaRemainingSecondsFinal ?? Infinity;
        return aRem - bRem;
      });
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else {
      list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }
    return list;
  }, [tickets, view, priorityFilter, sortBy, search]);

  // Most urgent ticket near breach (used for alert banner)
  const breachAlert = useMemo(() => {
    return tickets
      .filter((t) =>
        ['OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)
        && t.slaRemainingSecondsL1 != null
        && t.slaRemainingSecondsL1 < 900    // <15 min
        && t.slaRemainingSecondsL1 > 0
        && (t.currentLevel || 1) === 1
        && !t.acknowledgedAt
      )
      .sort((a, b) => a.slaRemainingSecondsL1 - b.slaRemainingSecondsL1)[0];
  }, [tickets]);

  // Counts for sidebar
  const counts = useMemo(() => {
    const inbox = tickets.filter((t) => (t.currentLevel || 1) === 1
      && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length;
    const escalated = tickets.filter((t) => (t.currentLevel || 1) > 1
      && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length;
    const resolvedToday = tickets.filter((t) => {
      if (!['RESOLVED', 'CLOSED'].includes(t.status)) return false;
      const stamp = t.resolvedAt || t.updatedAt;
      if (!stamp) return false;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return new Date(stamp) >= today;
    }).length;
    return {
      inbox,
      escalated,
      resolvedToday,
      offers: offers.length,
      parts: partsQueue.length,
      quotes: myQuotes.length,
    };
  }, [tickets, offers, partsQueue, myQuotes]);

  // Actions
  const setBusyFor = (number, label) => setBusy((b) => ({ ...b, [number]: label }));
  const clearBusy = (number) => setBusy((b) => { const { [number]: _, ...rest } = b; return rest; });

  const handleAcknowledge = async (t) => {
    setBusyFor(t.ticketNumber, 'ack');
    try {
      await ticketActions.acknowledge(t.ticketNumber);
      toast.success(`${t.ticketNumber} acknowledged.`);
      await fetchAll();
    } catch (err) {
      toast.error(err.message || 'Could not acknowledge ticket.');
    } finally {
      clearBusy(t.ticketNumber);
    }
  };

  const handleEscalate = async (t) => {
    if (!confirm(`Escalate ${t.ticketNumber} to Level 2 — Service Managers?`)) return;
    setBusyFor(t.ticketNumber, 'escalate');
    try {
      await ticketActions.escalate(t.ticketNumber, { reason: 'Manual escalation by CRM' });
      toast.success(`${t.ticketNumber} escalated to L2.`);
      await fetchAll();
    } catch (err) {
      toast.error(err.message || 'Could not escalate ticket.');
    } finally {
      clearBusy(t.ticketNumber);
    }
  };

  const submitResolve = async ({ resolutionNotes, finalCharge }) => {
    if (!showResolve) return;
    const number = showResolve.ticketNumber;
    setBusyFor(number, 'resolve');
    try {
      await ticketActions.resolve(number, { resolutionNotes, finalCharge });
      toast.success(`${number} marked resolved.`);
      setShowResolve(null);
      await fetchAll();
    } catch (err) {
      toast.error(err.message || 'Could not resolve ticket.');
    } finally {
      clearBusy(number);
    }
  };

  const submitAssign = async ({ engineerId, notes, mode }) => {
    if (!showAssign) return;
    const number = showAssign.ticketNumber;
    setBusyFor(number, 'assign');
    try {
      await ticketActions.dispatchEngineer(number, { engineerId, mode: mode || 'DIRECT', note: notes });
      toast.success(`Dispatch offer sent for ${number}.`);
      setShowAssign(null);
      await fetchAll();
    } catch (err) {
      toast.error(err.message || 'Could not dispatch engineer.');
    } finally {
      clearBusy(number);
    }
  };

  // ─── Offer actions ────────────────────────────────────────
  const acceptOffer = async (o) => {
    setBusyFor(`offer-${o.id}`, 'accept');
    try {
      await offersApi.accept(o.id);
      toast.success(`Accepted ${o.ticketNumber || o.installRequestNumber}`);
      await fetchAll();
    } catch (err) { toast.error(err?.message || 'Could not accept'); }
    finally { clearBusy(`offer-${o.id}`); }
  };
  const declineOffer = async (o) => {
    const reason = prompt('Decline reason (e.g. on another job)?');
    if (reason === null) return;
    setBusyFor(`offer-${o.id}`, 'decline');
    try {
      await offersApi.decline(o.id, { reason, comment: reason });
      toast.success('Declined. Bounced to Ops.');
      await fetchAll();
    } catch (err) { toast.error(err?.message || 'Could not decline'); }
    finally { clearBusy(`offer-${o.id}`); }
  };

  // ─── Part actions ─────────────────────────────────────────
  const approvePart = async (p) => {
    setBusyFor(`part-${p.id}`, 'approve');
    try { await partsApi.approve(p.id); toast.success('Approved'); await fetchAll(); }
    catch (err) { toast.error(err?.message || 'Could not approve'); }
    finally { clearBusy(`part-${p.id}`); }
  };
  const rejectPart = async (p) => {
    const reason = prompt('Reason for rejection?') || '';
    if (!reason) return;
    setBusyFor(`part-${p.id}`, 'reject');
    try { await partsApi.reject(p.id, reason); toast.success('Rejected'); await fetchAll(); }
    catch (err) { toast.error(err?.message || 'Could not reject'); }
    finally { clearBusy(`part-${p.id}`); }
  };

  if (authLoading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  const sidebarLabel = user.role === 'CRM_AGENT'
    ? 'CRM Dashboard — Level 1'
    : user.role === 'SERVICE_MANAGER'
      ? 'Service Managers — L2'
      : 'Admin — All Tickets';

  return (
    <div className={styles.shell}>
      {/* ─── Top bar ─── */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <Logo />
          <span className={styles.topBarRole}>{sidebarLabel}</span>
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket, customer, room..."
            />
          </div>
          <span className={styles.agentBadge}>Agent: {user.name?.split(' ')[0] || 'Agent'}</span>
          <Link href="/notifications" className={styles.iconBtn} aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && <span className={styles.notifDot}>{unread > 99 ? '99+' : unread}</span>}
          </Link>
          <button type="button" className={styles.iconBtn} onClick={logout} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className={styles.frame}>
        {/* ─── Sidebar ─── */}
        <aside className={styles.sidebar}>
          {VIEWS.map(({ key, label, icon: Icon }) => {
            const count = key === 'offers'    ? counts.offers
                        : key === 'inbox'     ? counts.inbox
                        : key === 'parts'     ? counts.parts
                        : key === 'quotes'    ? counts.quotes
                        : key === 'escalated' ? counts.escalated
                        : key === 'resolved'  ? counts.resolvedToday
                        : null;
            const active = view === key;
            const isAlert = key === 'escalated' || key === 'offers';
            return (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`${styles.sideItem} ${active ? styles.sideItemActive : ''}`}
              >
                <span className={styles.sideItemIcon}><Icon size={18} /></span>
                <span className={styles.sideItemLabel}>{label}</span>
                {count != null && count > 0 && (
                  <span className={`${styles.sideCount} ${isAlert ? styles.sideCountAlert : ''}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <div className={styles.sideFooter}>
            <div style={{ padding: '8px 12px' }}>
              <ShiftToggle onShift={!!user?.onShift} onChange={() => fetchUser()} />
            </div>
          </div>
        </aside>

        {/* ─── Main ─── */}
        <main className={styles.main}>
          {/* SLA breach alert banner */}
          <AnimatePresence>
            {breachAlert && (
              <motion.div
                key="breach"
                initial={{ y: -16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                className={styles.breachBanner}
              >
                <AlertTriangle size={20} />
                <strong>{breachAlert.ticketNumber}</strong>
                <span>—</span>
                <BreachCountdown deadlineISO={breachAlert.slaDeadlineL1} />
                <span> to SLA breach! Respond immediately.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats row */}
          {stats && (
            <div className={styles.statsRow}>
              <StatTile label="My Inbox"      value={stats.myInboxCount}    color="primary" />
              <StatTile label="Critical SLA"  value={stats.criticalCount}   color="warn" />
              <StatTile label="SLA Breaches"  value={stats.slaBreachCount}  color="danger" />
              <StatTile label="Resolved Today" value={stats.resolvedToday}  color="success" />
              <StatTile label="Avg Response"  value={`${Math.round(stats.avgResponseMinutes || 0)}m`} color="muted" />
            </div>
          )}

          {/* Filter row */}
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Filter:</span>
              {PRIORITY_FILTERS.map((p) => {
                const active = priorityFilter === p;
                return (
                  <button
                    key={p}
                    type="button"
                    className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
                    onClick={() => setPriorityFilter(p)}
                  >
                    {p !== 'All' && <PriorityDot priority={p} />}
                    {p}
                  </button>
                );
              })}
            </div>
            <div className={styles.sortGroup}>
              <Filter size={14} />
              <span className={styles.filterLabel}>Sort:</span>
              <select
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {SORT_OPTIONS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ─── Offers view ─── */}
          {view === 'offers' && (
            <OfferInboxPanel
              offers={offers}
              busyMap={busy}
              onAccept={acceptOffer}
              onDecline={declineOffer}
            />
          )}

          {/* ─── Parts queue view ─── */}
          {view === 'parts' && (
            <PartsApprovalPanel
              parts={partsQueue}
              busyMap={busy}
              onApprove={approvePart}
              onReject={rejectPart}
            />
          )}

          {/* ─── My quotes view ─── */}
          {view === 'quotes' && (
            <MyQuotesPanel quotes={myQuotes} />
          )}

          {/* ─── Ticket list (inbox / all / escalated / resolved) ─── */}
          {(view === 'inbox' || view === 'all' || view === 'escalated' || view === 'resolved') && (loading ? (
            <div className={styles.list}>
              {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 168 }} />)}
            </div>
          ) : visibleTickets.length === 0 ? (
            <div className={styles.empty}>
              <Inbox size={28} />
              <h3>Nothing here</h3>
              <p>{view === 'inbox' ? 'No active tickets owned by you.' : 'No tickets match the current filters.'}</p>
            </div>
          ) : (
            <motion.div
              className={styles.list}
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
            >
              <AnimatePresence mode="popLayout">
                {visibleTickets.map((t) => (
                  <motion.div
                    key={t.id || t.ticketNumber}
                    layout
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    exit={{ opacity: 0 }}
                  >
                    <CrmTicketCard
                      ticket={t}
                      busyAction={busy[t.ticketNumber]}
                      onAcknowledge={() => handleAcknowledge(t)}
                      onEscalate={() => handleEscalate(t)}
                      onAssign={() => setShowAssign(t)}
                      onResolve={() => setShowResolve(t)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ))}
        </main>
      </div>

      <AnimatePresence>
        {showResolve && (
          <ResolveSheet
            ticket={showResolve}
            onClose={() => setShowResolve(null)}
            onSubmit={submitResolve}
          />
        )}
        {showAssign && (
          <DispatchSheet
            ticket={showAssign}
            engineers={opsEngineers}
            onClose={() => setShowAssign(null)}
            onSubmit={submitAssign}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── New panels ──────────────────────────────────────────── */

function OfferInboxPanel({ offers, busyMap, onAccept, onDecline }) {
  if (!offers.length) {
    return (
      <div className={styles.empty}>
        <Send size={28} />
        <h3>No offers right now</h3>
        <p>When the Ops Manager pushes a ticket to you, it will appear here. You have 15 minutes to accept.</p>
      </div>
    );
  }
  return (
    <div className={styles.list}>
      {offers.map((o) => (
        <article key={o.id} className={styles.card} style={{ border: '1.5px solid var(--warning)' }}>
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadLeft}>
                <PriorityBadge priority={o.ticketPriority || 'P2'} />
                <Link href={`/tickets/${o.ticketNumber || o.installRequestNumber}`}
                      className={styles.cardNumber}>
                  {o.ticketNumber || o.installRequestNumber}
                </Link>
                <span className={styles.cardAge}>· offered by {o.offeredByName}</span>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--warning-light)', color: '#92400e',
                padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              }}>
                <Timer size={12} /> {Math.max(0, Math.round((o.secondsUntilExpiry || 0) / 60))}m left
              </span>
            </div>
            <h3 className={styles.cardTitle}>
              {o.customerName} — {(o.ticketProblemCategory || '').replace(/_/g, ' ')}
            </h3>
            {o.note && <p style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>"{o.note}"</p>}
            <div className={styles.cardActions}>
              <button className="btn btn-soft btn-sm" disabled={!!busyMap[`offer-${o.id}`]}
                      onClick={() => onDecline(o)}>
                <ThumbsDown size={14} /> Decline
              </button>
              <button className="btn btn-primary btn-sm" disabled={!!busyMap[`offer-${o.id}`]}
                      onClick={() => onAccept(o)}>
                <ThumbsUp size={14} /> Accept
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function PartsApprovalPanel({ parts, busyMap, onApprove, onReject }) {
  if (!parts.length) {
    return (
      <div className={styles.empty}>
        <PackageSearch size={28} />
        <h3>Approval queue is clear</h3>
        <p>Part requests routed to you (CRM band ≤ ₹5k on your tickets) appear here.</p>
      </div>
    );
  }
  return (
    <div className={styles.list}>
      {parts.map((p) => (
        <article key={p.id} className={styles.card}>
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadLeft}>
                <Package size={16} />
                <Link href={`/tickets/${p.ticketNumber}`} className={styles.cardNumber}>
                  {p.ticketNumber}
                </Link>
                <span className={styles.cardAge}>· {p.requiredApprovalBand}</span>
              </div>
              <span style={{
                fontSize: 16, fontWeight: 800, color: 'var(--on-surface)',
              }}>
                ₹{Number(p.totalCost || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <h3 className={styles.cardTitle}>
              {p.partName} × {p.quantity} <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--on-surface-variant)' }}>· {p.urgency || 'NORMAL'}</span>
            </h3>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: 13, marginTop: 0 }}>
              Requested by {p.requestedByName || '—'}
              {p.notes && <> — "{p.notes}"</>}
            </p>
            <div className={styles.cardActions}>
              <button className="btn btn-soft btn-sm" disabled={!!busyMap[`part-${p.id}`]}
                      onClick={() => onReject(p)}>
                <X size={14} /> Reject
              </button>
              <button className="btn btn-primary btn-sm" disabled={!!busyMap[`part-${p.id}`]}
                      onClick={() => onApprove(p)}>
                <Check size={14} /> Approve
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function MyQuotesPanel({ quotes }) {
  if (!quotes.length) {
    return (
      <div className={styles.empty}>
        <FileText size={28} />
        <h3>No quotes pending</h3>
        <p>Submitted quotes waiting for SM/Admin approval appear here.</p>
      </div>
    );
  }
  return (
    <div className={styles.list}>
      {quotes.map((q) => (
        <article key={q.id} className={styles.card}>
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadLeft}>
                <FileText size={16} />
                <span className={styles.cardNumber}>{q.quoteNumber} v{q.version}</span>
                <span className={styles.cardAge}>· {q.requiredApprovalBand}</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800 }}>
                ₹{Number(q.total || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <h3 className={styles.cardTitle}>
              {q.installNumber || q.ticketNumber} — {q.customerName || ''}
            </h3>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>
              Status: <strong>{q.status}</strong> · Prepared by {q.preparedByName}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function BreachCountdown({ deadlineISO }) {
  const { displayText } = useSlaCountdown(deadlineISO);
  return <strong className={styles.breachTime}>{displayText}</strong>;
}

function StatTile({ label, value, color }) {
  return (
    <div className={`${styles.statTile} ${styles[`stat_${color}`]}`}>
      <span className={styles.statValue}>{value ?? '—'}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function CrmTicketCard({ ticket, busyAction, onAcknowledge, onEscalate, onAssign, onResolve }) {
  const acked = !!ticket.acknowledgedAt;
  const escalated = (ticket.currentLevel || 1) > 1;
  const resolved = ['RESOLVED', 'CLOSED'].includes(ticket.status);

  const tone = escalated
    ? 'esc'
    : acked
      ? 'ack'
      : (ticket.slaRemainingSecondsL1 ?? Infinity) < 900
        ? 'critical'
        : (ticket.slaRemainingSecondsL1 ?? Infinity) < 1500
          ? 'warning'
          : 'normal';

  return (
    <article className={`${styles.card} ${styles[`accent_${tone}`]}`}>
      <div className={styles.cardAccentBar} />
      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadLeft}>
            <PriorityBadge priority={ticket.priority} />
            <Link href={`/tickets/${ticket.ticketNumber}`} className={styles.cardNumber}>
              {ticket.ticketNumber}
            </Link>
            <span className={styles.cardAge}>· {relMin(ticket.createdAt)}</span>
          </div>
          <div className={styles.cardHeadRight}>
            {acked && !resolved && !escalated ? (
              <span className={styles.ackPill}>
                <Check size={14} strokeWidth={3} /> Acknowledged
              </span>
            ) : escalated ? (
              <span className={styles.escPill}>
                <ArrowUp size={12} /> Level {ticket.currentLevel}
              </span>
            ) : (
              <SlaCountdown deadlineISO={ticket.slaDeadlineL1} />
            )}
          </div>
        </div>

        <h3 className={styles.cardTitle}>{ticketTitle(ticket)}</h3>
        <div className={styles.cardMetaRow}>
          <span className={styles.metaItem}><User size={14} /> {ticket.customerName || 'Customer'}</span>
          <span className={styles.metaDot}>·</span>
          <span className={styles.metaItem}><MapPin size={14} /> {ticket.propertyLabel || '—'}</span>
        </div>

        <div className={styles.cardActions}>
          <a className="btn btn-primary btn-sm" href={`tel:${ticket.customerPhone || ''}`}>
            <Phone size={14} /> Call
          </a>
          {!acked && !resolved && (
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={onAcknowledge}
              disabled={busyAction === 'ack'}
            >
              {busyAction === 'ack' ? <span className="spinner spinner-sm" /> : <><Check size={14} /> Acknowledge</>}
            </button>
          )}
          {acked && !resolved && (
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={onAssign}
              disabled={busyAction === 'assign'}
            >
              {busyAction === 'assign' ? <span className="spinner spinner-sm" /> : <><Wrench size={14} /> Assign Engineer</>}
            </button>
          )}
          {acked && !resolved && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onResolve}
              disabled={busyAction === 'resolve'}
            >
              {busyAction === 'resolve' ? <span className="spinner spinner-sm" /> : <><CheckCircle2 size={14} /> Resolve</>}
            </button>
          )}
          <span style={{ flex: 1 }} />
          {!resolved && !escalated && (
            <button
              type="button"
              className={styles.escalateLink}
              onClick={onEscalate}
              disabled={busyAction === 'escalate'}
            >
              {busyAction === 'escalate' ? 'Escalating...' : (
                <>Escalate to L{(ticket.currentLevel || 1) + 1} <ArrowUp size={14} /></>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─── Resolve sheet ──────────────────────────────────────── */
function ResolveSheet({ ticket, onClose, onSubmit }) {
  const [notes, setNotes] = useState('');
  const [charge, setCharge] = useState('');
  const [saving, setSaving] = useState(false);
  const isPaid = ticket.priority === 'P3';

  const handle = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    await onSubmit({
      resolutionNotes: notes.trim(),
      finalCharge: isPaid && charge ? Number(charge) : null,
    });
    setSaving(false);
  };

  return (
    <SheetWrap onClose={onClose}>
      <div className={styles.sheetHeader}>
        <h3>Resolve {ticket.ticketNumber}</h3>
        <button type="button" onClick={onClose} className={styles.iconBtn} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <p className={styles.sheetSub}>Add resolution notes — these are visible to the customer.</p>
      <textarea
        className="input textarea"
        rows={4}
        maxLength={2000}
        placeholder="What was done, parts replaced, follow-up needed..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {isPaid && (
        <div className={styles.paidChargeRow}>
          <label className="input-group" style={{ flex: 1 }}>
            <span>Final charge (₹)</span>
            <input
              type="number"
              min="0"
              className="input"
              placeholder="e.g. 2400"
              value={charge}
              onChange={(e) => setCharge(e.target.value)}
            />
          </label>
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-full btn-lg"
        disabled={!notes.trim() || saving}
        onClick={handle}
      >
        {saving ? <span className="spinner spinner-sm" /> : 'Mark as Resolved'}
      </button>
    </SheetWrap>
  );
}

/* ─── Dispatch sheet ──────────────────────────────────────── */
function DispatchSheet({ ticket, engineers, onClose, onSubmit }) {
  const [pickedId, setPickedId] = useState('');
  const [mode, setMode]         = useState('DIRECT');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);

  const handle = async () => {
    if (!pickedId) return;
    setSaving(true);
    await onSubmit({ engineerId: pickedId, notes: notes.trim() || null, mode });
    setSaving(false);
  };

  return (
    <SheetWrap onClose={onClose}>
      <div className={styles.sheetHeader}>
        <h3>Dispatch Engineer</h3>
        <button type="button" onClick={onClose} className={styles.iconBtn} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <p className={styles.sheetSub}>
        Sending offer for <strong>{ticket.ticketNumber}</strong> — {ticket.customerName}.
        Engineer has 10 minutes to accept.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
        {(engineers || []).length === 0 && (
          <div style={{ padding: 18, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
            Loading engineers…
          </div>
        )}
        {(engineers || []).map((e) => {
          const picked = e.userId === pickedId;
          return (
            <button key={e.userId} type="button"
                    onClick={() => setPickedId(e.userId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: 12, borderRadius: 12,
                      border: `1.5px solid ${picked ? 'var(--secondary)' : 'var(--outline-variant)'}`,
                      background: picked ? 'var(--secondary-soft)' : 'var(--surface-container-lowest)',
                      textAlign: 'left', cursor: 'pointer',
                    }}>
              <span style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--primary-container)', color: 'var(--on-primary-container)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800,
              }}>{(e.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('')}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {e.name}
                  {!e.onShift && <span style={{ marginLeft: 6, fontSize: 9.5, padding: '2px 6px', background: 'var(--outline-variant)', borderRadius: 999, fontWeight: 700 }}>off-shift</span>}
                  {e.overloaded && <span style={{ marginLeft: 6, fontSize: 9.5, padding: '2px 6px', background: 'var(--error-container)', color: 'var(--error)', borderRadius: 999, fontWeight: 700 }}>full</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                  Jobs {e.activeJobs} · Pending {e.pendingOffers}
                  {e.csatScore != null && <> · CSAT {Number(e.csatScore).toFixed(1)}</>}
                  {(e.skills || []).slice(0, 2).map((s) => ` · ${s}`)}
                </div>
              </div>
              {picked && <Check size={18} color="var(--secondary)" />}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '12px 0 0' }}>
        {['DIRECT', 'INVITE'].map((m) => (
          <button key={m} type="button"
                  onClick={() => setMode(m)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, border: '1px solid var(--outline-variant)',
                    background: mode === m ? 'var(--primary)' : 'var(--surface-container-lowest)',
                    color: mode === m ? '#fff' : 'var(--on-surface)',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
            {m === 'DIRECT' ? 'Direct' : 'Invite (declinable)'}
          </button>
        ))}
      </div>
      <label className="input-group">
        <span>Note (optional)</span>
        <textarea
          className="input textarea"
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="VIP customer, prefer evening visit…"
        />
      </label>
      <button
        type="button"
        className="btn btn-primary btn-full btn-lg"
        disabled={!pickedId || saving}
        onClick={handle}
      >
        {saving ? <span className="spinner spinner-sm" /> : 'Send dispatch offer'}
      </button>
    </SheetWrap>
  );
}

function SheetWrap({ children, onClose }) {
  return (
    <motion.div
      className={styles.sheetBackdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.sheet}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.sheetHandle} />
        {children}
      </motion.div>
    </motion.div>
  );
}
