'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Building2,
  Wrench,
  ShieldCheck,
  ArrowRight,
  Snowflake,
  Droplets,
  Radio,
  History,
  MapPin,
  CalendarDays,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
import {
  dashboard as dashboardApi,
  amc as amcApi,
  installations as installationsApi,
} from '@/lib/api';
import styles from './dashboard.module.css';

const greetingFor = (h = new Date().getHours()) => {
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

function nextAmcVisit(contract) {
  if (!contract?.visits?.length) return null;
  const upcoming = contract.visits
    .filter((v) => v.scheduledDate && v.status !== 'COMPLETED')
    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
  return upcoming[0] || null;
}

function monthsLeft(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const months =
    (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(0, months);
}

const TICKET_ICONS = {
  COOLING:      Snowflake,
  NOT_COOLING:  Snowflake,
  WATER:        Droplets,
  LEAKING:      Droplets,
  WATER_LEAK:   Droplets,
  NOISE:        Radio,
  SENSOR:       Radio,
  ELECTRICAL:   Radio,
};
function iconForTicket(t) {
  const k = (t.problemCategory || '').toUpperCase();
  const Direct = TICKET_ICONS[k];
  if (Direct) return Direct;
  for (const [key, Icon] of Object.entries(TICKET_ICONS)) {
    if (k.includes(key)) return Icon;
  }
  return Snowflake;
}

const STATUS_LABEL = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Resolved',
  COMPLETED: 'Resolved',
  CANCELLED: 'Cancelled',
  PENDING: 'Pending',
  AWAITING_ASSIGNMENT: 'Pending',
  ASSIGNED: 'Scheduled',
  EN_ROUTE: 'En Route',
  ARRIVED: 'On Site',
};
function statusFor(t) {
  const raw = (t.status || '').toUpperCase();
  return STATUS_LABEL[raw] || raw.replace(/_/g, ' ');
}

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35 } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06 } },
};

