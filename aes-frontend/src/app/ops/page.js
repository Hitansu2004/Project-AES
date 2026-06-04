'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  Headset,
  Wrench,
  AlertTriangle,
  Building2,
  Clock,
  Crown,
  RefreshCw,
  Search,
  ChevronRight,
  Send,
  X,
  CheckCircle2,
  MapPin,
  User,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import {
  dashboard,
  ops as opsApi,
  amcUpgrades as amcUpgradesApi,
} from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import useStompTopic from '@/hooks/useStompTopic';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
import styles from './ops.module.css';

const PRIORITY_FILTERS = ['All', 'P1', 'P2', 'P3'];

const STATUS_LABEL = {
  NEW:                       'NEW',
  PENDING:                   'NEW',
  OFFERED_CRM:               'OFFERED → CRM',
  OFFERED_ENGINEER:          'OFFERED → ENG',
  ESCALATED_BY_CUSTOMER:     'CUSTOMER ESCALATED',
  ACKNOWLEDGED:              'ACKNOWLEDGED',
  ASSIGNED:                  'ASSIGNED',
  EN_ROUTE:                  'EN ROUTE',
  ON_SITE:                   'ON SITE',
  IN_PROGRESS:               'IN PROGRESS',
  WAITING_PART:              'WAITING PART',
  WAITING_CUSTOMER_APPROVAL: 'AWAITING QUOTE',
  QUOTE_DRAFT:               'QUOTE DRAFT',
  QUOTE_PENDING_APPROVAL:    'QUOTE PENDING',
  QUOTE_SENT:                'QUOTE SENT',
};
const STATUS_TONE = {
  NEW: 'new',
  PENDING: 'new',
  OFFERED_CRM: 'wait',
  OFFERED_ENGINEER: 'wait',
  ESCALATED_BY_CUSTOMER: 'esc',
  ACKNOWLEDGED: 'ack',
  ASSIGNED: 'work',
  EN_ROUTE: 'work',
  ON_SITE: 'work',
  IN_PROGRESS: 'work',
  WAITING_PART: 'wait',
  WAITING_CUSTOMER_APPROVAL: 'wait',
  QUOTE_DRAFT: 'wait',
  QUOTE_PENDING_APPROVAL: 'wait',
  QUOTE_SENT: 'wait',
};

