'use client';

/**
 * Service Manager Escalation Management — Rose Luxury redesign.
 *
 * Shows escalated tickets across L1/L2/L3, approval queues for quotes &
 * parts, live team workload, and a real-time escalation log. Refreshes
 * every 25 s and pings via /topic/escalation/dashboard STOMP.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Timer,
  CheckCircle2,
  ShieldAlert,
  ChevronRight,
  ArrowUp,
  Clock,
  RefreshCw,
  Search,
  Activity,
  Users,
  UserCheck,
  Headset,
  Wrench,
  Crown,
  Tag,
  FileText,
  Package,
  ThumbsUp,
  ThumbsDown,
  Send,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import {
  dashboard as dashboardApi,
  ticketActions,
  parts as partsApi,
  quotes as quotesApi,
} from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import useStompTopic from '@/hooks/useStompTopic';
import PriorityBadge from '@/components/ui/PriorityBadge';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
import styles from './admin.module.css';

const COLUMNS = [
  { level: 1, key: 'l1', title: 'L1 (CRM)' },
  { level: 2, key: 'l2', title: 'L2 (Managers)' },
  { level: 3, key: 'l3', title: 'L3 (Management)' },
];

function minutesSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}
function describeAge(iso) {
  const m = minutesSince(iso);
  if (m == null) return '';
  if (m < 60) return `${m}m old`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return `${h}h ${rem || ''}${rem ? 'm' : ''} old`.trim();
  return `${Math.floor(h / 24)}d old`;
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
    case 'CRM_AGENT':       return { label: 'CRM Agent',       short: 'L1', icon: Headset };
    case 'SERVICE_MANAGER': return { label: 'Service Manager', short: 'L2', icon: Wrench  };
    case 'ADMIN':           return { label: 'Management',      short: 'L3', icon: Crown   };
    default:                return { label: role || '—',        short: '',   icon: UserCheck };
  }
}

/* ────────────────────────────────────────────────────────── */
export default function AdminEscalationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [pulse, setPulse] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [quoteQueue, setQuoteQueue] = useState([]);
  const [partQueue, setPartQueue]   = useState([]);
  const [busyId, setBusyId]         = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/admin'); return; }
    if (!['SERVICE_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

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

  useEffect(() => {
    if (!user) return;
    fetchData();
    const interval = setInterval(() => fetchData(true), 25000);
    return () => clearInterval(interval);
  }, [user, fetchData]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useStompTopic('/topic/escalation/dashboard', (msg) => {
    if (msg?.event?.startsWith?.('ESCALATED_TO_L')) {
      toast.info(`${msg.ticketNumber} escalated to L${msg.toLevel}`);
    }
    setPulse((p) => p + 1);
    fetchData(true);
  });

  /* ── Actions ───────────────────────────────────────────── */
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
  const onEscalate = async (t) => {
    if (t.currentLevel >= 3) return;
    try {
      await ticketActions.escalate(t.ticketNumber, {
        reason: `Escalated to L${t.currentLevel + 1} by ${user?.name || 'Manager'}`,
      });
      toast.success(`${t.ticketNumber} escalated to L${t.currentLevel + 1}`);
      fetchData(true);
    } catch (err) { toast.error(err?.message || 'Escalation failed'); }
  };
  const onResolve = async (t) => {
    try {
      await ticketActions.resolve(t.ticketNumber, {
        resolutionNotes: `Resolved at L${t.currentLevel} by ${user?.name || 'Manager'}`,
      });
      toast.success(`${t.ticketNumber} marked resolved`);
      fetchData(true);
    } catch (err) { toast.error(err?.message || 'Resolve failed'); }
  };

  /* ── Derived ───────────────────────────────────────────── */
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

  const teamWorkload = useMemo(() => {
    if (!data?.teamWorkload) return [];
    return data.teamWorkload.map((tw) => ({
      ...tw,
      tickets: (tw.tickets || []).filter(filterTicket),
    }));
  }, [data, filterTicket]);

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

  if (authLoading || !user || (loading && !data)) {
    return <RoseSplash message="Loading Escalation Management…" />;
  }

  const hero = (
    <div className={styles.heroRow}>
      <div className={styles.heroText}>
        <h1 className={styles.heroTitle}>Escalation Management</h1>
        <p className={styles.heroSub}>
          Approve work, balance load, and break SLAs before they break you.
        </p>
      </div>
      <div className={styles.heroActions}>
        <div className={styles.searchBox}>
          <Search size={16} />
          <input
            placeholder="Search ticket, problem, customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => fetchData()}
          disabled={refreshing}
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={refreshing ? styles.spin : ''} />
        </button>
        <Link href="/admin/coupons" className={styles.refreshBtn} aria-label="Discount coupons" title="Discount coupons">
          <Tag size={16} />
        </Link>
      </div>
    </div>
  );

  return (
    <RoseShell hero={hero}>
      {/* ── 4 KPI tiles ─────────────────────────────────── */}
      <section className={styles.kpis}>
        <KpiTile
          icon={AlertTriangle}
          label="Escalated Now"
          value={data?.escalatedNow ?? 0}
          unit="active"
          danger={(data?.escalatedNow ?? 0) > 0}
          pulseKey={pulse}
        />
        <KpiTile
          icon={Timer}
          label="Avg Response"
          value={data?.avgResponseMinutes != null ? `${Math.round(data.avgResponseMinutes)}` : '—'}
          unit={data?.avgResponseMinutes != null ? 'min' : ''}
        />
        <KpiTile
          icon={ShieldAlert}
          label="SLA Breach Today"
          value={data?.slaBreachToday ?? breachedCount}
          unit="incidents"
          pulseKey={pulse}
        />
        <KpiTile
          icon={CheckCircle2}
          label="Resolved Today"
          value={data?.resolvedToday ?? 0}
          unit="tickets"
          tone="success"
        />
      </section>

      {/* ── Approval queues ───────────────────────────── */}
      <section className={styles.approvals}>
        <ApprovalCard
          kind="quote"
          items={quoteQueue}
          busyId={busyId}
          onApprove={approveQuote}
          onReject={rejectQuote}
          onSend={sendQuote}
        />
        <ApprovalCard
          kind="part"
          items={partQueue}
          busyId={busyId}
          onApprove={approvePart}
          onReject={rejectPart}
        />
      </section>

      {/* ── Pipeline (L1 / L2 / L3) ───────────────────── */}
      <section className={styles.pipelineSection}>
        <header className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Escalation Pipeline</h2>
          {counts.totalActive > 0 && (
            <span className={styles.sectionMeta}>
              {counts.totalActive} active{counts.criticalActive ? ` · ${counts.criticalActive} P1` : ''}
            </span>
          )}
        </header>
        <div className={styles.pipeline}>
          {COLUMNS.map((col) => {
            const tickets = filtered[col.key];
            const breachedInCol = tickets.filter((t) => isFinalBreached(t, now)).length;
            const totalForLevel = counts[col.key] ?? tickets.length;
            const showingFiltered = q && tickets.length !== totalForLevel;
            return (
              <article key={col.key} className={styles.column}>
                <header className={styles.columnHead}>
                  <h3 className={styles.columnTitle}>{col.title}</h3>
                  <div className={styles.columnMeta}>
                    <span className={styles.columnCount}>
                      {showingFiltered ? `${tickets.length}/${totalForLevel}` : totalForLevel}
                    </span>
                    {breachedInCol > 0 && (
                      <span className={styles.breachTag}>
                        <AlertTriangle size={11} /> {breachedInCol} Breach
                      </span>
                    )}
                  </div>
                </header>
                <div className={styles.columnBody}>
                  <AnimatePresence mode="popLayout">
                    {tickets.length === 0 ? (
                      <EmptyCol level={col.level} />
                    ) : (
                      tickets.map((t) => (
                        <motion.div
                          key={t.id || t.ticketNumber}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
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
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Team workload (extra context preserved) ───── */}
      {teamWorkload.length > 0 && (
        <section className={styles.teamSection}>
          <header className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              <Users size={18} className={styles.sectionIcon} /> Who&rsquo;s on what
            </h2>
            <span className={styles.sectionMeta}>
              Live snapshot of every member&rsquo;s active queue
            </span>
          </header>
          <div className={styles.teamGrid}>
            {teamWorkload.map((tw) => (
              <TeamCard key={tw.userId} member={tw} now={now} />
            ))}
          </div>
        </section>
      )}

      {/* ── Escalation log ────────────────────────────── */}
      {(data?.escalationLog || []).length > 0 && (
        <section className={styles.logSection}>
          <header className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              <Activity size={18} className={styles.sectionIcon} /> Escalation Log
            </h2>
            <span className={styles.sectionMeta}>
              Last {Math.min(25, data.escalationLog.length)} events
            </span>
          </header>
          <div className={styles.logWrap}>
            <table className={styles.logTable}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Ticket</th>
                  <th>From → To</th>
                  <th>By</th>
                  <th>Reason</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {data.escalationLog.slice(0, 25).map((row) => (
                  <tr key={row.id}>
                    <td className={styles.logMeta}>{timeShort(row.escalatedAt)}</td>
                    <td>
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
                    <td>
                      {row.fromUserName ? (
                        <span className={styles.logBy}>
                          <span className={styles.logByAv}>{initialsOf(row.fromUserName)}</span>
                          {row.fromUserName}
                        </span>
                      ) : (
                        <span className={styles.logMeta}>System</span>
                      )}
                    </td>
                    <td className={styles.logReason} title={row.reason || ''}>{row.reason || '—'}</td>
                    <td>
                      <span className={`${styles.logSrc} ${row.escalationType === 'AUTO' ? styles.logSrcAuto : styles.logSrcUser}`}>
                        {row.escalationType === 'AUTO' ? 'System' : 'User'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </RoseShell>
  );
}

/* ─── Subcomponents ─────────────────────────────────────── */

function KpiTile({ icon: Icon, label, value, unit, danger, tone, pulseKey }) {
  return (
    <motion.div
      key={`${label}-${pulseKey || 0}`}
      initial={{ scale: pulseKey ? 1.02 : 1 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.32 }}
      className={`${styles.kpi} ${danger ? styles.kpiDanger : ''} ${tone === 'success' ? styles.kpiSuccess : ''}`}
    >
      <header className={styles.kpiHead}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIcon}>
          <Icon size={16} />
        </span>
      </header>
      <div className={styles.kpiBody}>
        <span className={styles.kpiValue}>{value}</span>
        {unit && <span className={styles.kpiUnit}>{unit}</span>}
      </div>
    </motion.div>
  );
}

function ApprovalCard({ kind, items, busyId, onApprove, onReject, onSend }) {
  const isQuote = kind === 'quote';
  const Icon = isQuote ? FileText : Package;
  const title = isQuote ? 'Quote approvals' : 'Part approvals';
  const empty = isQuote ? 'No quotes waiting.' : 'No parts to approve.';

  return (
    <article className={styles.approvalCard}>
      <header className={styles.approvalHead}>
        <h2 className={styles.approvalTitle}>
          <Icon size={18} className={styles.sectionIcon} /> {title}
        </h2>
        <span className={`${styles.pendingChip} ${items.length > 0 ? styles.pendingChipOn : ''}`}>
          {items.length} pending
        </span>
      </header>
      <div className={styles.approvalBody}>
        {items.length === 0 ? (
          <p className={styles.approvalEmpty}>{empty}</p>
        ) : (
          items.slice(0, 5).map((it) => (
            <div key={it.id} className={styles.approvalItem}>
              <div className={styles.approvalItemBody}>
                <p className={styles.approvalItemTitle}>
                  {isQuote
                    ? `${it.quoteNumber} v${it.version} — ${it.installNumber || it.ticketNumber || ''}`
                    : `${it.partName} ×${it.quantity} — ${it.ticketNumber}`}
                </p>
                <p className={styles.approvalItemMeta}>
                  {isQuote ? (
                    <>
                      Req: {it.preparedByName || 'CRM'} · ₹{Number(it.total || 0).toLocaleString('en-IN')} ·{' '}
                      <span className={styles.approvalBand}>{it.requiredApprovalBand}</span>
                    </>
                  ) : (
                    <>
                      {it.ticketNumber} · ETA: {it.urgency || 'NORMAL'} · ₹{Number(it.totalCost || 0).toLocaleString('en-IN')}
                    </>
                  )}
                </p>
              </div>
              <div className={styles.approvalActions}>
                <button
                  type="button"
                  className={styles.approveReject}
                  onClick={() => onReject(it)}
                  disabled={busyId === it.id}
                  aria-label="Reject"
                  title="Reject"
                >
                  <ThumbsDown size={14} />
                </button>
                <button
                  type="button"
                  className={styles.approveAccept}
                  onClick={() => onApprove(it)}
                  disabled={busyId === it.id}
                  aria-label="Approve"
                  title="Approve"
                >
                  <ThumbsUp size={14} />
                </button>
                {isQuote && it.status === 'APPROVED' && onSend && (
                  <button
                    type="button"
                    className={styles.approveSend}
                    onClick={() => onSend(it)}
                    disabled={busyId === it.id}
                    aria-label="Send to customer"
                    title="Send to customer"
                  >
                    <Send size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {items.length > 5 && (
          <p className={styles.approvalMore}>+ {items.length - 5} more waiting</p>
        )}
      </div>
    </article>
  );
}

function PipelineCard({ ticket, onEscalate, onResolve, now }) {
  const breached = isFinalBreached(ticket, now);
  const age = describeAge(ticket.createdAt);

  return (
    <article className={`${styles.ticket} ${breached ? styles.ticketBreached : ''}`}>
      <header className={styles.ticketHead}>
        <Link href={`/tickets/${ticket.ticketNumber}`} className={styles.ticketNumber}>
          {ticket.ticketNumber}
        </Link>
        <span className={styles.ticketAge}>{age}</span>
      </header>
      <Link href={`/tickets/${ticket.ticketNumber}`} className={styles.ticketTitle}>
        {(ticket.problemCategory || 'Service request').replace(/_/g, ' ').toLowerCase()}
      </Link>
      <div className={styles.ticketTags}>
        <PriorityBadge priority={ticket.priority} />
        {breached && (
          <span className={styles.slaBreach}>
            <ShieldAlert size={10} /> SLA BREACH
          </span>
        )}
        {ticket.problemCategory && (
          <span className={styles.ticketTag}>
            {ticket.problemCategory.replace(/_/g, ' ').toLowerCase()}
          </span>
        )}
      </div>
      {(ticket.currentLevel === 2 || (breached && ticket.currentLevel < 3)) && (
        <div className={styles.ticketActions}>
          {ticket.currentLevel < 3 && (
            <button
              type="button"
              className={styles.ticketActionEscalate}
              onClick={() => onEscalate(ticket)}
            >
              Escalate L{ticket.currentLevel + 1} <ArrowUp size={12} />
            </button>
          )}
          <button
            type="button"
            className={styles.ticketActionResolve}
            onClick={() => onResolve(ticket)}
          >
            Resolve <CheckCircle2 size={12} />
          </button>
        </div>
      )}
    </article>
  );
}

function EmptyCol({ level }) {
  const txt = level === 3
    ? 'No tickets at management level'
    : level === 2
      ? 'No active escalations'
      : 'No tickets at L1';
  return (
    <div className={styles.colEmpty}>
      <CheckCircle2 size={28} strokeWidth={1.5} />
      <p>{txt}</p>
    </div>
  );
}

function TeamCard({ member, now }) {
  const meta = roleMeta(member.role);
  const RoleIcon = meta.icon;
  const breached = (member.tickets || []).filter((t) => isFinalBreached(t, now)).length;
  return (
    <article className={styles.teamCard}>
      <header className={styles.teamHead}>
        <span className={styles.teamAv}>{initialsOf(member.name)}</span>
        <div className={styles.teamIdent}>
          <p className={styles.teamName}>{member.name}</p>
          <p className={styles.teamRole}>
            <RoleIcon size={11} /> {meta.label} <span className={styles.teamLevel}>{meta.short}</span>
          </p>
        </div>
        <div className={styles.teamCount}>
          <span className={styles.teamCountVal}>{member.activeCount}</span>
          <span className={styles.teamCountLbl}>active</span>
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
          member.tickets.slice(0, 3).map((t) => (
            <Link
              key={t.id || t.ticketNumber}
              href={`/tickets/${t.ticketNumber}`}
              className={`${styles.teamTicket} ${isFinalBreached(t, now) ? styles.teamTicketBreached : ''}`}
            >
              <span className={styles.teamTicketNum}>{t.ticketNumber}</span>
              <span className={styles.teamTicketSubject}>
                {(t.problemCategory || 'Service').replace(/_/g, ' ').toLowerCase()}
              </span>
              <span className={styles.teamTicketAge}>
                <Clock size={10} /> {describeAge(t.createdAt)}
              </span>
            </Link>
          ))
        )}
        {(member.tickets || []).length > 3 && (
          <p className={styles.teamMore}>+ {member.tickets.length - 3} more</p>
        )}
      </div>
    </article>
  );
}
