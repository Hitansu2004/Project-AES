'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox, ListChecks, AlertTriangle, CheckCircle2, Settings, LogOut,
  Bell, Phone, Check, ArrowUp, Wrench, Filter, Search,
  X, MapPin, User, Send, PackageSearch, Package, Clock, Timer,
  FileText, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  Hash, Layers, AlertCircle, DollarSign, ClipboardList, RefreshCw,
  Sparkles, UserPlus, Users, TrendingUp,
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
  workload as workloadApi,
  crmPool as crmPoolApi,
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
  { key: 'pool',      label: "Today's Pool",   icon: Sparkles },
  { key: 'inbox',     label: 'My Tickets',     icon: Inbox },
  { key: 'create',    label: 'Create Ticket',  icon: UserPlus },
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

  // V14: default to the live Pool (stockbroker view). Agents pick from
  // here first, then click "My Tickets" once they've claimed work.
  const [view, setView] = useState('pool');
  const [hasAutoSwitched, setHasAutoSwitched] = useState(false);
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

  // V14 — Pool, teams, on-behalf customer search
  const [pool, setPool] = useState([]);
  const [poolMeta, setPoolMeta] = useState({ currentLoad: 0, cap: 30, remaining: 30 });
  const [teams, setTeams] = useState([]);          // [{teamName, members, engineers, lead}]

  // Auth guard — Ops Manager + Super Admin can also use the pool view.
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/crm'); return; }
    const allowed = ['CRM_AGENT', 'ADMIN', 'SERVICE_MANAGER', 'OPS_MANAGER', 'SUPER_ADMIN'];
    if (!allowed.includes(user.role)) router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router]);

  // Fetch tickets + stats + offers + parts queue + my quotes + engineer board + pool + teams
  const fetchAll = async () => {
    try {
      const [list, dash, mine, queue, qs, engs, poolRes, teamRes] = await Promise.allSettled([
        ticketsApi.list(),
        dashboardApi.crm(),
        offersApi.mine(),
        partsApi.queue(),
        quotesApi.queue().catch(() => []),
        workloadApi.engineers().catch(() => []),
        crmPoolApi.list(),
        crmPoolApi.teams(),
      ]);
      if (list.status === 'fulfilled') {
        const arr = Array.isArray(list.value) ? list.value : list.value?.content || [];
        setTickets(arr);
      }
      if (dash.status === 'fulfilled') setStats(dash.value || null);
      if (mine.status === 'fulfilled') setOffers(Array.isArray(mine.value) ? mine.value : []);
      if (queue.status === 'fulfilled') setPartsQueue(Array.isArray(queue.value) ? queue.value : []);
      if (qs.status === 'fulfilled')   setMyQuotes(Array.isArray(qs.value) ? qs.value : []);
      if (engs.status === 'fulfilled') {
        setOpsEngineers(Array.isArray(engs.value) ? engs.value : []);
      }
      if (poolRes.status === 'fulfilled') {
        const v = poolRes.value || {};
        setPool(Array.isArray(v.tickets) ? v.tickets : []);
        setPoolMeta({
          currentLoad: Number(v.currentLoad || 0),
          cap:         Number(v.cap || 30),
          remaining:   Number(v.remaining ?? 30),
        });
      }
      if (teamRes.status === 'fulfilled') setTeams(Array.isArray(teamRes.value) ? teamRes.value : []);
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

  // V14 — Pool is the new home page; no auto-switch needed.
  // (Legacy offers tab removed from sidebar; if a tenant still has open
  //  offers we surface them as a soft banner on the Pool view.)
  useEffect(() => {
    if (loading || hasAutoSwitched) return;
    setHasAutoSwitched(true);
  }, [loading, hasAutoSwitched]);

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
      // The backend already scopes the list to the current CRM agent's tickets,
      // so we only need to exclude terminal statuses here. No need to re-check
      // currentAssigneeId — that redundant comparison was causing tickets to
      // disappear whenever user.id was null during initial auth context load.
      list = list.filter((t) =>
        (t.currentLevel || 1) === 1
        && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)
      );
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
      pool: pool.length,
    };
  }, [tickets, offers, partsQueue, myQuotes, pool]);

  // ─── V14 Pool actions ───────────────────────────────────
  const pickTicket = async (t) => {
    setBusyFor(t.ticketNumber, 'pick');
    try {
      await crmPoolApi.pick(t.ticketNumber);
      toast.success(`Picked ${t.ticketNumber} — moved to My Tickets.`);
      await fetchAll();
      setView('inbox');
    } catch (err) {
      toast.error(err?.message || 'Could not pick ticket');
    } finally {
      clearBusy(t.ticketNumber);
    }
  };

  const assignTeam = async (t, teamName) => {
    if (!teamName || teamName === t.assignedTeamName) return;
    setBusyFor(t.ticketNumber, 'team');
    try {
      await crmPoolApi.assignTeam(t.ticketNumber, teamName);
      toast.success(`${t.ticketNumber} → ${teamName}`);
      await fetchAll();
    } catch (err) {
      toast.error(err?.message || 'Could not assign team');
    } finally {
      clearBusy(t.ticketNumber);
    }
  };

  const assignEngineerDirect = async (t, engineerId) => {
    if (!engineerId) return;
    setBusyFor(t.ticketNumber, 'engineer');
    try {
      await crmPoolApi.assignEngineer(t.ticketNumber, engineerId);
      toast.success(`Engineer assigned to ${t.ticketNumber}.`);
      await fetchAll();
    } catch (err) {
      toast.error(err?.message || 'Could not assign engineer');
    } finally {
      clearBusy(t.ticketNumber);
    }
  };

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
      const ref = o.ticketNumber || o.installRequestNumber;
      toast.success(`${ref} accepted — moved to My Tickets.`);
      await fetchAll();
      // Jump to My Tickets / My Installations so the user immediately
      // sees where the accepted item landed.
      setView(o.ticketNumber ? 'inbox' : 'inbox');
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
            const count = key === 'pool'      ? counts.pool
                        : key === 'inbox'     ? counts.inbox
                        : key === 'parts'     ? counts.parts
                        : key === 'quotes'    ? counts.quotes
                        : key === 'escalated' ? counts.escalated
                        : key === 'resolved'  ? counts.resolvedToday
                        : null;
            const active = view === key;
            const isAlert = key === 'escalated' || key === 'pool';
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
              <ShiftToggle
                onShift={!!user?.onShift}
                activeWork={{ tickets: counts.inbox, offers: counts.offers }}
                onChange={() => { fetchUser(); fetchAll(); }}
              />
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

          {/* ─── V14 Pool view (stockbroker-style FIFO) ─── */}
          {view === 'pool' && (
            <PoolPanel
              pool={pool}
              meta={poolMeta}
              busyMap={busy}
              onPick={pickTicket}
              loading={loading}
            />
          )}

          {/* ─── V14 Create-on-behalf view ─── */}
          {view === 'create' && (
            <CreateOnBehalfPanel
              onCreated={(ticketNumber) => {
                toast.success(`Created ${ticketNumber} on behalf of customer.`);
                fetchAll();
                setView('inbox');
              }}
            />
          )}

          {/* ─── Legacy Offers view (kept for tenants on the older flow) ─── */}
          {view === 'offers' && (
            <OfferInboxPanel
              offers={offers}
              busyMap={busy}
              onAccept={acceptOffer}
              onDecline={declineOffer}
              inboxCount={counts.inbox}
              onGoToInbox={() => setView('inbox')}
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
                      teams={teams}
                      onTeamChange={(name) => assignTeam(t, name)}
                      onEngineerChange={(id) => assignEngineerDirect(t, id)}
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

function OfferInboxPanel({ offers, busyMap, onAccept, onDecline, inboxCount, onGoToInbox }) {
  if (!offers.length) {
    return (
      <div className={styles.empty}>
        <Send size={28} />
        <h3>No offers right now</h3>
        <p>When the Ops Manager pushes a ticket to you, it will appear here. You have 15 minutes to accept.</p>
        {inboxCount > 0 && (
          <button
            type="button"
            onClick={onGoToInbox}
            className="btn btn-primary btn-sm"
            style={{ marginTop: 14 }}
          >
            <Inbox size={14} /> View your {inboxCount} ticket{inboxCount === 1 ? '' : 's'} in My Tickets
          </button>
        )}
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

const URGENCY_STYLE = {
  URGENT: { bg: '#fef2f2', color: '#b91c1c', label: 'Urgent' },
  HIGH:   { bg: '#fff7ed', color: '#c2410c', label: 'High' },
  NORMAL: { bg: '#f0fdf4', color: '#15803d', label: 'Normal' },
  LOW:    { bg: '#f8fafc', color: '#475569', label: 'Low' },
};

function PartsApprovalPanel({ parts, busyMap, onApprove, onReject }) {
  const [expandedId, setExpandedId] = useState(null);

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
      {parts.map((p) => {
        const busy = !!busyMap[`part-${p.id}`];
        const urgency = URGENCY_STYLE[p.urgency] || URGENCY_STYLE.NORMAL;
        const cost = Number(p.totalCost || 0);
        const open = expandedId === p.id;
        return (
          <article key={p.id} className={styles.partCard}>
            <span className={styles.partAccent} style={{ background: urgency.color }} aria-hidden="true" />

            <div className={styles.partBody}>
              {/* ── Row 1: ticket + cost ── */}
              <div className={styles.partHead}>
                <div className={styles.partHeadLeft}>
                  <span className={styles.partIconWrap} aria-hidden="true"><Package size={15} /></span>
                  <Link href={`/tickets/${p.ticketNumber}`} className={styles.cardNumber}>
                    {p.ticketNumber}
                  </Link>
                  <span className={styles.partBand}>{p.requiredApprovalBand}</span>
                  <span className={styles.urgencyChip} style={{ background: urgency.bg, color: urgency.color }}>
                    {urgency.label}
                  </span>
                </div>
                <span className={styles.partCost}>
                  {cost === 0 ? 'Quote pending' : `₹${cost.toLocaleString('en-IN')}`}
                </span>
              </div>

              {/* ── Row 2: part name ── */}
              <div className={styles.partName}>
                {p.partName}
                <span className={styles.partQty}> × {p.quantity}</span>
              </div>

              {/* ── Row 3: requester note ── */}
              {(p.requestedByName || p.notes) && (
                <div className={styles.partNote}>
                  <span className={styles.partRequester}>{p.requestedByName || 'Engineer'}</span>
                  {p.notes && <span className={styles.partNoteText}> — "{p.notes}"</span>}
                </div>
              )}

              {/* ── Row 4: expandable details ── */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="details"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className={styles.partDetails}>
                      <div className={styles.partDetailsGrid}>
                        {/* Part specifics */}
                        <div className={styles.detailSection}>
                          <p className={styles.detailSectionLabel}>Part details</p>
                          <DetailRow icon={<Hash size={13} />} label="Part name" value={p.partName} />
                          <DetailRow icon={<Layers size={13} />} label="Quantity" value={`${p.quantity} unit${p.quantity !== 1 ? 's' : ''}`} />
                          <DetailRow icon={<DollarSign size={13} />} label="Unit cost"
                            value={cost > 0 ? `₹${(cost / (p.quantity || 1)).toLocaleString('en-IN')} / unit` : 'Quote pending'} />
                          <DetailRow icon={<DollarSign size={13} />} label="Total cost"
                            value={cost > 0 ? `₹${cost.toLocaleString('en-IN')}` : 'Quote pending'} highlight />
                          <DetailRow icon={<AlertCircle size={13} />} label="Urgency" value={urgency.label} />
                          <DetailRow icon={<ClipboardList size={13} />} label="Approval band" value={p.requiredApprovalBand} />
                        </div>

                        {/* Ticket context */}
                        <div className={styles.detailSection}>
                          <p className={styles.detailSectionLabel}>Ticket context</p>
                          <DetailRow icon={<Hash size={13} />} label="Ticket"
                            value={<Link href={`/tickets/${p.ticketNumber}`} className={styles.detailLink}>{p.ticketNumber}</Link>} />
                          {p.ticketPriority && (
                            <DetailRow icon={<AlertCircle size={13} />} label="Priority" value={p.ticketPriority} />
                          )}
                          {p.ticketProblemCategory && (
                            <DetailRow icon={<Wrench size={13} />} label="Issue"
                              value={(p.ticketProblemCategory || '').replace(/_/g, ' ')} />
                          )}
                          {p.customerName && (
                            <DetailRow icon={<User size={13} />} label="Customer" value={p.customerName} />
                          )}
                          {p.propertyLabel && (
                            <DetailRow icon={<MapPin size={13} />} label="Property" value={p.propertyLabel} />
                          )}
                          <DetailRow icon={<User size={13} />} label="Requested by"
                            value={p.requestedByName || '—'} />
                        </div>
                      </div>

                      {/* Notes block */}
                      {p.notes && (
                        <div className={styles.partNotesBlock}>
                          <p className={styles.detailSectionLabel}>Engineer notes</p>
                          <p className={styles.partNotesBody}>"{p.notes}"</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Row 5: actions ── */}
              <div className={styles.partActions}>
                <button
                  type="button"
                  className={styles.detailsToggleBtn}
                  onClick={() => setExpandedId(open ? null : p.id)}
                  aria-expanded={open}
                >
                  {open ? <><ChevronUp size={14} /> Hide details</> : <><ChevronDown size={14} /> More details</>}
                </button>
                <span style={{ flex: 1 }} />
                <button type="button" className={styles.rejectBtn} disabled={busy} onClick={() => onReject(p)}>
                  {busy ? <span className="spinner spinner-sm" /> : <><X size={14} /> Reject</>}
                </button>
                <button type="button" className={styles.approveBtn} disabled={busy} onClick={() => onApprove(p)}>
                  {busy ? <span className="spinner spinner-sm" /> : <><Check size={14} /> Approve</>}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function DetailRow({ icon, label, value, highlight }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailRowIcon}>{icon}</span>
      <span className={styles.detailRowLabel}>{label}</span>
      <span className={`${styles.detailRowValue} ${highlight ? styles.detailRowHighlight : ''}`}>
        {value}
      </span>
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

function CrmTicketCard({
  ticket, busyAction, teams = [],
  onTeamChange, onEngineerChange,
  onAcknowledge, onEscalate, onAssign, onResolve,
}) {
  // Engineer list = members of the currently assigned team (or all teams if none picked)
  const engineerOptions = (() => {
    if (!Array.isArray(teams) || teams.length === 0) return [];
    if (ticket.assignedTeamName) {
      const t = teams.find((tm) => tm.teamName === ticket.assignedTeamName);
      return t?.engineers || [];
    }
    return teams.flatMap((tm) => (tm.engineers || []).map((e) => ({
      ...e, name: `${e.name} · ${tm.teamName}`,
    })));
  })();
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
            {ticket.carriedForward && (
              <span
                title={ticket.originalScheduledDate
                  ? `Rolled forward from ${ticket.originalScheduledDate}`
                  : 'Carried forward from a previous day'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 999,
                  background: '#fef3c7', color: '#92400e',
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                  textTransform: 'uppercase', border: '1px solid #fde68a',
                }}>
                <RefreshCw size={10} /> Carry-over
              </span>
            )}
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

        {/* V14 — direct team / engineer assignment, no offer handshake */}
        {!resolved && (
          <div
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8,
              padding: '8px 10px', borderRadius: 10,
              background: 'var(--surface-container-low)',
              border: '1px solid var(--border-light)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--on-surface-variant)' }}>
              <Users size={14} /> Team
              <select
                value={ticket.assignedTeamName || ''}
                disabled={busyAction === 'team'}
                onChange={(e) => onTeamChange?.(e.target.value)}
                style={{
                  marginLeft: 4, padding: '4px 8px', borderRadius: 8,
                  border: '1px solid var(--border-light)', background: 'var(--surface)',
                  color: 'var(--on-surface)', fontSize: 13,
                }}
              >
                <option value="">Pick a team…</option>
                {teams.map((tm) => (
                  <option key={tm.teamName} value={tm.teamName}>
                    {tm.teamName}{tm.lead ? ` · ${tm.lead.name}` : ''} ({tm.engineers?.length || 0} eng)
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--on-surface-variant)' }}>
              <Wrench size={14} /> Engineer
              <select
                value={ticket.engineerId || ''}
                disabled={busyAction === 'engineer' || engineerOptions.length === 0}
                onChange={(e) => onEngineerChange?.(e.target.value)}
                style={{
                  marginLeft: 4, padding: '4px 8px', borderRadius: 8,
                  border: '1px solid var(--border-light)', background: 'var(--surface)',
                  color: 'var(--on-surface)', fontSize: 13,
                }}
              >
                <option value="">
                  {engineerOptions.length ? 'Pick an engineer…' : 'No engineers on this team'}
                </option>
                {engineerOptions.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
            {ticket.engineerName && (
              <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--success, #16a34a)' }}>
                <Check size={12} /> Engineer: {ticket.engineerName}
              </span>
            )}
          </div>
        )}

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
          <div style={{
            padding: 18, textAlign: 'center',
            color: 'var(--on-surface-variant)',
            border: '1px dashed var(--outline-variant)',
            borderRadius: 12, fontSize: 13,
          }}>
            <Wrench size={20} style={{ opacity: 0.5, marginBottom: 6 }} />
            <div>No engineers available right now.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Try escalating to L2 so a Service Manager can re-route.
            </div>
          </div>
        )}
        {(engineers || []).slice()
          .sort((a, b) => {
            // On-shift first, then by current load (active+pending), then by csat
            if ((b.onShift ? 1 : 0) !== (a.onShift ? 1 : 0)) return (b.onShift ? 1 : 0) - (a.onShift ? 1 : 0);
            const la = (a.activeJobs || 0) + (a.pendingOffers || 0);
            const lb = (b.activeJobs || 0) + (b.pendingOffers || 0);
            if (la !== lb) return la - lb;
            return (b.csatScore || 0) - (a.csatScore || 0);
          })
          .map((e) => {
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

/* ────────────────────────────────────────────────────────────
 * V14 — Today's Pool (FIFO stockbroker-style)
 *
 * Every unassigned ticket sits here.  The list is sorted by
 * priority then created_at on the server.  One-click "Pick"
 * claims a ticket up to the daily cap.
 * ──────────────────────────────────────────────────────────── */
function PoolPanel({ pool, meta, busyMap, onPick, loading }) {
  const PROBLEM_LABEL_LOCAL = {
    NOT_COOLING: 'AC Not Cooling',
    NOISE: 'Loud Noise',
    LEAKING: 'Water Leak',
    NOT_TURNING_ON: 'Not Turning On',
    NO_AIRFLOW: 'No Airflow',
    REMOTE_WIFI: 'Remote / Wi-Fi',
    SMELL_BURNING: 'Burning Smell',
    OTHER: 'Other Issue',
  };
  const pctFull = Math.min(100, Math.round((meta.currentLoad / Math.max(1, meta.cap)) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Capacity meter */}
      <div
        style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '14px 16px', borderRadius: 14,
          background: 'linear-gradient(135deg, var(--primary-container), var(--surface))',
          border: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Today&apos;s Pool</div>
              <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                {pool.length} waiting · pick the top one first
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>You today</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {meta.currentLoad} / {meta.cap}
              {meta.remaining <= 0 && (
                <span style={{ marginLeft: 8, color: 'var(--danger, #b91c1c)', fontSize: 11 }}>
                  · cap reached
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-container)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${pctFull}%`, height: '100%',
              background: pctFull >= 100 ? 'var(--danger, #b91c1c)' : pctFull >= 75 ? '#f59e0b' : 'var(--primary)',
              transition: 'width 220ms ease',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.list}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 88 }} />)}
        </div>
      ) : pool.length === 0 ? (
        <div className={styles.empty}>
          <CheckCircle2 size={28} />
          <h3>Pool is clear</h3>
          <p>Every ticket for today has been picked up. Keep an eye out for new ones.</p>
        </div>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pool.map((t, idx) => (
            <li
              key={t.ticketNumber}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 14, alignItems: 'center',
                padding: '12px 14px', borderRadius: 14,
                background: 'var(--surface)',
                border: '1px solid var(--border-light)',
                boxShadow: idx < 3 ? '0 1px 0 var(--border-light), 0 6px 24px -16px rgba(0,0,0,.12)' : 'none',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--surface-container-low)',
                fontWeight: 700, fontSize: 13, color: 'var(--on-surface-variant)',
              }}>
                {idx + 1}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <PriorityBadge priority={t.priority} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t.ticketNumber}</span>
                  {t.carriedForward && (
                    <span title="Carried forward from a previous day" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 999,
                      background: '#fef3c7', color: '#92400e',
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                      textTransform: 'uppercase', border: '1px solid #fde68a',
                    }}>
                      <RefreshCw size={10} /> Carry-over
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                    · {relMin(t.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--on-surface)' }}>
                  {PROBLEM_LABEL_LOCAL[t.problemCategory] || t.problemCategory || 'Service'} — {t.acUnitRoom || ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <span><User size={11} style={{ verticalAlign: -1 }} /> {t.customerName || 'Customer'}</span>
                  <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {t.propertyLabel || '—'}</span>
                  {t.scheduledDate && (
                    <span><Clock size={11} style={{ verticalAlign: -1 }} /> {t.scheduledDate} {t.scheduledSlot || ''}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!!busyMap[t.ticketNumber] || meta.remaining <= 0}
                onClick={() => onPick(t)}
                style={{ minWidth: 92 }}
              >
                {busyMap[t.ticketNumber] === 'pick'
                  ? <span className="spinner spinner-sm" />
                  : <><ThumbsUp size={14} /> Pick</>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * V14 — Create ticket on behalf of a customer
 *
 * Two steps: ① find the customer, ② raise a quick paid/AMC
 * ticket using their existing property + AC.  No payment is
 * collected from this surface — the CRM agent handles billing
 * over the phone if the customer is paying.
 * ──────────────────────────────────────────────────────────── */
function CreateOnBehalfPanel({ onCreated }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(null);     // {id, name, phone, email}
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [acUnitId, setAcUnitId] = useState('');
  const [problem, setProblem] = useState('NOT_COOLING');
  const [serviceType, setServiceType] = useState('PAID');
  // Default to tomorrow so the server-side slot guard always has a date.
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [scheduledSlot, setScheduledSlot] = useState('MORNING');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Debounced live search
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    let cancelled = false;
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await crmPoolApi.searchCustomers(q.trim());
        if (!cancelled) setHits(Array.isArray(res) ? res : []);
      } catch { if (!cancelled) setHits([]); }
      finally { if (!cancelled) setSearching(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(id); };
  }, [q]);

  // Load the picked customer's properties via the staff-side endpoint
  useEffect(() => {
    if (!picked) { setProperties([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await crmPoolApi.customerProperties(picked.id);
        if (!cancelled) {
          const arr = Array.isArray(res) ? res : [];
          setProperties(arr);
          if (arr.length === 1) setPropertyId(arr[0].id);
        }
      } catch { if (!cancelled) setProperties([]); }
    })();
    return () => { cancelled = true; };
  }, [picked]);

  const activeProperty = properties.find((p) => p.id === propertyId);
  const acUnits = activeProperty?.acUnits || [];

  useEffect(() => {
    if (acUnits.length === 1) setAcUnitId(acUnits[0].id);
  }, [propertyId, acUnits]);

  const submit = async () => {
    setErr('');
    if (!picked || !propertyId || !acUnitId) {
      setErr('Pick a customer, property and AC unit.'); return;
    }
    if (!scheduledDate) {
      setErr('Pick a date — the slot capacity guard needs one.'); return;
    }
    setSaving(true);
    try {
      const body = {
        propertyId, acUnitId,
        serviceType,
        problemCategory: problem,
        problemDescription: description || 'Raised by CRM on behalf of customer',
        priority: serviceType === 'AMC' ? 'P1' : serviceType === 'WARRANTY' ? 'P2' : 'P3',
        scheduledDate,
        scheduledSlot,
      };
      const res = await crmPoolApi.createOnBehalf(picked.id, body);
      onCreated?.(res.ticketNumber || res.data?.ticketNumber || 'AES-NEW');
      // Reset for the next one
      setPicked(null); setQ(''); setHits([]); setProperties([]);
      setPropertyId(''); setAcUnitId(''); setDescription('');
    } catch (e) {
      setErr(e?.message || 'Could not create the ticket.');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <div style={{
        padding: 18, borderRadius: 16,
        background: 'var(--surface)', border: '1px solid var(--border-light)',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>① Find the customer</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--on-surface-variant)' }}>
          Search by name, phone or email. Helpful when the customer can&apos;t self-serve.
        </p>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="input"
            placeholder="e.g. 9876543210, Hitansu, hitan@example.com…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPicked(null); }}
            style={{ width: '100%' }}
          />
          {searching && (
            <span style={{ position: 'absolute', right: 10, top: 10 }}>
              <span className="spinner spinner-sm" />
            </span>
          )}
        </div>
        {!picked && hits.length > 0 && (
          <ul style={{
            listStyle: 'none', margin: '10px 0 0', padding: 0,
            border: '1px solid var(--border-light)', borderRadius: 12,
            maxHeight: 260, overflowY: 'auto',
          }}>
            {hits.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setPicked(c)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 12px', background: 'transparent',
                    border: 0, borderBottom: '1px solid var(--border-light)',
                    cursor: 'pointer', color: 'var(--on-surface)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                    {c.phoneNumber}{c.email ? ` · ${c.email}` : ''}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {picked && (
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 12,
            background: 'var(--primary-container)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 700 }}>{picked.name}</div>
              <div style={{ fontSize: 12 }}>{picked.phoneNumber}</div>
            </div>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => { setPicked(null); setProperties([]); }}>
              <X size={14} /> Change
            </button>
          </div>
        )}
      </div>

      {picked && (
        <div style={{
          padding: 18, borderRadius: 16,
          background: 'var(--surface)', border: '1px solid var(--border-light)',
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>② Raise the ticket</h3>

          {properties.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
              Loading {picked.name}&apos;s properties…
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <label className="input-group">
                <span>Property</span>
                <select
                  className="input"
                  value={propertyId}
                  onChange={(e) => { setPropertyId(e.target.value); setAcUnitId(''); }}
                >
                  <option value="">Choose a property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.label} — {p.formattedAddress || p.addressLine1 || ''}</option>
                  ))}
                </select>
              </label>
              <label className="input-group">
                <span>AC unit</span>
                <select
                  className="input"
                  value={acUnitId}
                  onChange={(e) => setAcUnitId(e.target.value)}
                  disabled={!propertyId}
                >
                  <option value="">Choose an AC</option>
                  {acUnits.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.roomLabel || 'AC')} · {a.brand || ''} {a.modelNumber || ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-group">
                <span>Service type</span>
                <select
                  className="input"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                >
                  <option value="PAID">Paid (P3 · 24h SLA)</option>
                  <option value="WARRANTY">In-Warranty (P2 · 8h SLA)</option>
                  <option value="AMC">AMC (P1 · 4h SLA)</option>
                </select>
              </label>
              <label className="input-group">
                <span>Problem</span>
                <select
                  className="input"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                >
                  <option value="NOT_COOLING">AC Not Cooling</option>
                  <option value="NOISE">Loud Noise</option>
                  <option value="LEAKING">Water Leak</option>
                  <option value="NOT_TURNING_ON">Not Turning On</option>
                  <option value="NO_AIRFLOW">No Airflow</option>
                  <option value="REMOTE_WIFI">Remote / Wi-Fi</option>
                  <option value="SMELL_BURNING">Burning Smell</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="input-group">
                <span>Preferred date (optional)</span>
                <input
                  type="date" className="input"
                  value={scheduledDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </label>
              <label className="input-group">
                <span>Slot</span>
                <select
                  className="input"
                  value={scheduledSlot}
                  onChange={(e) => setScheduledSlot(e.target.value)}
                >
                  <option value="EARLY">Anytime (general shift)</option>
                  <option value="MORNING">Morning 9 AM – 12 PM</option>
                  <option value="AFTERNOON">Afternoon 12 PM – 4 PM</option>
                  <option value="EVENING">Evening 4 PM – 7 PM</option>
                </select>
              </label>
              <label className="input-group" style={{ gridColumn: '1 / -1' }}>
                <span>What did the customer describe? (optional)</span>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="“Indoor unit started leaking after rain last night…”"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </div>
          )}

          {err && (
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 10,
              background: 'var(--danger-light, #fef2f2)', color: '#b91c1c',
              fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <AlertCircle size={14} /> {err}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-full btn-lg"
            disabled={saving || !propertyId || !acUnitId}
            onClick={submit}
            style={{ marginTop: 14 }}
          >
            {saving ? <span className="spinner spinner-sm" /> : (
              <><Send size={16} /> Create ticket &amp; pick it for me</>
            )}
          </button>
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--on-surface-variant)' }}>
            Tip: the new ticket is auto-claimed by you. Open it from <strong>My Tickets</strong>
            {' '}to assign a team / engineer.
          </p>
        </div>
      )}
    </div>
  );
}