export default function CustomerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [dash, setDash] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/dashboard'); return; }
    if (user.role !== 'CUSTOMER') {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;
    let cancelled = false;
    (async () => {
      const [dashRes, amcRes, instRes] = await Promise.allSettled([
        dashboardApi.customer(),
        amcApi.myContracts(),
        installationsApi.list(),
      ]);
      if (cancelled) return;
      if (dashRes.status === 'fulfilled') setDash(dashRes.value);
      if (amcRes.status === 'fulfilled') {
        setContracts(Array.isArray(amcRes.value) ? amcRes.value : []);
      }
      if (instRes.status === 'fulfilled') {
        const arr = Array.isArray(instRes.value)
          ? instRes.value
          : instRes.value?.content || [];
        setRequests(arr);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const activeContract = useMemo(
    () => contracts.find((c) => c.isActive) || contracts[0],
    [contracts]
  );
  const amcVisit = useMemo(
    () => dash?.nextAmcVisit || (activeContract ? nextAmcVisit(activeContract) : null),
    [dash, activeContract]
  );
  const amcMonthsLeft = useMemo(
    () => (activeContract ? monthsLeft(activeContract.endDate) : null),
    [activeContract]
  );

  const recentTickets = (dash?.recentTickets || []).slice(0, 3);
  const activeProjects = requests.filter((r) =>
    !['COMPLETED', 'CANCELLED', 'QUOTE_REJECTED_INTERNAL'].includes(r.status)
  );
  const firstProject = activeProjects[0];
  const projectProgress = useMemo(() => deriveProgress(firstProject), [firstProject]);

  if (authLoading || !user || loading) {
    return <RoseSplash message="Preparing your dashboard…" />;
  }

  const firstName = user.name?.split(' ')[0] || 'there';
  const hero = (
    <>
      <h1 className={styles.greeting}>
        {greetingFor()}, {firstName}.
      </h1>
      <p className={styles.greetingSub}>
        Your climate control ecosystem is operating at peak efficiency across all
        monitored zones.
      </p>
    </>
  );

  return (
    <RoseShell hero={hero}>
      <motion.div
        className={styles.stack}
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* ── Action grid (3 cards) ───────────────────────── */}
        <motion.section variants={fadeIn} className={styles.actionGrid}>
          <ActionCard
            href="/services/installation"
            icon={Building2}
            title="New Installation"
            body="Expand your infrastructure with precision-engineered solutions tailored to your facility."
            cta="Consult an Expert"
          />
          <ActionCard
            href="/services/ticket"
            icon={Wrench}
            title="Schedule Repair"
            body="Request immediate technical intervention for anomalous equipment behavior."
            cta="Book Technician"
          />
          <AmcCard
            active={!!activeContract}
            monthsLeft={amcMonthsLeft}
            endDate={activeContract?.endDate}
          />
        </motion.section>

        {/* ── Two-column: Active Projects + Recent Tickets ── */}
        <motion.section variants={fadeIn} className={styles.duo}>
          <Panel
            title="Active Projects"
            count={activeProjects.length}
            action={{ href: '/installations', label: 'View All' }}
          >
            {firstProject ? (
              <>
                <ProjectFeature project={firstProject} progress={projectProgress} />
                {activeProjects.length > 1 && (
                  <div className={styles.projectMore}>
                    {activeProjects.slice(1, 4).map((p) => (
                      <ProjectMini key={p.id || p.requestNumber} project={p} />
                    ))}
                    {activeProjects.length > 4 && (
                      <Link href="/installations" className={styles.projectMoreCta}>
                        + {activeProjects.length - 4} more project
                        {activeProjects.length - 4 === 1 ? '' : 's'}
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                title="No active projects"
                body="Plan a new installation and we'll guide you from quote to commissioning."
                cta={{ href: '/services/installation', label: 'Request a quote' }}
              />
            )}
          </Panel>

          <Panel
            title="Recent Tickets"
            count={dash?.openTickets ?? recentTickets.length}
            action={{ href: '/tickets', label: 'History', icon: History }}
          >
            {recentTickets.length === 0 ? (
              <EmptyState
                title="No open tickets"
                body="Raise a ticket if your AC needs attention."
                cta={{ href: '/services/ticket', label: 'Raise a ticket' }}
              />
            ) : (
              <div className={styles.ticketList}>
                {recentTickets.map((t) => (
                  <TicketRow key={t.id || t.ticketNumber} ticket={t} />
                ))}
                {(dash?.openTickets ?? recentTickets.length) > recentTickets.length && (
                  <Link href="/tickets" className={styles.projectMoreCta}>
                    View all {dash.openTickets} open tickets
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            )}
          </Panel>
        </motion.section>
      </motion.div>
    </RoseShell>
  );
}

/* ─── Sub-components ───────────────────────────────────── */

function ActionCard({ href, icon: Icon, title, body, cta }) {
  return (
    <Link href={href} className={styles.actionCard}>
      <div className={styles.actionIcon} aria-hidden="true">
        <Icon size={20} strokeWidth={2} />
      </div>
      <h3 className={styles.actionTitle}>{title}</h3>
      <p className={styles.actionBody}>{body}</p>
      <span className={styles.actionCta}>
        {cta} <ArrowRight size={16} className={styles.actionCtaIcon} />
      </span>
    </Link>
  );
}

function AmcCard({ active, monthsLeft, endDate }) {
  const endLabel = endDate
    ? new Date(endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—';
  return (
    <Link href="/services/amc" className={`${styles.actionCard} ${styles.amcCard}`}>
      <div className={styles.amcHead}>
        <div className={styles.amcIcon} aria-hidden="true">
          <ShieldCheck size={20} strokeWidth={2} />
        </div>
        <span className={styles.amcBadge}>
          {active ? 'PREMIUM ACTIVE' : 'NOT ENROLLED'}
        </span>
      </div>
      <h3 className={styles.actionTitle}>AMC Status</h3>
      <p className={styles.actionBody}>
        {active
          ? `Your comprehensive maintenance contract covers all critical systems until ${endLabel}.`
          : 'Enroll in our annual maintenance contract for priority response and quarterly visits.'}
      </p>
      <button type="button" className={styles.amcBtn}>
        {active ? 'View Coverage' : 'Get a Quote'}
      </button>
    </Link>
  );
}

function Panel({ title, count, action, children }) {
  const Icon = action?.icon;
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <div className={styles.panelTitleRow}>
          <h2 className={styles.panelTitle}>{title}</h2>
          {count != null && count > 0 && (
            <span className={styles.panelCount}>{count}</span>
          )}
        </div>
        {action && (
          <Link href={action.href} className={styles.panelAction}>
            {action.label}
            {Icon && <Icon size={14} />}
          </Link>
        )}
      </header>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

function ProjectMini({ project }) {
  const acLabel = (project.acType || '').replace('_', '/') || 'AC';
  return (
    <Link
      href={`/installations/${project.requestNumber}`}
      className={styles.projectMiniRow}
    >
      <div className={styles.projectMiniIcon} aria-hidden="true">
        <Snowflake size={14} />
      </div>
      <div className={styles.projectMiniBody}>
        <p className={styles.projectMiniTitle}>{acLabel} Installation</p>
        <p className={styles.projectMiniMeta}>
          {project.requestNumber}
          {project.propertyLabel && ` • ${project.propertyLabel}`}
        </p>
      </div>
      <ArrowRight size={14} className={styles.projectMiniArrow} />
    </Link>
  );
}

function ProjectFeature({ project, progress }) {
  const acLabel = (project.acType || '').replace('_', '/') || 'AC';
  const title = project.title || `${acLabel} Installation`;
  return (
    <Link href={`/installations/${project.requestNumber}`} className={styles.projectCard}>
      <div className={styles.projectImage} aria-hidden="true">
        <div className={styles.projectImageGradient} />
        <span className={styles.projectStatus}>
          <span className={styles.projectStatusDot} />
          {project.statusLabel || 'In Progress'}
        </span>
      </div>
      <div className={styles.projectMeta}>
        <h4 className={styles.projectTitle}>{title}</h4>
        <p className={styles.projectId}>ID: {project.requestNumber}</p>
        <div className={styles.projectProgressRow}>
          <span className={styles.projectPhase}>{progress.label}</span>
          <span className={styles.projectPct}>{progress.percent}%</span>
        </div>
        <div className={styles.projectBar}>
          <div
            className={styles.projectBarFill}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        {project.propertyLabel && (
          <p className={styles.projectMetaLine}>
            <MapPin size={12} /> {project.propertyLabel}
          </p>
        )}
      </div>
    </Link>
  );
}

function TicketRow({ ticket }) {
  const Icon = iconForTicket(ticket);
  const status = statusFor(ticket);
  const tone = statusTone(ticket.status);
  return (
    <Link
      href={`/tickets/${ticket.ticketNumber}`}
      className={styles.ticketRow}
    >
      <div className={styles.ticketLeft}>
        <div className={styles.ticketIcon} aria-hidden="true">
          <Icon size={18} strokeWidth={2} />
        </div>
        <div>
          <h4 className={styles.ticketTitle}>
            {(ticket.problemCategory || 'Service request').replace(/_/g, ' ')}
          </h4>
          <p className={styles.ticketMeta}>
            {ticket.ticketNumber}
            {ticket.createdAt && ` • ${formatTicketDate(ticket.createdAt)}`}
          </p>
        </div>
      </div>
      <span className={`${styles.ticketBadge} ${styles[`badge_${tone}`] || ''}`}>
        {status}
      </span>
    </Link>
  );
}

function EmptyState({ title, body, cta }) {
  return (
    <div className={styles.empty}>
      <h4 className={styles.emptyTitle}>{title}</h4>
      <p className={styles.emptyBody}>{body}</p>
      {cta && (
        <Link href={cta.href} className={styles.emptyCta}>
          {cta.label} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────── */

function deriveProgress(project) {
  if (!project) return { label: 'Awaiting start', percent: 0 };
  const map = {
    DRAFT:                   { label: 'Phase 1: Draft',           percent: 8 },
    QUOTE_PREP:              { label: 'Phase 1: Quote prep',      percent: 18 },
    QUOTE_SENT:              { label: 'Phase 1: Quote sent',      percent: 28 },
    QUOTE_APPROVED:          { label: 'Phase 1: Approved',        percent: 40 },
    SCHEDULED:               { label: 'Phase 2: Scheduled',       percent: 55 },
    ASSIGNED:                { label: 'Phase 2: Assigned',        percent: 60 },
    IN_PROGRESS:             { label: 'Phase 2: Installation',    percent: 75 },
    AWAITING_HANDOFF:        { label: 'Phase 3: Handoff',         percent: 90 },
    COMPLETED:               { label: 'Completed',                percent: 100 },
  };
  return map[(project.status || '').toUpperCase()] || {
    label: 'Phase 1: In review',
    percent: 25,
  };
}

function statusTone(raw) {
  const s = (raw || '').toUpperCase();
  if (['RESOLVED', 'CLOSED', 'COMPLETED'].includes(s)) return 'resolved';
  if (['SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(s)) return 'scheduled';
  if (['IN_PROGRESS'].includes(s)) return 'inprogress';
  if (['CANCELLED'].includes(s)) return 'cancelled';
  return 'pending';
}

function formatTicketDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
