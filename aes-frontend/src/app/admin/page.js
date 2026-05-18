'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Timer, CheckCircle2, ShieldAlert, ChevronRight, ArrowUp,
  Clock, Bell, RefreshCw, Search, LogOut, Snowflake, FileSpreadsheet, Activity,
  Users, UserCheck, Headset, Wrench, Crown,
} from 'lucide-react';

import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { dashboard as dashboardApi, ticketActions, parts as partsApi, quotes as quotesApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import useStompTopic from '@/hooks/useStompTopic';
import PriorityBadge from '@/components/ui/PriorityBadge';
import ShiftToggle from '@/components/ui/ShiftToggle';
import { FileText, Package, ThumbsUp, ThumbsDown, Send } from 'lucide-react';
import styles from './admin.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────
const COLUMNS = [
  { level: 1, key: 'l1', title: 'CRM Team', subtitle: 'Level 1', tone: 'l1' },
  { level: 2, key: 'l2', title: 'Service Managers', subtitle: 'Level 2', tone: 'l2' },
  { level: 3, key: 'l3', title: 'Management', subtitle: 'Level 3', tone: 'l3' },
];

function minutesSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

function describeOpen(mins) {
  if (mins == null) return '';
  if (mins < 60) return `${mins} min open`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m ? `${m}m` : ''} open`.trim();
}

function describeAgo(iso) {
  if (!iso) return '';
  const mins = minutesSince(iso);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ago`;
}

function timeShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function isFinalBreached(t, now) {
  if (!t) return false;
  if (t.isFinalBreached) return true;
  if (!t.slaDeadlineFinal) return false;
  return new Date(t.slaDeadlineFinal).getTime() < now;
}

function levelLabel(lvl) {
  return ({ 1: 'L1 (CRM)', 2: 'L2 (Manager)', 3: 'L3 (Mgmt)' }[lvl] || `L${lvl}`);
}

