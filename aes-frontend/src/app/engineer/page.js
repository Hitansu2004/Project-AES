'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, Send, MapPin, Phone, Bell, LogOut, Clock, AlertTriangle,
  CheckCircle2, Car, Home, Hammer, PackagePlus, HandHelping, ChevronRight,
  X, Timer, RefreshCw, ShieldAlert, ListChecks,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { engineer as engineerApi, offers as offersApi, parts as partsApi, user as userApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import useStompTopic from '@/hooks/useStompTopic';
import Logo from '@/components/ui/Logo';
import PriorityBadge from '@/components/ui/PriorityBadge';
import ShiftToggle from '@/components/ui/ShiftToggle';
import styles from './engineer.module.css';

function initials(name) {
  return (name || '?').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
function expirySec(s) {
  if (s == null) return '—';
  if (s <= 0) return 'expired';
  if (s < 60)  return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
function timeOf(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const PROBLEM_LABEL = {
  NOT_COOLING: 'AC Not Cooling',
  NOISE: 'Loud Noise',
  LEAKING: 'Water Leak',
  NOT_TURNING_ON: 'Not Turning On',
  NO_AIRFLOW: 'No Airflow',
  REMOTE_WIFI: 'Remote / Wi-Fi',
  OTHER: 'Other',
};

const STATUS_TONE = {
  ACKNOWLEDGED: { tone: 'ack',  label: 'AWAITING DISPATCH' },
  ASSIGNED:     { tone: 'work', label: 'ASSIGNED' },
  EN_ROUTE:     { tone: 'work', label: 'EN ROUTE' },
  ON_SITE:      { tone: 'work', label: 'ON SITE' },
  IN_PROGRESS:  { tone: 'work', label: 'WORKING' },
  WAITING_PART: { tone: 'wait', label: 'WAITING PART' },
  RESOLVED:     { tone: 'done', label: 'RESOLVED' },
};
function statusPill(s) {
  const t = STATUS_TONE[s] || { tone: 'ack', label: s };
  return <span className={`${styles.statusPill} ${styles[`tone_${t.tone}`]}`}>{t.label}</span>;
}

export default function EngineerDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading, logout, fetchUser } = useAuth();
  const { unread } = useNotifications();

  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [busyOf, setBusyOf] = useState({});
  const [showCannot, setShowCannot] = useState(null);
  const [showHelp, setShowHelp]     = useState(null);
  const [showPart, setShowPart]     = useState(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/engineer'); return; }
    if (user.role !== 'SITE_ENGINEER' && user.role !== 'ADMIN') {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  const fetchAll = useCallback(async (silent = false) => {
    try {
      const d = await engineerApi.dashboard();
      setData(d);
    } catch (err) {
      if (!silent) toast.error(err?.message || 'Could not load dashboard');
    } finally {
      setLoad(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
    const id = setInterval(() => fetchAll(true), 12000);
    return () => clearInterval(id);
  }, [user, fetchAll]);

  useStompTopic(user ? `/topic/user/${user.id}/offers` : null, () => fetchAll(true));

  const setBusy = (key, label) => setBusyOf((b) => ({ ...b, [key]: label }));
  const unbusy  = (key) => setBusyOf((b) => { const { [key]: _, ...rest } = b; return rest; });

  // Actions
  const acceptOffer = async (o) => {
    setBusy(`offer-${o.id}`, 'accept');
    try { await offersApi.accept(o.id); toast.success(`Accepted ${o.ticketNumber}`); await fetchAll(); }
    catch (e) { toast.error(e?.message || 'Could not accept.'); }
    finally { unbusy(`offer-${o.id}`); }
  };
  const declineOffer = async (o) => {
    const reason = prompt(`Decline ${o.ticketNumber}?\n\nReason (optional):`);
    if (reason === null) return;
    setBusy(`offer-${o.id}`, 'decline');
    try { await offersApi.decline(o.id, { reason, comment: reason }); toast.success('Declined'); await fetchAll(); }
    catch (e) { toast.error(e?.message || 'Could not decline.'); }
    finally { unbusy(`offer-${o.id}`); }
  };

  const mark = async (job, action) => {
    setBusy(`job-${job.ticketNumber}`, action);
    try {
      if (action === 'en-route')    await engineerApi.enRoute(job.ticketNumber);
      if (action === 'on-site')     await engineerApi.onSite(job.ticketNumber);
      if (action === 'in-progress') await engineerApi.inProgress(job.ticketNumber);
      toast.success(`${job.ticketNumber} marked ${action.replace('-', ' ')}`);
      await fetchAll();
    } catch (e) {
      toast.error(e?.message || `Could not mark ${action}`);
    } finally {
      unbusy(`job-${job.ticketNumber}`);
    }
  };

  if (authLoading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  const tiles = [
    { label: 'Offers',     value: data?.pendingOffers ?? 0, icon: Send,        tone: data?.pendingOffers ? 'alert' : 'idle' },
    { label: 'My Jobs',    value: data?.activeJobs    ?? 0, icon: ListChecks,  tone: 'work' },
    { label: 'En route',   value: data?.enRoute       ?? 0, icon: Car,         tone: 'work' },
    { label: 'On site',    value: data?.onSite        ?? 0, icon: Home,        tone: 'work' },
    { label: 'Done today', value: data?.resolvedToday ?? 0, icon: CheckCircle2,tone: 'done' },
  ];

  return (
    <div className={styles.shell}>
      {/* ─── Top bar ────────────────────────────────────────── */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <Logo />
          <span className={styles.topBarRole}>Engineer · Field Ops</span>
        </div>
        <div className={styles.topBarRight}>
          <ShiftToggle
            onShift={!!user?.onShift}
            compact
            activeWork={{
              tickets: data?.activeJobs ?? 0,
              offers: data?.pendingOffers ?? 0,
            }}
            onChange={() => { fetchUser(); fetchAll(); }}
          />
          <Link href="/notifications" className={styles.iconBtn} aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && <span className={styles.notifDot}>{unread > 9 ? '9+' : unread}</span>}
          </Link>
          <button className={styles.iconBtn} onClick={() => fetchAll()} aria-label="Refresh">
            <RefreshCw size={18} />
          </button>
          <span className={styles.agentBadge}>
            <span className={styles.agentAv}>{initials(user.name)}</span>
            {user.name?.split(' ')[0]}
          </span>
          <button className={styles.iconBtn} onClick={logout} aria-label="Sign out"><LogOut size={18} /></button>
        </div>
      </header>

      {/* ─── KPI strip ──────────────────────────────────────── */}
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

      {/* ─── Offers (sticky on top if any) ──────────────────── */}
      {(data?.offers || []).length > 0 && (
        <section className={styles.offerStack}>
          <header className={styles.sectionHead}>
            <h2><Send size={16} /> Pending offers</h2>
          </header>
          <div className={styles.offerGrid}>
            {data.offers.map((o) => (
              <article key={o.id} className={styles.offerCard}>
                <div className={styles.cardTop}>
                  <PriorityBadge priority={o.ticketPriority} />
                  <span className={styles.tagDispatch}>DISPATCH</span>
                  <span className={styles.expiry}>
                    <Timer size={12} /> {expirySec(o.secondsUntilExpiry)}
                  </span>
                </div>
                <h3 className={styles.offerTitle}>
                  {o.ticketNumber} — {PROBLEM_LABEL[o.ticketProblemCategory] || o.ticketProblemCategory || 'Service'}
                </h3>
                <div className={styles.cardMeta}>
                  <span>From {o.offeredByName} ({o.offeredByRole})</span>
                  {o.note && <span className={styles.noteChip}>"{o.note}"</span>}
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.btnGhost}
                          disabled={!!busyOf[`offer-${o.id}`]}
                          onClick={() => declineOffer(o)}>
                    Decline
                  </button>
                  <button className={styles.btnPrimary}
                          disabled={!!busyOf[`offer-${o.id}`]}
                          onClick={() => acceptOffer(o)}>
                    <CheckCircle2 size={14} /> Accept
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ─── Active jobs ────────────────────────────────────── */}
      <section className={styles.jobsSection}>
        <header className={styles.sectionHead}>
          <h2><ListChecks size={16} /> My Jobs</h2>
        </header>
        {loading && <div className={styles.empty}><div className="spinner" /></div>}
        {!loading && (data?.jobs || []).length === 0 && (
          <div className={styles.empty}>
            <CheckCircle2 size={36} />
            <p>No active jobs. Enjoy the break.</p>
          </div>
        )}
        <div className={styles.jobGrid}>
          {(data?.jobs || []).map((j) => (
            <JobCard key={j.ticketNumber}
                     job={j}
                     busy={busyOf[`job-${j.ticketNumber}`]}
                     onMark={(act) => mark(j, act)}
                     onCannotAttend={() => setShowCannot(j)}
                     onNeedHelp={() => setShowHelp(j)}
                     onRaisePart={() => setShowPart(j)} />
          ))}
        </div>
      </section>

      {/* ─── Resolved today ─────────────────────────────────── */}
      {(data?.resolvedTodayList || []).length > 0 && (
        <section className={styles.jobsSection}>
          <header className={styles.sectionHead}>
            <h2><CheckCircle2 size={16} /> Resolved today</h2>
          </header>
          <div className={styles.doneList}>
            {data.resolvedTodayList.map((j) => (
              <Link key={j.ticketNumber} href={`/tickets/${j.ticketNumber}`} className={styles.doneRow}>
                <CheckCircle2 size={16} color="var(--success)" />
                <div>
                  <div className={styles.doneTitle}>
                    {j.ticketNumber} — {PROBLEM_LABEL[j.problemCategory] || j.problemCategory}
                  </div>
                  <div className={styles.doneMeta}>{j.customerName} · {timeOf(j.resolvedAt)}</div>
                </div>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {showCannot && (
          <CannotAttendModal job={showCannot}
                             onClose={() => setShowCannot(null)}
                             onDone={async () => { setShowCannot(null); await fetchAll(); }} />
        )}
        {showHelp && (
          <NeedHelpModal job={showHelp}
                         onClose={() => setShowHelp(null)}
                         onDone={async () => { setShowHelp(null); await fetchAll(); }} />
        )}
        {showPart && (
          <RaisePartModal job={showPart}
                          onClose={() => setShowPart(null)}
                          onDone={async () => { setShowPart(null); await fetchAll(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
function JobCard({ job, busy, onMark, onCannotAttend, onNeedHelp, onRaisePart }) {
  const stage = job.status;
  const canEnRoute = ['ASSIGNED'].includes(stage);
  const canOnSite  = ['ASSIGNED', 'EN_ROUTE'].includes(stage);
  const canStart   = ['ASSIGNED', 'EN_ROUTE', 'ON_SITE'].includes(stage);

  return (
    <article className={styles.jobCard}>
      <div className={styles.cardTop}>
        <PriorityBadge priority={job.priority} />
        {statusPill(job.status)}
        {job.scheduledDate && (
          <span className={styles.expiry}>
            <Clock size={12} /> {job.scheduledDate} · {job.scheduledSlot || ''}
          </span>
        )}
      </div>
      <h3 className={styles.jobTitle}>
        {job.ticketNumber} — {PROBLEM_LABEL[job.problemCategory] || job.problemCategory || 'Service'}
      </h3>
      {job.problemDescription && <p className={styles.jobBody}>{job.problemDescription}</p>}

      <div className={styles.cardMeta}>
        <span><strong>{job.customerName}</strong></span>
        {job.acRoomLabel && <span>{job.acBrand} {job.acModel} · {job.acRoomLabel}</span>}
        {job.locality && <span><MapPin size={12} /> {job.locality}</span>}
      </div>

      <div className={styles.callRow}>
        {job.customerPhone && (
          <a href={`tel:${job.customerPhone}`} className={styles.callBtn}>
            <Phone size={14} /> Call customer
          </a>
        )}
        {job.locality && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${job.propertyLabel || ''} ${job.locality}`)}`}
             target="_blank" rel="noopener noreferrer"
             className={styles.callBtn}>
            <MapPin size={14} /> Open in Maps
          </a>
        )}
        <Link href={`/tickets/${job.ticketNumber}`} className={styles.callBtn}>
          <ChevronRight size={14} /> Detail
        </Link>
      </div>

      <div className={styles.jobActions}>
        <button className={styles.btnPrimary} disabled={!canEnRoute || !!busy}
                onClick={() => onMark('en-route')}>
          <Car size={14} /> En route
        </button>
        <button className={styles.btnPrimary} disabled={!canOnSite || !!busy}
                onClick={() => onMark('on-site')}>
          <Home size={14} /> On site
        </button>
        <button className={styles.btnPrimary} disabled={!canStart || !!busy}
                onClick={() => onMark('in-progress')}>
          <Hammer size={14} /> Start work
        </button>
        <button className={styles.btnGhost} onClick={onRaisePart}>
          <PackagePlus size={14} /> Need part
        </button>
        <button className={styles.btnGhost} onClick={onNeedHelp}>
          <HandHelping size={14} /> Need help
        </button>
        <button className={styles.btnDanger} onClick={onCannotAttend}>
          <AlertTriangle size={14} /> Can't attend
        </button>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────── */
function CannotAttendModal({ job, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!reason.trim()) { toast.warning('Tell us why so the CRM can re-route.'); return; }
    setBusy(true);
    try {
      await engineerApi.cannotAttend(job.ticketNumber, { reason, details });
      toast.success(`Reported on ${job.ticketNumber}. CRM is being notified.`);
      onDone();
    } catch (e) {
      toast.error(e?.message || 'Could not submit.');
    } finally { setBusy(false); }
  };
  return (
    <ModalFrame title={`Cannot attend ${job.ticketNumber}`} onClose={onClose}
                accent="var(--error)" icon={AlertTriangle}>
      <div className={styles.formRow}>
        <label>Reason*</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)}
               placeholder="Vehicle breakdown, illness…" />
      </div>
      <div className={styles.formRow}>
        <label>Details (optional)</label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3}
                  placeholder="Anything the next engineer should know" />
      </div>
      <div className={styles.modalFoot}>
        <button className={styles.btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
        <button className={styles.btnDanger} onClick={submit} disabled={busy}>
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </ModalFrame>
  );
}

function NeedHelpModal({ job, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!reason.trim()) { toast.warning('Add a short reason.'); return; }
    setBusy(true);
    try {
      await engineerApi.needHelp(job.ticketNumber, { reason, details });
      toast.success('Service Manager is being looped in.');
      onDone();
    } catch (e) {
      toast.error(e?.message || 'Could not submit.');
    } finally { setBusy(false); }
  };
  return (
    <ModalFrame title={`Need help on ${job.ticketNumber}`} onClose={onClose}
                accent="var(--warning)" icon={ShieldAlert}>
      <p className={styles.modalSub}>
        A senior engineer / Service Manager will get a notification. You remain assigned to the ticket.
      </p>
      <div className={styles.formRow}>
        <label>Reason*</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)}
               placeholder="Complex VRF, second pair of hands…" />
      </div>
      <div className={styles.formRow}>
        <label>Details (optional)</label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
      </div>
      <div className={styles.modalFoot}>
        <button className={styles.btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
        <button className={styles.btnPrimary} onClick={submit} disabled={busy}>
          {busy ? 'Sending…' : 'Request help'}
        </button>
      </div>
    </ModalFrame>
  );
}

function RaisePartModal({ job, onClose, onDone }) {
  const toast = useToast();
  const [name, setName]       = useState('');
  const [qty, setQty]         = useState(1);
  const [unitCost, setCost]   = useState(0);
  const [urgency, setUrg]     = useState('NORMAL');
  const [notes, setNotes]     = useState('');
  const [busy, setBusy]       = useState(false);
  const submit = async () => {
    if (!name.trim()) { toast.warning('Part name is required.'); return; }
    if (Number(unitCost) <= 0) { toast.warning('Enter a unit cost.'); return; }
    setBusy(true);
    try {
      await partsApi.raise(job.ticketNumber, {
        partName: name.trim(),
        quantity: Number(qty),
        unitCost: Number(unitCost),
        urgency,
        notes,
      });
      toast.success('Part request raised. CRM / SM will approve.');
      onDone();
    } catch (e) {
      toast.error(e?.message || 'Could not raise part.');
    } finally { setBusy(false); }
  };
  return (
    <ModalFrame title={`Raise part — ${job.ticketNumber}`} onClose={onClose}
                accent="var(--secondary)" icon={PackagePlus}>
      <div className={styles.formRow}>
        <label>Part name*</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Capacitor 35µF" />
      </div>
      <div className={styles.formCols}>
        <div className={styles.formRow}>
          <label>Quantity</label>
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className={styles.formRow}>
          <label>Unit cost (₹)*</label>
          <input type="number" min="0" value={unitCost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div className={styles.formRow}>
          <label>Urgency</label>
          <select value={urgency} onChange={(e) => setUrg(e.target.value)}>
            <option>NORMAL</option>
            <option>HIGH</option>
            <option>EMERGENCY</option>
          </select>
        </div>
      </div>
      <div className={styles.formRow}>
        <label>Notes</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <p className={styles.bandHint}>
        Total <strong>₹{(Number(qty) * Number(unitCost)).toLocaleString('en-IN')}</strong> — bands: ≤₹5k CRM · ≤₹50k Service Manager · &gt;₹50k Admin.
      </p>
      <div className={styles.modalFoot}>
        <button className={styles.btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
        <button className={styles.btnPrimary} onClick={submit} disabled={busy}>
          {busy ? 'Sending…' : 'Submit request'}
        </button>
      </div>
    </ModalFrame>
  );
}

function ModalFrame({ title, onClose, accent, icon: Icon, children }) {
  return (
    <motion.div className={styles.modalScrim}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}>
      <motion.div className={styles.modal}
                  initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}>
        <header className={styles.modalHead} style={{ borderColor: accent }}>
          <h3 style={{ color: accent }}><Icon size={18} /> {title}</h3>
          <button className={styles.iconBtn} onClick={onClose}><X size={18} /></button>
        </header>
        <div className={styles.modalBody}>{children}</div>
      </motion.div>
    </motion.div>
  );
}
