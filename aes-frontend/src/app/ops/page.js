'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox, Headset, Wrench, AlertTriangle, Clock, Bell, RefreshCw,
  Search, LogOut, ChevronRight, Building2, Send, ArrowUpRight,
  Activity, CheckCircle2, X, MapPin, User, PackageSearch, Crown,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { dashboard, ops as opsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import useStompTopic from '@/hooks/useStompTopic';
import Logo from '@/components/ui/Logo';
import PriorityBadge from '@/components/ui/PriorityBadge';
import styles from './ops.module.css';

const PRIORITY_FILTERS = ['All', 'P1', 'P2', 'P3'];

function minutesAgo(iso) {
  if (!iso) return '';
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function ageBadge(min) {
  if (min == null) return '';
  if (min < 60) return `${min} min open`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m open`;
}
function initials(name) {
  return (name || '?').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
function inr(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
}

const STATUS_TONE = {
  NEW:                     { tone: 'new',  label: 'NEW' },
  OFFERED_CRM:             { tone: 'wait', label: 'OFFERED → CRM' },
  OFFERED_ENGINEER:        { tone: 'wait', label: 'OFFERED → ENG' },
  ESCALATED_BY_CUSTOMER:   { tone: 'esc',  label: 'CUSTOMER ESCALATED' },
  ACKNOWLEDGED:            { tone: 'ack',  label: 'ACKNOWLEDGED' },
  ASSIGNED:                { tone: 'work', label: 'ASSIGNED' },
  EN_ROUTE:                { tone: 'work', label: 'EN ROUTE' },
  ON_SITE:                 { tone: 'work', label: 'ON SITE' },
  IN_PROGRESS:             { tone: 'work', label: 'IN PROGRESS' },
  WAITING_PART:            { tone: 'wait', label: 'WAITING PART' },
  WAITING_CUSTOMER_APPROVAL: { tone: 'wait', label: 'AWAITING QUOTE' },
  QUOTE_DRAFT:             { tone: 'wait', label: 'QUOTE DRAFT' },
  QUOTE_PENDING_APPROVAL:  { tone: 'wait', label: 'QUOTE PENDING' },
  QUOTE_SENT:              { tone: 'wait', label: 'QUOTE SENT' },
};

function statusPill(status) {
  const t = STATUS_TONE[status] || { tone: 'new', label: status || '—' };
  return <span className={`${styles.statusPill} ${styles[`tone_${t.tone}`]}`}>{t.label}</span>;
}

export default function OpsDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading, logout } = useAuth();
  const { unread } = useNotifications();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [search, setSearch]   = useState('');
  const [priority, setPriority] = useState('All');
  const [stage, setStage]     = useState('all'); // 'all' | 'untriaged' | 'awaiting-crm' | 'escalated'
  const [assignFor, setAssignFor] = useState(null); // inbox item
  const [busyId, setBusyId]   = useState(null);

  // Guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/ops'); return; }
    if (user.role !== 'OPS_MANAGER' && user.role !== 'ADMIN') {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setRefresh(true);
    try {
      const dash = await dashboard.ops();
      setData(dash);
    } catch (err) {
      if (!silent) toast.error(err?.message || 'Could not load ops dashboard');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
    const id = setInterval(() => fetchAll(true), 15000);
    return () => clearInterval(id);
  }, [user, fetchAll]);

  useStompTopic(user ? '/topic/ops/inbox' : null, () => fetchAll(true));

  const inbox = data?.inbox || [];
  const crm   = data?.crmWorkload || [];
  const eng   = data?.engineers || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inbox.filter((i) => {
      if (priority !== 'All' && i.priority !== priority) return false;
      if (stage === 'untriaged' && !['NEW', 'PENDING'].includes(i.status)) return false;
      if (stage === 'awaiting-crm' && i.status !== 'OFFERED_CRM') return false;
      if (stage === 'escalated' && i.status !== 'ESCALATED_BY_CUSTOMER') return false;
      if (q && !`${i.referenceNumber} ${i.customerName} ${i.headline} ${i.locality}`
        .toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (b.ageMinutes || 0) - (a.ageMinutes || 0));
  }, [inbox, search, priority, stage]);

  if (authLoading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  const tiles = [
    { label: 'Untriaged', value: data?.untriagedTickets ?? 0, icon: Inbox,        tone: 'new'  },
    { label: 'Awaiting CRM', value: data?.awaitingCrmAccept ?? 0, icon: Headset,  tone: 'wait' },
    { label: 'Awaiting Engineer', value: data?.awaitingEngineerAccept ?? 0, icon: Wrench, tone: 'wait' },
    { label: 'Customer escalated', value: data?.escalatedByCustomer ?? 0, icon: AlertTriangle, tone: 'esc' },
    { label: 'New installs', value: data?.untriagedInstalls ?? 0, icon: Building2, tone: 'install' },
    { label: 'SLA red zone', value: data?.slaRedZone ?? 0, icon: Clock, tone: 'red' },
  ];

  return (
    <div className={styles.shell}>
      {/* ─── Top bar ────────────────────────────────────────────── */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <Logo />
          <span className={styles.topBarRole}>Ops Manager · Triage & Dispatch</span>
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket #, customer, area…"
            />
          </div>
          <Link href="/notifications" className={styles.iconBtn} aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && <span className={styles.notifDot}>{unread > 9 ? '9+' : unread}</span>}
          </Link>
          <button className={styles.iconBtn} aria-label="Refresh" onClick={() => fetchAll()} disabled={refreshing}>
            <RefreshCw size={18} className={refreshing ? styles.spin : ''} />
          </button>
          <span className={styles.agentBadge}>
            <span className={styles.agentAv}>{initials(user.name)}</span>
            {user.name?.split(' ')[0]}
          </span>
          <button className={styles.iconBtn} aria-label="Sign out" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ─── KPI tiles ─────────────────────────────────────────── */}
      <section className={styles.kpiStrip}>
        {tiles.map((t) => (
          <div key={t.label} className={`${styles.kpi} ${styles[`kpi_${t.tone}`]}`}>
            <t.icon size={18} />
            <div className={styles.kpiBody}>
              <div className={styles.kpiVal}>{loading ? '—' : t.value}</div>
              <div className={styles.kpiLabel}>{t.label}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ─── Three-column board ─────────────────────────────────── */}
      <main className={styles.board}>
        {/* INBOX */}
        <section className={`${styles.col} ${styles.colInbox}`}>
          <header className={styles.colHeader}>
            <h2><Inbox size={16} /> Triage Inbox</h2>
            <span className={styles.colCount}>{filtered.length}</span>
          </header>
          <div className={styles.filtersRow}>
            <div className={styles.chipGroup}>
              {[
                { k: 'all',          label: 'All' },
                { k: 'untriaged',    label: 'New' },
                { k: 'awaiting-crm', label: 'Awaiting CRM' },
                { k: 'escalated',    label: 'Escalated' },
              ].map((c) => (
                <button key={c.k}
                        className={`${styles.chip} ${stage === c.k ? styles.chipOn : ''}`}
                        onClick={() => setStage(c.k)}>{c.label}</button>
              ))}
            </div>
            <div className={styles.chipGroup}>
              {PRIORITY_FILTERS.map((p) => (
                <button key={p}
                        className={`${styles.chip} ${priority === p ? styles.chipOn : ''}`}
                        onClick={() => setPriority(p)}>{p}</button>
              ))}
            </div>
          </div>

          <div className={styles.list}>
            {loading && (
              <div className={styles.empty}><div className="spinner" /></div>
            )}
            {!loading && filtered.length === 0 && (
              <div className={styles.empty}>
                <CheckCircle2 size={32} />
                <p>Inbox is clear.</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {filtered.map((i) => (
                <motion.article
                  key={i.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={styles.card}
                >
                  <div className={styles.cardTop}>
                    <PriorityBadge priority={i.priority} />
                    {statusPill(i.status)}
                    {i.kind === 'INSTALL' && (
                      <span className={styles.installBadge}>
                        <Building2 size={12} /> Install
                      </span>
                    )}
                    <span className={styles.ageBadge}>{ageBadge(i.ageMinutes)}</span>
                  </div>
                  <div className={styles.cardTitleRow}>
                    <h3 className={styles.cardTitle}>
                      {i.referenceNumber} — {i.headline || 'Customer service'}
                    </h3>
                  </div>
                  <div className={styles.cardMeta}>
                    <span><User size={12} /> {i.customerName || '—'}</span>
                    {i.locality && <span><MapPin size={12} /> {i.locality}</span>}
                    {i.offeredToName && (
                      <span className={styles.offerBadge}>
                        → {i.offeredToName} ({Math.max(0, Math.round((i.offerSecondsUntilExpiry || 0) / 60))}m)
                      </span>
                    )}
                  </div>
                  {i.escalationReason && (
                    <div className={styles.escNote}>
                      <AlertTriangle size={12} /> {i.escalationReason}
                    </div>
                  )}
                  <div className={styles.cardActions}>
                    <Link href={i.kind === 'INSTALL' ? `/admin?install=${i.referenceNumber}` : `/tickets/${i.referenceNumber}`}
                          className={styles.btnGhost}>
                      Open <ChevronRight size={14} />
                    </Link>
                    <button className={styles.btnPrimary}
                            onClick={() => setAssignFor(i)}
                            disabled={busyId === i.id}>
                      <Send size={14} /> {i.offeredToName ? 'Reassign' : 'Assign'}
                    </button>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* CRM WORKLOAD */}
        <section className={`${styles.col} ${styles.colCrm}`}>
          <header className={styles.colHeader}>
            <h2><Headset size={16} /> CRM Workload</h2>
            <span className={styles.colCount}>{crm.length}</span>
          </header>
          <div className={styles.list}>
            {crm.length === 0 && (
              <div className={styles.empty}><p>No CRM agents on the roster.</p></div>
            )}
            {crm.map((c) => (
              <article key={c.userId} className={styles.staffCard}>
                <div className={styles.staffHead}>
                  <span className={styles.staffAv}>{initials(c.name)}</span>
                  <div>
                    <div className={styles.staffName}>{c.name}</div>
                    <div className={styles.staffMeta}>
                      <span className={c.onShift ? styles.dotOn : styles.dotOff} />
                      {c.onShift ? 'On shift' : 'Off shift'}
                      {c.branch && <> · {c.branch}</>}
                    </div>
                  </div>
                </div>
                <div className={styles.staffStats}>
                  <div><span>{c.activeTickets}</span>Tickets</div>
                  <div><span>{c.activeInstalls}</span>Installs</div>
                  <div className={c.pendingOffers > 0 ? styles.pulseOff : ''}><span>{c.pendingOffers}</span>Pending</div>
                  <div><span>{c.resolvedToday}</span>Solved</div>
                </div>
                <div className={styles.loadBar}>
                  <div className={styles.loadBarFill}
                       style={{ width: `${Math.min(100, ((c.activeTickets + c.activeInstalls) / Math.max(1, c.maxConcurrentLoad)) * 100)}%`,
                                background: c.overloaded ? 'var(--error)' : 'var(--secondary)' }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ENGINEERS */}
        <section className={`${styles.col} ${styles.colEng}`}>
          <header className={styles.colHeader}>
            <h2><Wrench size={16} /> Engineer Availability</h2>
            <span className={styles.colCount}>{eng.length}</span>
          </header>
          <div className={styles.list}>
            {eng.length === 0 && <div className={styles.empty}><p>No engineers on shift.</p></div>}
            {eng.map((e) => (
              <article key={e.userId} className={styles.staffCard}>
                <div className={styles.staffHead}>
                  <span className={styles.staffAv}>{initials(e.name)}</span>
                  <div>
                    <div className={styles.staffName}>{e.name}</div>
                    <div className={styles.staffMeta}>
                      <span className={e.onShift ? styles.dotOn : styles.dotOff} />
                      {e.onShift ? 'Available' : 'Off shift'}
                      {e.branch && <> · {e.branch}</>}
                    </div>
                  </div>
                </div>
                <div className={styles.staffStats}>
                  <div><span>{e.activeJobs}</span>Jobs</div>
                  <div className={e.pendingOffers > 0 ? styles.pulseOff : ''}><span>{e.pendingOffers}</span>Pending</div>
                  {e.avgResolutionMinutes != null && <div><span>{e.avgResolutionMinutes}m</span>Avg fix</div>}
                  {e.csatScore != null && <div><span>{Number(e.csatScore).toFixed(1)}</span>CSAT</div>}
                </div>
                {e.skills?.length > 0 && (
                  <div className={styles.skillRow}>
                    {e.skills.slice(0, 4).map((s) => <span key={s} className={styles.skillChip}>{s}</span>)}
                  </div>
                )}
                <div className={styles.loadBar}>
                  <div className={styles.loadBarFill}
                       style={{ width: `${Math.min(100, (e.activeJobs / Math.max(1, e.maxConcurrentLoad)) * 100)}%`,
                                background: e.overloaded ? 'var(--error)' : 'var(--secondary)' }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* ─── Assign modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {assignFor && (
          <AssignModal
            item={assignFor}
            crmList={crm}
            engineerList={eng}
            onClose={() => setAssignFor(null)}
            onDone={async () => { setAssignFor(null); await fetchAll(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 *  Assign modal — picks a CRM or engineer recipient and sends
 *  the appropriate offer.
 * ───────────────────────────────────────────────────────────── */
function AssignModal({ item, crmList, engineerList, onClose, onDone }) {
  const toast = useToast();
  const [picked, setPicked] = useState(null);
  const [mode, setMode] = useState('DIRECT');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const isInstall = item.kind === 'INSTALL';
  const list = isInstall ? crmList : crmList; // ops always offers to CRM for now
  const subtitle = isInstall ? 'Send this installation lead to a CRM' : 'Offer this ticket to a CRM';

  const submit = async () => {
    if (!picked) { toast.warning('Pick a CRM agent first.'); return; }
    setBusy(true);
    try {
      if (isInstall) {
        // Install offer endpoint takes the UUID, not the request number.
        await opsApi.offerInstall(item.id, { crmId: picked.userId, mode, note });
      } else {
        await opsApi.offerTicket(item.referenceNumber, { crmId: picked.userId, mode, note });
      }
      toast.success(`Offer sent to ${picked.name}`);
      onDone?.();
    } catch (err) {
      toast.error(err?.message || 'Could not send offer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className={styles.modalScrim}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}>
      <motion.div className={styles.modal}
                  initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}>
        <header className={styles.modalHead}>
          <h3>{item.referenceNumber} — Assign</h3>
          <button className={styles.iconBtn} onClick={onClose}><X size={18} /></button>
        </header>
        <p className={styles.modalSub}>{subtitle}</p>

        <div className={styles.modalList}>
          {list.map((c) => (
            <button key={c.userId}
                    className={`${styles.modalRow} ${picked?.userId === c.userId ? styles.modalRowOn : ''}`}
                    onClick={() => setPicked(c)}>
              <span className={styles.staffAv}>{initials(c.name)}</span>
              <div className={styles.modalRowBody}>
                <div className={styles.staffName}>
                  {c.name}
                  {!c.onShift && <span className={styles.tagOff}>off-shift</span>}
                  {c.overloaded && <span className={styles.tagFull}>at capacity</span>}
                </div>
                <div className={styles.modalRowMeta}>
                  Tickets {c.activeTickets} · Installs {c.activeInstalls} · Pending {c.pendingOffers}
                  {c.csatScore != null && <> · CSAT {Number(c.csatScore).toFixed(1)}</>}
                </div>
              </div>
              {picked?.userId === c.userId && <CheckCircle2 size={18} color="var(--secondary)" />}
            </button>
          ))}
        </div>

        <div className={styles.modalForm}>
          <div className={styles.formRow}>
            <label>Offer mode</label>
            <div className={styles.chipGroup}>
              {[
                { v: 'DIRECT', l: 'Direct' },
                { v: 'INVITE', l: 'Invite (can decline)' },
              ].map((o) => (
                <button key={o.v} type="button"
                        className={`${styles.chip} ${mode === o.v ? styles.chipOn : ''}`}
                        onClick={() => setMode(o.v)}>{o.l}</button>
              ))}
            </div>
          </div>
          <div className={styles.formRow}>
            <label>Note (optional)</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="VIP customer, prefer afternoon visit…" maxLength={500} />
          </div>
        </div>

        <footer className={styles.modalFoot}>
          <button className={styles.btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={busy || !picked}>
            <Send size={14} /> {busy ? 'Sending…' : 'Send offer'}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