function initialsOf(name) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function roleMeta(role) {
  switch (role) {
    case 'CRM_AGENT':       return { label: 'CRM Agent',       short: 'L1', icon: Headset, tone: 'l1' };
    case 'SERVICE_MANAGER': return { label: 'Service Manager', short: 'L2', icon: Wrench,  tone: 'l2' };
    case 'ADMIN':           return { label: 'Management',      short: 'L3', icon: Crown,   tone: 'l3' };
    default:                return { label: role || '—',        short: '',   icon: UserCheck, tone: 'l1' };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function AdminEscalationPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { unread } = useNotifications();
  const router = useRouter();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [pulse, setPulse] = useState(0); // bumped to flash KPI cards on live update
  const [now, setNow] = useState(() => Date.now());
  const [quoteQueue, setQuoteQueue] = useState([]);
  const [partQueue, setPartQueue]   = useState([]);
  const [busyId, setBusyId]         = useState(null);

  // Auth guard ----------------------------------------------------
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/admin'); return; }
    if (user.role !== 'SERVICE_MANAGER' && user.role !== 'ADMIN') {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  // Data fetch ----------------------------------------------------
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [res, qq, pq] = await Promise.allSettled([
        dashboardApi.escalation(),
        quotesApi.queue().catch(() => []),
        partsApi.queue().catch(() => []),
      ]);
      if (res.status === 'fulfilled') setData(res.value);
      if (qq.status === 'fulfilled') setQuoteQueue(Array.isArray(qq.value) ? qq.value : []);
      if (pq.status === 'fulfilled') setPartQueue(Array.isArray(pq.value) ? pq.value : []);
    } catch (err) {
      if (!silent) toast.error(err?.message || 'Could not refresh dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  // Quote / part approval actions
  const approveQuote = async (q) => {
    setBusyId(q.id);
    try { await quotesApi.approve(q.quoteNumber); toast.success(`Approved ${q.quoteNumber}`); fetchData(true); }
    catch (err) { toast.error(err?.message || 'Could not approve'); }
    finally { setBusyId(null); }
  };
  const rejectQuote = async (q) => {
    const reason = prompt('Reason to send back to drafter?');
    if (!reason) return;
    setBusyId(q.id);
    try { await quotesApi.reject(q.quoteNumber, reason); toast.success('Sent back'); fetchData(true); }
    catch (err) { toast.error(err?.message || 'Could not reject'); }
    finally { setBusyId(null); }
  };
  const sendQuote = async (q) => {
    setBusyId(q.id);
    try { await quotesApi.send(q.quoteNumber); toast.success('Sent to customer'); fetchData(true); }
    catch (err) { toast.error(err?.message || 'Could not send'); }
    finally { setBusyId(null); }
  };
  const approvePart = async (p) => {
    setBusyId(p.id);
    try { await partsApi.approve(p.id); toast.success('Part approved'); fetchData(true); }
    catch (err) { toast.error(err?.message || 'Could not approve'); }
    finally { setBusyId(null); }
  };
  const rejectPart = async (p) => {
    const reason = prompt('Reason for rejection?');
    if (!reason) return;
    setBusyId(p.id);
    try { await partsApi.reject(p.id, reason); toast.success('Rejected'); fetchData(true); }
    catch (err) { toast.error(err?.message || 'Could not reject'); }
    finally { setBusyId(null); }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
    const interval = setInterval(() => fetchData(true), 25000);
    return () => clearInterval(interval);
  }, [user, fetchData]);

  // Tick clock for SLA chips
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Live escalation feed -----------------------------------------
  useStompTopic('/topic/escalation/dashboard', (msg) => {
    if (msg?.event?.startsWith?.('ESCALATED_TO_L')) {
      toast.info(`${msg.ticketNumber} escalated to L${msg.toLevel}`);
    }
    setPulse((p) => p + 1);
    fetchData(true);
  });

  // Filtered + grouped tickets -----------------------------------
  const q = search.trim().toLowerCase();
  const filterTicket = useCallback((t) => {
    if (!q) return true;
    return [t.ticketNumber, t.problemCategory, t.customerName, t.currentAssigneeName]
      .filter(Boolean)
      .some((s) => String(s).toLowerCase().includes(q));
  }, [q]);

  const filtered = useMemo(() => {
    if (!data) return { l1: [], l2: [], l3: [] };
    const tag = (arr) => (arr || []).filter(filterTicket);
    return { l1: tag(data.l1Tickets), l2: tag(data.l2Tickets), l3: tag(data.l3Tickets) };
  }, [data, filterTicket]);

  // Team workload (filtered to match search box) ----------------
  const teamWorkload = useMemo(() => {
    if (!data?.teamWorkload) return [];
    return data.teamWorkload.map((tw) => ({
      ...tw,
      tickets: (tw.tickets || []).filter(filterTicket),
    }));
  }, [data, filterTicket]);

  // Server counts fall back to list lengths if absent ------------
  const counts = useMemo(() => ({
    l1: data?.l1Count ?? data?.l1Tickets?.length ?? 0,
    l2: data?.l2Count ?? data?.l2Tickets?.length ?? 0,
    l3: data?.l3Count ?? data?.l3Tickets?.length ?? 0,
    totalActive: data?.totalActive ?? 0,
    criticalActive: data?.criticalActive ?? 0,
  }), [data]);

  const breachedCount = useMemo(() => {
    if (!data) return 0;
    return [...(data.l1Tickets || []), ...(data.l2Tickets || [])]
      .filter((t) => isFinalBreached(t, now)).length;
  }, [data, now]);

  // Action handlers ----------------------------------------------
  const onEscalate = async (t) => {
    if (t.currentLevel >= 3) return;
    try {
      await ticketActions.escalate(t.ticketNumber, {
        reason: `Escalated to L${t.currentLevel + 1} by ${user?.name || 'Manager'}`,
      });
      toast.success(`${t.ticketNumber} escalated to L${t.currentLevel + 1}`);
      fetchData(true);
    } catch (err) {
      toast.error(err?.message || 'Escalation failed');
    }
  };
  const onResolve = async (t) => {
    try {
      await ticketActions.resolve(t.ticketNumber, {
        resolutionNotes: `Resolved at L${t.currentLevel} by ${user?.name || 'Manager'}`,
      });
      toast.success(`${t.ticketNumber} marked resolved`);
      fetchData(true);
    } catch (err) {
      toast.error(err?.message || 'Resolve failed');
    }
  };

  const handleLogout = async () => { await logout(); router.replace('/login'); };

  if (authLoading || loading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  const initials = (user.name || 'M').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className={styles.shell}>
      {/* Top bar */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <div className={styles.brandIcon}><Snowflake size={18} color="#fff" /></div>
          <div className={styles.brandWrap}>
            <span className={styles.brandName}>Arial Engineering</span>
            <span className={styles.brandTag}>Escalation Management</span>
          </div>
        </div>
        <div className={styles.topRight}>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              placeholder="Search ticket, problem, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ShiftToggle onShift={!!user?.onShift} compact onChange={() => fetchData(true)} />
          <button
            className={styles.iconBtn}
            onClick={() => fetchData()}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh now"
          >
            <RefreshCw size={18} className={refreshing ? styles.spin : ''} />
          </button>
          <Link href="/notifications" className={styles.iconBtn} aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && (
              <span className={styles.bellBadge}>{unread > 99 ? '99+' : unread}</span>
            )}
          </Link>
          <span className={styles.userBadge}>
            <span className={styles.userAvatar}>{initials}</span>
            <span className={styles.userName}>{user.name || user.role}</span>
          </span>
          <button className={styles.iconBtn} onClick={handleLogout} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className={styles.main}>
        {/* KPI row */}
        <section className={styles.kpiRow}>
          <KpiCard
            icon={<AlertTriangle size={22} />}
            label="Escalated Now"
            value={data?.escalatedNow ?? 0}
            tone="warn"
            pulseKey={pulse}
          />
          <KpiCard
            icon={<Timer size={22} />}
            label="Avg Response"
            value={data?.avgResponseMinutes != null
              ? `${Math.round(data.avgResponseMinutes)} min`
              : '—'}
            tone="info"
          />
          <KpiCard
            icon={<ShieldAlert size={22} />}
            label="SLA Breach Today"
            value={data?.slaBreachToday ?? breachedCount}
            tone="danger"
            pulseKey={pulse}
          />
          <KpiCard
            icon={<CheckCircle2 size={22} />}
            label="Resolved Today"
            value={data?.resolvedToday ?? 0}
            tone="success"
          />
        </section>

        {/* Approval queues (Quotes + Parts) */}
        <section className={styles.kpiRow} style={{ marginTop: 8 }}>
          <ApprovalQueueTile
            kind="quote"
            count={quoteQueue.length}
            items={quoteQueue}
            busyId={busyId}
            onApprove={approveQuote}
            onReject={rejectQuote}
            onSend={sendQuote}
          />
          <ApprovalQueueTile
            kind="part"
            count={partQueue.length}
            items={partQueue}
            busyId={busyId}
            onApprove={approvePart}
            onReject={rejectPart}
          />
        </section>

        {/* Pipeline */}
        <section className={styles.pipeline}>
          {COLUMNS.map((col) => {
            const tickets = filtered[col.key];
            const breachedInCol = tickets.filter((t) => isFinalBreached(t, now)).length;
            const criticalInCol = tickets.filter((t) => t.priority === 'P1').length;
            const totalForLevel = counts[col.key] ?? tickets.length;
            const showingFiltered = q && tickets.length !== totalForLevel;
            return (
              <div key={col.key} className={`${styles.column} ${styles[`col_${col.tone}`]}`}>
                <header className={styles.columnHeader}>
                  <div>
                    <h2 className={styles.columnTitle}>{col.title}</h2>
                    <p className={styles.columnSubtitle}>{col.subtitle}</p>
                  </div>
                  <div className={styles.columnMeta}>
                    <span className={styles.metaCount}>
                      {showingFiltered ? `${tickets.length}/${totalForLevel}` : totalForLevel}
                    </span>
                    <span className={styles.metaLabel}>active</span>
                    {criticalInCol > 0 && (
                      <span className={styles.metaPillDanger}>{criticalInCol} critical</span>
                    )}
                    {breachedInCol > 0 && (
                      <span className={styles.metaPillBreach}>{breachedInCol} breach</span>
                    )}
                  </div>
                </header>
                <div className={styles.columnBody}>
                  <AnimatePresence mode="popLayout">
                    {tickets.length === 0 ? (
                      <EmptyColumn level={col.level} />
                    ) : (
                      tickets.map((t) => (
                        <motion.div
                          key={t.id || t.ticketNumber}
                          layout
                          initial={{ opacity: 0, y: 12, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                          className={`${styles.ticketCard} ${
                            isFinalBreached(t, now) ? styles.ticketCardBreached : ''
                          }`}
                        >
                          <PipelineCard
                            ticket={t}
                            onEscalate={onEscalate}
                            onResolve={onResolve}
                            now={now}
                          />
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </section>

        {/* Team workload */}
        <section className={styles.workloadSection}>
          <header className={styles.workloadHeader}>
            <div>
              <h2 className={styles.workloadTitle}>
                <Users size={18} /> Who&rsquo;s working on what
              </h2>
              <p className={styles.workloadSubtitle}>
                Live snapshot of every team member&rsquo;s active queue.
                {counts.totalActive ? ` Total active across the team: ${counts.totalActive}.` : ''}
              </p>
            </div>
            {counts.criticalActive > 0 && (
              <span className={styles.criticalPill}>
                <AlertTriangle size={12} /> {counts.criticalActive} P1 active
              </span>
            )}
          </header>
          <div className={styles.workloadGrid}>
            {teamWorkload.length === 0 ? (
              <div className={styles.workloadEmpty}>No staff members loaded.</div>
            ) : (
              teamWorkload.map((tw) => (
                <TeamCard key={tw.userId} member={tw} now={now} />
              ))
            )}
          </div>
        </section>

        {/* Escalation log */}
        <section className={styles.logSection}>
          <header className={styles.logHeader}>
            <div>
              <h2 className={styles.logTitle}>
                <Activity size={18} /> Escalation Log
              </h2>
              <p className={styles.logSubtitle}>
                Last {Math.min(20, data?.escalationLog?.length ?? 0)} events, newest first
              </p>
            </div>
            <span className={styles.logHint}>
              <FileSpreadsheet size={14} /> live feed
            </span>
          </header>
          <div className={styles.logTableWrap}>
            <table className={styles.logTable}>
              <thead>
                <tr>
                  <th>Time</th><th>Ticket</th><th>From → To</th><th>By</th>
                  <th>Reason</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {(data?.escalationLog || []).slice(0, 25).map((row) => (
                  <tr key={row.id}>
                    <td className={styles.logTime}>{timeShort(row.escalatedAt)}</td>
                    <td className={styles.logTicket}>
                      {row.ticketNumber ? (
                        <Link href={`/tickets/${row.ticketNumber}`} className={styles.logTicketLink}>
                          {row.ticketNumber}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className={styles.logArrow}>
                      <span>{levelLabel(row.fromLevel)}</span>
                      <ArrowUp size={12} />
                      <span className={row.toLevel === 3 ? styles.logToL3 : styles.logToL2}>
                        {levelLabel(row.toLevel)}
                      </span>
                    </td>
                    <td className={styles.logBy}>
                      {row.fromUserName ? (
                        <span className={styles.logByChip}>
                          <span className={styles.logByAvatar}>{initialsOf(row.fromUserName)}</span>
                          <span>{row.fromUserName}</span>
                        </span>
                      ) : (
                        <span className={styles.logBySystem}>System</span>
                      )}
                    </td>
                    <td className={styles.logReason} title={row.reason || ''}>{row.reason || '—'}</td>
                    <td>
                      <span className={`${styles.logBadge} ${
                        row.escalationType === 'AUTO' ? styles.logBadgeSystem : styles.logBadgeUser
                      }`}>
                        {row.escalationType === 'AUTO' ? 'System' : 'User'}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.escalationLog || data.escalationLog.length === 0) && (
                  <tr>
                    <td colSpan={6} className={styles.logEmpty}>
                      No escalations logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, tone = 'info', pulseKey = 0 }) {
  return (
    <motion.div
      key={`${label}-${pulseKey}`}
      initial={{ scale: pulseKey ? 1.02 : 1 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.32 }}
      className={`${styles.kpi} ${styles[`kpi_${tone}`]}`}
    >
      <div className={styles.kpiIcon} aria-hidden="true">{icon}</div>
      <div className={styles.kpiBody}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}>{value}</span>
      </div>
    </motion.div>
  );
}

function PipelineCard({ ticket, onEscalate, onResolve, now }) {
  const opened = describeOpen(minutesSince(ticket.createdAt));
  const breached = isFinalBreached(ticket, now);
  const breachAgo = breached && ticket.slaDeadlineFinal
    ? describeAgo(ticket.slaDeadlineFinal)
    : null;
  return (
    <Link
      href={`/tickets/${ticket.ticketNumber}`}
      className={styles.ticketCardLink}
    >
      <div className={styles.ticketCardTop}>
        <span className={styles.ticketCardNumber}>{ticket.ticketNumber}</span>
        <PriorityBadge priority={ticket.priority} />
      </div>
      <h4 className={styles.ticketCardTitle}>
        {(ticket.problemCategory || 'Service request').replace(/_/g, ' ').toLowerCase()}
      </h4>
      <div className={styles.ticketCardMeta}>
        <Clock size={12} /> {opened}
      </div>
      {breached && (
        <div className={styles.breachChip}>
          <ShieldAlert size={12} />
          BREACHED {breachAgo}
        </div>
      )}
      {(ticket.currentLevel === 2 || (breached && ticket.currentLevel < 3)) && (
        <div className={styles.ticketCardActions} onClick={(e) => e.preventDefault()}>
          {ticket.currentLevel < 3 && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnEscalate}`}
              onClick={(e) => { e.preventDefault(); onEscalate(ticket); }}
            >
              Escalate to L{ticket.currentLevel + 1} <ArrowUp size={14} />
            </button>
          )}
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnResolve}`}
            onClick={(e) => { e.preventDefault(); onResolve(ticket); }}
          >
            Resolve <CheckCircle2 size={14} />
          </button>
        </div>
      )}
      <ChevronRight size={16} className={styles.ticketCardChev} />
    </Link>
  );
}

function TeamCard({ member, now }) {
  const meta = roleMeta(member.role);
  const RoleIcon = meta.icon;
  const breached = (member.tickets || []).filter((t) => isFinalBreached(t, now)).length;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className={`${styles.teamCard} ${styles[`teamCard_${meta.tone}`]}`}
    >
      <header className={styles.teamCardTop}>
        <div className={styles.teamAvatar}>{initialsOf(member.name)}</div>
        <div className={styles.teamCardIdent}>
          <h3 className={styles.teamName}>{member.name}</h3>
          <span className={styles.teamRolePill}>
            <RoleIcon size={11} /> {meta.label} <span className={styles.teamLevelTag}>{meta.short}</span>
          </span>
        </div>
        <div className={styles.teamCount}>
          <span className={styles.teamCountValue}>{member.activeCount}</span>
          <span className={styles.teamCountLabel}>active</span>
        </div>
      </header>
      <div className={styles.teamPills}>
        {member.criticalCount > 0 && (
          <span className={styles.teamPillCritical}>{member.criticalCount} P1</span>
        )}
        {breached > 0 && (
          <span className={styles.teamPillBreach}>{breached} breach</span>
        )}
        {member.activeCount === 0 && (
          <span className={styles.teamPillIdle}>Idle</span>
        )}
      </div>
      <div className={styles.teamTickets}>
        {(member.tickets || []).length === 0 ? (
          <p className={styles.teamEmpty}>Inbox clear.</p>
        ) : (
          (member.tickets || []).map((t) => (
            <Link
              key={t.id || t.ticketNumber}
              href={`/tickets/${t.ticketNumber}`}
              className={`${styles.teamTicket} ${
                isFinalBreached(t, now) ? styles.teamTicketBreached : ''
              }`}
            >
              <div className={styles.teamTicketTop}>
                <span className={styles.teamTicketNumber}>{t.ticketNumber}</span>
                <PriorityBadge priority={t.priority} />
              </div>
              <span className={styles.teamTicketSubject}>
                {(t.problemCategory || 'Service').replace(/_/g, ' ').toLowerCase()}
                {t.customerName ? ` · ${t.customerName}` : ''}
              </span>
              <span className={styles.teamTicketMeta}>
                <Clock size={11} /> {describeOpen(minutesSince(t.createdAt))}
                {isFinalBreached(t, now) && (
                  <span className={styles.teamTicketBreachTag}>
                    <ShieldAlert size={11} /> BREACHED
                  </span>
                )}
              </span>
            </Link>
          ))
        )}
      </div>
    </motion.div>
  );
}

/* ─── Approval Queue Tile ───────────────────────────────── */
function ApprovalQueueTile({ kind, count, items, busyId, onApprove, onReject, onSend }) {
  const [open, setOpen] = useState(false);
  const isQuote = kind === 'quote';
  const Icon = isQuote ? FileText : Package;
  const title = isQuote ? 'Quote approvals' : 'Part approvals';
  const tone = count > 0 ? 'warn' : 'success';

  return (
    <div className={`${styles.kpi} ${styles[`kpi_${tone}`]}`}
         style={{ gridColumn: 'span 2', minHeight: 110, flexDirection: 'column', alignItems: 'stretch', padding: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Icon size={20} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--on-surface-variant)' }}>{title}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--on-surface)' }}>{count}</div>
        </div>
        {count > 0 && (
          <button onClick={() => setOpen(!open)}
                  style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid var(--outline-variant)',
                           background: 'var(--surface-container-lowest)', color: 'var(--on-surface)',
                           fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {open ? 'Hide' : 'Review'}
          </button>
        )}
      </header>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto', paddingTop: 6 }}>
          {items.length === 0 && (
            <div style={{ padding: 12, color: 'var(--on-surface-variant)', fontSize: 13 }}>
              Nothing waiting.
            </div>
          )}
          {items.map((it) => (
            <div key={it.id}
                 style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                          background: 'var(--surface-container-lowest)',
                          border: '1px solid var(--outline-variant)', borderRadius: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {isQuote
                    ? `${it.quoteNumber} v${it.version} — ${it.installNumber || it.ticketNumber || ''}`
                    : `${it.partName} ×${it.quantity} — ${it.ticketNumber}`}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                  {isQuote
                    ? <>₹{Number(it.total || 0).toLocaleString('en-IN')} · {it.requiredApprovalBand} · by {it.preparedByName}</>
                    : <>₹{Number(it.totalCost || 0).toLocaleString('en-IN')} · {it.requiredApprovalBand} · {it.urgency || 'NORMAL'} · by {it.requestedByName}</>}
                </div>
              </div>
              <button onClick={() => onReject(it)} disabled={busyId === it.id}
                      title="Reject"
                      style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid var(--outline-variant)',
                               background: 'var(--surface-container-lowest)', cursor: 'pointer',
                               color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ThumbsDown size={14} />
              </button>
              <button onClick={() => onApprove(it)} disabled={busyId === it.id}
                      title="Approve"
                      style={{ width: 32, height: 32, borderRadius: 999, border: 'none',
                               background: 'var(--success)', color: '#fff', cursor: 'pointer',
                               display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ThumbsUp size={14} />
              </button>
              {isQuote && it.status === 'APPROVED' && onSend && (
                <button onClick={() => onSend(it)} disabled={busyId === it.id}
                        title="Send to customer"
                        style={{ width: 32, height: 32, borderRadius: 999, border: 'none',
                                 background: 'var(--primary)', color: '#fff', cursor: 'pointer',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyColumn({ level }) {
  const text = level === 3
    ? 'No tickets at management level'
    : level === 2
      ? 'No active escalations'
      : 'No tickets at L1';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={styles.emptyState}
    >
      <CheckCircle2 size={32} />
      <p>{text}</p>
    </motion.div>
  );
}