function initials(name) {
  return (name || '?').trim().split(/\s+/).filter(Boolean)
    .map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
function minutesAgo(min) {
  if (min == null) return '—';
  if (min < 60) return `${min}m open`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m open`;
}

export default function OpsDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [search, setSearch]   = useState('');
  const [priority, setPriority] = useState('All');
  const [stage, setStage]     = useState('all');
  const [assignFor, setAssignFor] = useState(null);
  const [amcUpgrades, setAmcUpgrades] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/ops'); return; }
    if (!['OPS_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setRefresh(true);
    try {
      const [dash, amcUps] = await Promise.all([
        dashboard.ops(),
        amcUpgradesApi.open().catch(() => []),
      ]);
      setData(dash);
      setAmcUpgrades(Array.isArray(amcUps) ? amcUps : []);
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

  if (authLoading || !user || (loading && !data)) {
    return <RoseSplash message="Loading the triage board…" />;
  }

  const tiles = [
    { key: 'untriaged',  label: 'Untriaged',     value: data?.untriagedTickets ?? 0 },
    { key: 'crm_wait',   label: 'Awaiting CRM',  value: data?.awaitingCrmAccept ?? 0 },
    { key: 'eng_wait',   label: 'Awaiting Eng',  value: data?.awaitingEngineerAccept ?? 0 },
    { key: 'escalated',  label: 'Customer Esc.', value: data?.escalatedByCustomer ?? 0, featured: (data?.escalatedByCustomer ?? 0) > 0 },
    { key: 'installs',   label: 'New Installs',  value: data?.untriagedInstalls ?? 0 },
    { key: 'sla',        label: 'SLA Red Zone',  value: data?.slaRedZone ?? 0, danger: (data?.slaRedZone ?? 0) > 0 },
    { key: 'amc',        label: 'AMC Upgrade',   value: amcUpgrades.length },
  ];

  const hero = (
    <div className={styles.heroRow}>
      <div className={styles.heroText}>
        <h1 className={styles.heroTitle}>Triage Board Overview</h1>
        <p className={styles.heroSub}>Route work, balance load, keep SLAs green.</p>
      </div>
      <div className={styles.heroActions}>
        <div className={styles.searchBox}>
          <Search size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket #, customer, area…"
          />
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => fetchAll()}
          disabled={refreshing}
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={refreshing ? styles.spin : ''} />
        </button>
      </div>
    </div>
  );

  return (
    <RoseShell hero={hero}>
      {/* ── KPI tiles (7) ───────────────────────────────── */}
      <section className={styles.tiles}>
        {tiles.map((t) => (
          <div
            key={t.key}
            className={`${styles.tile} ${t.featured ? styles.tileFeatured : ''} ${t.danger ? styles.tileDanger : ''}`}
          >
            <span className={styles.tileLabel}>{t.label}</span>
            <span className={styles.tileValue}>{t.value}</span>
          </div>
        ))}
      </section>

      {/* ── Four-column board ───────────────────────────── */}
      <div className={styles.board}>
        {/* Triage Inbox */}
        <section className={styles.column}>
          <header className={styles.columnHead}>
            <div className={styles.columnTitleRow}>
              <h2 className={styles.columnTitle}>Triage Inbox</h2>
              <span className={styles.columnCount}>{filtered.length}</span>
            </div>
          </header>
          <div className={styles.chipRow}>
            {[
              { k: 'all', label: 'All' },
              { k: 'untriaged', label: 'New' },
              { k: 'awaiting-crm', label: 'CRM' },
              { k: 'escalated', label: 'Esc' },
            ].map((c) => (
              <button
                key={c.k}
                type="button"
                className={`${styles.chip} ${stage === c.k ? styles.chipOn : ''}`}
                onClick={() => setStage(c.k)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className={styles.chipRow}>
            {PRIORITY_FILTERS.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.chip} ${priority === p ? styles.chipOn : ''}`}
                onClick={() => setPriority(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className={styles.columnBody}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <CheckCircle2 size={24} />
                <p>Inbox is clear.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.map((i) => (
                  <motion.article
                    key={i.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={styles.inboxCard}
                  >
                    <header className={styles.inboxHead}>
                      <PriorityChip priority={i.priority} />
                      <span className={styles.inboxNumber}>#{i.referenceNumber}</span>
                    </header>
                    <h3 className={styles.inboxTitle}>
                      {i.headline || 'Customer service'}
                    </h3>
                    <p className={styles.inboxMeta}>
                      <User size={11} /> {i.customerName || '—'}
                      {i.locality && (
                        <>
                          <span className={styles.dot} /> <MapPin size={11} /> {i.locality}
                        </>
                      )}
                    </p>
                    {i.escalationReason && (
                      <p className={styles.escNote}>
                        <AlertTriangle size={11} /> {i.escalationReason}
                      </p>
                    )}
                    <div className={styles.inboxFoot}>
                      <span className={styles.ageBadge}>{minutesAgo(i.ageMinutes)}</span>
                      {i.kind === 'INSTALL' && (
                        <span className={styles.installChip}>
                          <Building2 size={10} /> INSTALL
                        </span>
                      )}
                      <StatusPill status={i.status} />
                    </div>
                    <div className={styles.inboxActions}>
                      <Link
                        href={i.kind === 'INSTALL'
                          ? `/admin?install=${i.referenceNumber}`
                          : `/tickets/${i.referenceNumber}`}
                        className={styles.btnGhost}
                      >
                        Open <ChevronRight size={12} />
                      </Link>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => setAssignFor(i)}
                      >
                        <Send size={12} />{' '}
                        {i.offeredToName ? 'Reassign' : 'Assign'}
                      </button>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* AMC Upgrades */}
        <section className={styles.column}>
          <header className={styles.columnHead}>
            <div className={styles.columnTitleRow}>
              <h2 className={styles.columnTitle}>AMC Upgrades</h2>
              <span className={styles.columnCount}>{amcUpgrades.length}</span>
            </div>
          </header>
          <div className={styles.columnBody}>
            {amcUpgrades.length === 0 ? (
              <div className={styles.empty}>
                <p>No upgrade leads.</p>
              </div>
            ) : amcUpgrades.map((r) => (
              <article key={r.id} className={styles.upgradeCard}>
                <span className={styles.upgradeTag}>
                  {(r.preferredPlan || 'PREMIUM').toUpperCase()} REQUEST
                </span>
                <h3 className={styles.upgradeTitle}>{r.customerName || 'Customer'}</h3>
                <p className={styles.inboxMeta}>
                  {r.requestNumber}
                  {r.propertyLabel && (
                    <>
                      <span className={styles.dot} /> {r.propertyLabel}
                    </>
                  )}
                </p>
                {r.notes && (
                  <p className={styles.upgradeNote}>"{r.notes}"</p>
                )}
                {r.assignedCrmName ? (
                  <p className={styles.assignedTo}>
                    Assigned to <strong>{r.assignedCrmName}</strong>
                  </p>
                ) : (
                  <button type="button" className={styles.upgradeReviewBtn}>
                    Review
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* CRM Agents */}
        <section className={styles.column}>
          <header className={styles.columnHead}>
            <div className={styles.columnTitleRow}>
              <h2 className={styles.columnTitle}>CRM Agents</h2>
              <span className={styles.columnCount}>{crm.length}</span>
            </div>
          </header>
          <div className={styles.columnBody}>
            {crm.length === 0 ? (
              <div className={styles.empty}><p>No CRM on roster.</p></div>
            ) : crm.map((c) => (
              <StaffCard
                key={c.userId}
                avatar={initials(c.name)}
                name={c.name}
                role="CRM"
                onShift={c.onShift}
                badges={c.branch ? [c.branch] : []}
                stats={[
                  { label: 'Tickets',  value: c.activeTickets },
                  { label: 'Installs', value: c.activeInstalls },
                  { label: 'Pending',  value: c.pendingOffers },
                  { label: 'Solved',   value: c.resolvedToday },
                ]}
                load={Math.min(100, ((c.activeTickets + c.activeInstalls) / Math.max(1, c.maxConcurrentLoad)) * 100)}
                overloaded={c.overloaded}
              />
            ))}
          </div>
        </section>

        {/* Field Engineers */}
        <section className={styles.column}>
          <header className={styles.columnHead}>
            <div className={styles.columnTitleRow}>
              <h2 className={styles.columnTitle}>Field Engineers</h2>
              <span className={styles.columnCount}>{eng.length}</span>
            </div>
          </header>
          <div className={styles.columnBody}>
            {eng.length === 0 ? (
              <div className={styles.empty}><p>No engineers on shift.</p></div>
            ) : eng.map((e) => (
              <StaffCard
                key={e.userId}
                avatar={initials(e.name)}
                name={e.name}
                role={e.onShift ? 'AVAILABLE' : 'OFF SHIFT'}
                onShift={e.onShift}
                badges={(e.skills || []).slice(0, 2)}
                stats={[
                  { label: 'Jobs',     value: e.activeJobs },
                  { label: 'Pending',  value: e.pendingOffers },
                  ...(e.avgResolutionMinutes != null ? [{ label: 'Avg Fix', value: `${e.avgResolutionMinutes}m` }] : []),
                  ...(e.csatScore != null ? [{ label: 'CSAT', value: Number(e.csatScore).toFixed(1) }] : []),
                ]}
                load={Math.min(100, (e.activeJobs / Math.max(1, e.maxConcurrentLoad)) * 100)}
                overloaded={e.overloaded}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Assign Modal */}
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
    </RoseShell>
  );
}

/* ─── Cards & pills ────────────────────────────────────── */

function StaffCard({ avatar, name, role, onShift, badges, stats, load, overloaded }) {
  return (
    <article className={styles.staffCard}>
      <header className={styles.staffHead}>
        <span className={styles.staffAv}>{avatar}</span>
        <div className={styles.staffIdent}>
          <p className={styles.staffName}>{name}</p>
          <p className={`${styles.staffRole} ${onShift ? styles.staffRoleOn : ''}`}>
            {role}
          </p>
        </div>
      </header>
      {badges.length > 0 && (
        <div className={styles.staffBadges}>
          {badges.map((b) => (
            <span key={b} className={styles.skillChip}>{b}</span>
          ))}
        </div>
      )}
      <dl className={styles.staffStats}>
        {stats.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.loadRow}>
        <div className={styles.loadBar}>
          <div
            className={styles.loadFill}
            style={{
              width: `${load}%`,
              background: overloaded ? 'var(--aes-error)' : 'var(--aes-primary)',
            }}
          />
        </div>
        <span className={`${styles.loadLabel} ${overloaded ? styles.loadLabelHigh : ''}`}>
          {Math.round(load)}%
        </span>
      </div>
    </article>
  );
}

function PriorityChip({ priority }) {
  const map = {
    P1: { label: 'P1 · URGENT',   tone: 'p1' },
    P2: { label: 'P2 · HIGH',     tone: 'p2' },
    P3: { label: 'P3 · STANDARD', tone: 'p3' },
  };
  const m = map[priority] || { label: priority || '—', tone: 'p3' };
  return <span className={`${styles.priChip} ${styles[`pri_${m.tone}`]}`}>{m.label}</span>;
}

function StatusPill({ status }) {
  const label = STATUS_LABEL[status] || status || '—';
  const tone  = STATUS_TONE[status]  || 'ack';
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{label}</span>;
}

/* ─── Assign Modal ─────────────────────────────────────── */
function AssignModal({ item, crmList, engineerList, onClose, onDone }) {
  const toast = useToast();
  const [picked, setPicked] = useState(null);
  const [mode, setMode] = useState('DIRECT');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const isInstall = item.kind === 'INSTALL';
  const subtitle = isInstall
    ? 'Send this installation lead to a CRM agent'
    : 'Offer this ticket to a CRM agent';

  const submit = async () => {
    if (!picked) { toast.warning('Pick a CRM agent first.'); return; }
    setBusy(true);
    try {
      if (isInstall) {
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
    <motion.div
      className={styles.modalScrim}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.modal}
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.modalHead}>
          <h3>{item.referenceNumber} — Assign</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <p className={styles.modalSub}>{subtitle}</p>

        <div className={styles.modalList}>
          {crmList.map((c) => (
            <button
              key={c.userId}
              type="button"
              className={`${styles.modalRow} ${picked?.userId === c.userId ? styles.modalRowOn : ''}`}
              onClick={() => setPicked(c)}
            >
              <span className={styles.staffAv}>{initials(c.name)}</span>
              <div className={styles.modalRowBody}>
                <div className={styles.modalRowName}>
                  {c.name}
                  {!c.onShift && <span className={styles.tagOff}>off-shift</span>}
                  {c.overloaded && <span className={styles.tagFull}>at capacity</span>}
                </div>
                <div className={styles.modalRowMeta}>
                  Tickets {c.activeTickets} · Installs {c.activeInstalls} · Pending {c.pendingOffers}
                  {c.csatScore != null && <> · CSAT {Number(c.csatScore).toFixed(1)}</>}
                </div>
              </div>
              {picked?.userId === c.userId && <CheckCircle2 size={18} />}
            </button>
          ))}
        </div>

        <div className={styles.modalForm}>
          <div className={styles.formRow}>
            <label>Offer mode</label>
            <div className={styles.chipRow}>
              {[
                { v: 'DIRECT', l: 'Direct' },
                { v: 'INVITE', l: 'Invite (can decline)' },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  className={`${styles.chip} ${mode === o.v ? styles.chipOn : ''}`}
                  onClick={() => setMode(o.v)}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.formRow}>
            <label>Note (optional)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VIP customer, prefer afternoon visit…"
              maxLength={500}
            />
          </div>
        </div>

        <footer className={styles.modalFoot}>
          <button className={styles.btnGhost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={styles.btnPrimary} onClick={submit} disabled={busy || !picked}>
            <Send size={14} /> {busy ? 'Sending…' : 'Send offer'}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
