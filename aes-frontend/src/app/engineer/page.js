'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Briefcase,
  Car,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Hammer,
  Home,
  HandHelping,
  PackagePlus,
  Phone,
  ChevronRight,
  ShieldAlert,
  X,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import {
  engineer as engineerApi,
  offers as offersApi,
  parts as partsApi,
} from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import useStompTopic from '@/hooks/useStompTopic';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
import ShiftToggle from '@/components/ui/ShiftToggle';
import styles from './engineer.module.css';

const PROBLEM_LABEL = {
  NOT_COOLING: 'AC Not Cooling',
  NOISE: 'Loud Noise',
  LEAKING: 'Water Leak',
  NOT_TURNING_ON: 'Not Turning On',
  NO_AIRFLOW: 'No Airflow',
  REMOTE_WIFI: 'Remote / Wi-Fi',
  OTHER: 'Other',
};

const STATUS_LABEL = {
  ACKNOWLEDGED: 'AWAITING DISPATCH',
  ASSIGNED:     'ASSIGNED',
  EN_ROUTE:     'EN ROUTE',
  ON_SITE:      'ON SITE',
  IN_PROGRESS:  'WORKING',
  WAITING_PART: 'WAITING PART',
  RESOLVED:     'RESOLVED',
};

function expirySec(s) {
  if (s == null) return '—';
  if (s <= 0) return 'expired';
  if (s < 60)  return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
function timeOf(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function EngineerDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading, fetchUser } = useAuth();

  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [busyOf, setBusyOf] = useState({});
  const [showCannot, setShowCannot] = useState(null);
  const [showHelp, setShowHelp]     = useState(null);
  const [showPart, setShowPart]     = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/engineer'); return; }
    if (!['SITE_ENGINEER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
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

  if (authLoading || !user || (loading && !data)) {
    return <RoseSplash message="Loading your shift…" />;
  }

  const tiles = [
    { key: 'offers',     label: 'Offers',     value: data?.pendingOffers ?? 0, icon: Bell,         featured: (data?.pendingOffers ?? 0) > 0 },
    { key: 'my_jobs',    label: 'My Jobs',    value: data?.activeJobs    ?? 0, icon: Briefcase },
    { key: 'en_route',   label: 'En Route',   value: data?.enRoute       ?? 0, icon: Car },
    { key: 'on_site',    label: 'On Site',    value: data?.onSite        ?? 0, icon: MapPin },
    { key: 'done_today', label: 'Done Today', value: data?.resolvedToday ?? 0, icon: CheckCircle2 },
  ];

  const hero = (
    <div className={styles.heroRow}>
      <div className={styles.heroText}>
        <h1 className={styles.heroTitle}>Today's Pool</h1>
        <p className={styles.heroSub}>Manage your assignments and dispatch offers.</p>
      </div>
      <div className={styles.heroActions}>
        <ShiftToggle
          onShift={!!user?.onShift}
          compact
          activeWork={{ tickets: data?.activeJobs ?? 0, offers: data?.pendingOffers ?? 0 }}
          onChange={() => { fetchUser(); fetchAll(); }}
        />
        <button type="button" className={styles.refreshBtn} onClick={() => fetchAll()} aria-label="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <RoseShell hero={hero}>
      {/* ── Stat tiles ───────────────────────────────────── */}
      <section className={styles.tiles}>
        {tiles.map((t) => (
          <div
            key={t.key}
            className={`${styles.tile} ${t.featured ? styles.tileFeatured : ''}`}
          >
            <div className={styles.tileHead}>
              <span className={styles.tileLabel}>{t.label}</span>
              <t.icon size={18} strokeWidth={2} />
            </div>
            <div className={styles.tileValue}>{t.value}</div>
          </div>
        ))}
      </section>

      {/* ── Offers + Resolved Today ──────────────────────── */}
      <section className={styles.duo}>
        <div className={styles.duoLeft}>
          <header className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              <Bell size={18} className={styles.sectionIcon} /> Pending Dispatch Offers
            </h2>
          </header>

          {(data?.offers || []).length === 0 ? (
            <div className={styles.empty}>
              <CheckCircle2 size={28} strokeWidth={1.5} />
              <p>No pending offers. CRM will route new work here.</p>
            </div>
          ) : (
            <div className={styles.offerGrid}>
              {data.offers.map((o) => (
                <article key={o.id} className={styles.offerCard}>
                  <header className={styles.offerHead}>
                    <div className={styles.offerTags}>
                      <PriorityChip priority={o.ticketPriority} />
                      <span className={styles.dispatchTag}>DISPATCH</span>
                    </div>
                    <span className={styles.offerNumber}>#{o.ticketNumber}</span>
                  </header>
                  <h3 className={styles.offerTitle}>
                    {PROBLEM_LABEL[o.ticketProblemCategory] || o.ticketProblemCategory || 'Service'}
                  </h3>
                  <p className={styles.offerMeta}>
                    <Briefcase size={12} />{' '}
                    {o.propertyLabel || o.locality || 'Property TBD'}
                  </p>
                  {o.note && (
                    <p className={styles.offerNote}>"{o.note}"</p>
                  )}
                  <div className={styles.offerFootRow}>
                    <span className={styles.offerExpiry}>
                      <Timer size={12} /> {expirySec(o.secondsUntilExpiry)}
                    </span>
                    <span className={styles.offerFrom}>
                      From {o.offeredByName} ({o.offeredByRole})
                    </span>
                  </div>
                  <div className={styles.offerActions}>
                    <button
                      className={styles.btnGhost}
                      disabled={!!busyOf[`offer-${o.id}`]}
                      onClick={() => declineOffer(o)}
                    >
                      Decline
                    </button>
                    <button
                      className={styles.btnPrimary}
                      disabled={!!busyOf[`offer-${o.id}`]}
                      onClick={() => acceptOffer(o)}
                    >
                      <CheckCircle2 size={14} /> Accept Job
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className={styles.duoRight}>
          <header className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              <CheckCircle2 size={18} className={styles.sectionIcon} /> Resolved Today
            </h2>
            {(data?.resolvedTodayList || []).length > 0 && (
              <span className={styles.resolvedCount}>
                {data.resolvedTodayList.length}
              </span>
            )}
          </header>
          {(data?.resolvedTodayList || []).length === 0 ? (
            <p className={styles.resolvedEmpty}>No resolutions yet today.</p>
          ) : (
            <ul className={styles.resolvedList}>
              {data.resolvedTodayList.slice(0, 6).map((j) => (
                <li key={j.ticketNumber}>
                  <Link href={`/tickets/${j.ticketNumber}`} className={styles.resolvedRow}>
                    <div className={styles.resolvedText}>
                      <p className={styles.resolvedTitle}>
                        {PROBLEM_LABEL[j.problemCategory] || j.problemCategory || 'Service'}
                      </p>
                      <p className={styles.resolvedMeta}>
                        #{j.ticketNumber} &middot; {timeOf(j.resolvedAt)}
                      </p>
                    </div>
                    <ChevronRight size={16} className={styles.resolvedArrow} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>

      {/* ── My Active Jobs ───────────────────────────────── */}
      <section className={styles.jobsSection}>
        <header className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            <Briefcase size={18} className={styles.sectionIcon} /> My Active Jobs
          </h2>
          <span className={styles.resolvedCount}>{(data?.jobs || []).length}</span>
        </header>

        {(data?.jobs || []).length === 0 ? (
          <div className={styles.empty}>
            <CheckCircle2 size={28} strokeWidth={1.5} />
            <p>No active jobs. Take a breather — new work will appear here.</p>
          </div>
        ) : (
          <div className={styles.jobGrid}>
            {data.jobs.map((j) => (
              <JobCard
                key={j.ticketNumber}
                job={j}
                busy={busyOf[`job-${j.ticketNumber}`]}
                onMark={(act) => mark(j, act)}
                onCannotAttend={() => setShowCannot(j)}
                onNeedHelp={() => setShowHelp(j)}
                onRaisePart={() => setShowPart(j)}
              />
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {showCannot && (
          <CannotAttendModal
            job={showCannot}
            onClose={() => setShowCannot(null)}
            onDone={async () => { setShowCannot(null); await fetchAll(); }}
          />
        )}
        {showHelp && (
          <NeedHelpModal
            job={showHelp}
            onClose={() => setShowHelp(null)}
            onDone={async () => { setShowHelp(null); await fetchAll(); }}
          />
        )}
        {showPart && (
          <RaisePartModal
            job={showPart}
            onClose={() => setShowPart(null)}
            onDone={async () => { setShowPart(null); await fetchAll(); }}
          />
        )}
      </AnimatePresence>
    </RoseShell>
  );
}

/* ─── Job Card ─────────────────────────────────────────── */
function JobCard({ job, busy, onMark, onCannotAttend, onNeedHelp, onRaisePart }) {
  const stage = job.status;
  const canEnRoute = ['ASSIGNED'].includes(stage);
  const canOnSite  = ['ASSIGNED', 'EN_ROUTE'].includes(stage);
  const canStart   = ['ASSIGNED', 'EN_ROUTE', 'ON_SITE'].includes(stage);

  return (
    <article className={styles.jobCard}>
      <span className={styles.jobAccent} aria-hidden="true" />
      <header className={styles.jobHead}>
        <div className={styles.jobTags}>
          <StatusPill status={job.status} />
          <span className={styles.jobNumber}>#{job.ticketNumber}</span>
        </div>
        {job.scheduledDate && (
          <span className={styles.jobScheduled}>
            <Clock size={12} /> {job.scheduledDate}
            {job.scheduledSlot && ` · ${job.scheduledSlot}`}
          </span>
        )}
      </header>

      <h3 className={styles.jobTitle}>
        {PROBLEM_LABEL[job.problemCategory] || job.problemCategory || 'Service'}
      </h3>

      <div className={styles.jobMeta}>
        {job.propertyLabel && (
          <span className={styles.jobMetaLine}>
            <MapPin size={12} /> {job.propertyLabel}
          </span>
        )}
        {job.acRoomLabel && (
          <span className={styles.jobMetaLine}>
            <Hammer size={12} /> {job.acBrand} {job.acModel} · {job.acRoomLabel}
          </span>
        )}
        {job.customerName && (
          <span className={styles.jobMetaLine}>
            <Briefcase size={12} /> {job.customerName}
          </span>
        )}
      </div>

      {job.problemDescription && (
        <p className={styles.jobBody}>{job.problemDescription}</p>
      )}

      <div className={styles.quickRow}>
        {job.customerPhone && (
          <a href={`tel:${job.customerPhone}`} className={styles.iconChip} aria-label="Call customer">
            <Phone size={14} />
          </a>
        )}
        <button
          type="button"
          onClick={() => openRoute(job)}
          className={styles.iconChip}
          aria-label="View route"
        >
          <MapPin size={14} />
        </button>
        <Link href={`/tickets/${job.ticketNumber}`} className={styles.detailLink}>
          Detail <ChevronRight size={14} />
        </Link>
      </div>

      <div className={styles.jobActions}>
        {canEnRoute && (
          <button
            className={styles.btnPrimary}
            disabled={!!busy}
            onClick={() => onMark('en-route')}
          >
            <Car size={14} /> En Route
          </button>
        )}
        {canOnSite && (
          <button
            className={styles.btnPrimary}
            disabled={!!busy}
            onClick={() => onMark('on-site')}
          >
            <Home size={14} /> {stage === 'EN_ROUTE' ? 'Arrived' : 'On Site'}
          </button>
        )}
        {canStart && (
          <button
            className={styles.btnPrimary}
            disabled={!!busy}
            onClick={() => onMark('in-progress')}
          >
            <Hammer size={14} /> Start Work
          </button>
        )}
        <button className={styles.btnGhost} onClick={onRaisePart}>
          <PackagePlus size={14} /> Need Part
        </button>
        <button className={styles.btnGhost} onClick={onNeedHelp}>
          <HandHelping size={14} /> Need Help
        </button>
        <button className={styles.btnDanger} onClick={onCannotAttend}>
          <AlertTriangle size={14} /> Can't Attend
        </button>
      </div>
    </article>
  );
}

async function openRoute(job) {
  try {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('aes_token') || localStorage.getItem('aes_access_token')
      : '';
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/maps/route/${job.ticketNumber}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body = await res.json();
    const url = body?.data?.directionsUrl
      || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.locality || job.propertyLabel || '')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.locality || job.propertyLabel || '')}`,
      '_blank'
    );
  }
}

/* ─── Pills ────────────────────────────────────────────── */
function PriorityChip({ priority }) {
  const map = {
    P1: { label: 'P1 · URGENT',  tone: 'p1' },
    P2: { label: 'P2 · HIGH',    tone: 'p2' },
    P3: { label: 'P3 · STANDARD',tone: 'p3' },
  };
  const m = map[priority] || { label: priority || 'STANDARD', tone: 'p3' };
  return <span className={`${styles.priChip} ${styles[`pri_${m.tone}`]}`}>{m.label}</span>;
}

function StatusPill({ status }) {
  const label = STATUS_LABEL[status] || status || '—';
  const tone =
    status === 'EN_ROUTE' || status === 'ON_SITE' || status === 'IN_PROGRESS'
      ? 'work'
      : status === 'RESOLVED'
        ? 'done'
        : 'ack';
  return <span className={`${styles.statusPill} ${styles[`tone_${tone}`]}`}>{label}</span>;
}

/* ─── Modals (unchanged logic, restyled CSS) ───────────── */
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
    <ModalFrame title={`Cannot attend ${job.ticketNumber}`} onClose={onClose} icon={AlertTriangle}>
      <div className={styles.formRow}>
        <label>Reason*</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vehicle breakdown, illness…" />
      </div>
      <div className={styles.formRow}>
        <label>Details (optional)</label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="Anything the next engineer should know" />
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
    <ModalFrame title={`Need help on ${job.ticketNumber}`} onClose={onClose} icon={ShieldAlert}>
      <p className={styles.modalSub}>
        A senior engineer / Service Manager will get a notification. You remain assigned to the ticket.
      </p>
      <div className={styles.formRow}>
        <label>Reason*</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Complex VRF, second pair of hands…" />
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
    <ModalFrame title={`Raise part — ${job.ticketNumber}`} onClose={onClose} icon={PackagePlus}>
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

function ModalFrame({ title, onClose, icon: Icon, children }) {
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
          <h3><Icon size={18} /> {title}</h3>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className={styles.modalBody}>{children}</div>
      </motion.div>
    </motion.div>
  );
}
