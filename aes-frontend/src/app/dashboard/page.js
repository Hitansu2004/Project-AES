'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bell, Snowflake, Wrench, ShieldCheck, ChevronRight, Clock, MapPin,
  CalendarDays, ArrowRight, Wind, Layers, AlertTriangle, BadgeCheck,
  Phone, MessageSquare, Headphones,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
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

const PRIORITY_TONE = {
  P1: 'amc',
  P2: 'warranty',
  P3: 'paid',
};

function priorityChip(priority) {
  const tone = PRIORITY_TONE[priority] || 'open';
  return <span className={`badge badge-${tone}`}>{priority}</span>;
}

function relativeIn(date) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

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

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

export default function CustomerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { unread } = useNotifications();
  const router = useRouter();
  const [dash, setDash] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/dashboard'); return; }
    if (user.role !== 'CUSTOMER') {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [user, authLoading, router]);

  // Fetch in parallel
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

  const recentTickets = (dash?.recentTickets || []).slice(0, 2);
  const activeProjects = requests.filter((r) =>
    !['COMPLETED', 'CANCELLED', 'QUOTE_REJECTED_INTERNAL'].includes(r.status)
  );
  // Prefer the live installation-list count (always accurate) over the
  // /dashboard/customer roll-up, which can lag behind by a few seconds.
  const projectCount = activeProjects.length || (dash?.activeProjects ?? 0);
  const ticketCount  = dash?.openTickets ?? recentTickets.length;

  if (authLoading || !user || loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className={`${styles.shell} ${styles.blueprint}`}>
      <TopBar userName={user.name} unread={unread} />

      <motion.main
        className={styles.main}
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Hero — greeting card */}
        <motion.section variants={fadeInUp} className={styles.hero}>
          <div className={styles.heroDeco} aria-hidden="true">
            <Snowflake size={140} />
          </div>
          <div className={styles.heroBody}>
            <h1 className={styles.greeting}>
              {greetingFor()}, <strong>{user.name?.split(' ')[0] || 'there'}</strong> 👋
            </h1>
            <p className={styles.heroSubtitle}>
              {projectCount} active project{projectCount === 1 ? '' : 's'} ·{' '}
              {ticketCount} open ticket{ticketCount === 1 ? '' : 's'}
            </p>
            <div className={styles.heroChips}>
              <Link href="/installations" className={styles.chip}>
                <Wrench size={14} />
                {projectCount} Projects
              </Link>
              <Link href="/tickets" className={styles.chip}>
                <Clock size={14} />
                {ticketCount} Tickets
              </Link>
            </div>
          </div>
        </motion.section>

        {/* Two big CTA cards */}
        <motion.section variants={fadeInUp} className={styles.ctaGrid}>
          <Link href="/services/installation" className={`${styles.cta} ${styles.ctaInstall}`}>
            <div className={styles.ctaDeco} aria-hidden="true">
              <Snowflake size={120} />
            </div>
            <div className={styles.ctaIcon}><Snowflake size={22} /></div>
            <div className={styles.ctaBody}>
              <span className={styles.ctaEyebrow}>Plan a project</span>
              <h3 className={styles.ctaTitle}>New AC Installation</h3>
              <p className={styles.ctaDesc}>Get a quote for Split, Central or VRF/VRV</p>
              <div className={styles.ctaTags}>
                <span>Split</span><span>Central</span><span>VRF/VRV</span>
              </div>
            </div>
            <span className={styles.ctaPill}>
              Request now <ArrowRight size={14} />
            </span>
          </Link>

          <Link href="/services/ticket" className={`${styles.cta} ${styles.ctaService}`}>
            <div className={styles.ctaDeco} aria-hidden="true">
              <Wrench size={120} />
            </div>
            <div className={styles.ctaIcon}><Wrench size={22} /></div>
            <div className={styles.ctaBody}>
              <span className={styles.ctaEyebrow}>Need help?</span>
              <h3 className={styles.ctaTitle}>Service Request</h3>
              <p className={styles.ctaDesc}>AMC · Warranty · Paid Service</p>
              <div className={styles.ctaTags}>
                <span>Not Cooling</span><span>Noise</span><span>Leaking</span>
              </div>
            </div>
            <span className={styles.ctaPill}>
              Book service <ArrowRight size={14} />
            </span>
          </Link>
        </motion.section>

        {/* Talk to us — fills the empty 1/3 column on desktop */}
        <motion.section variants={fadeInUp} className={styles.helpSection}>
          <HelpCard />
        </motion.section>

        {/* Projects */}
        <motion.section
          variants={fadeInUp}
          className={`${styles.section} ${styles.projectsSection}`}
        >
          <SectionHeader title="My Projects" href="/installations" />
          {activeProjects.length === 0 ? (
            <EmptyState
              title="No active projects"
              body="Plan a new installation and we'll guide you from quote to commissioning."
              cta={{ href: '/services/installation', label: 'Request a quote' }}
            />
          ) : (
            <div
              className={
                activeProjects.length === 1 ? styles.singleRow : styles.scrollRow
              }
            >
              {activeProjects.slice(0, 5).map((req) => (
                <ProjectCard key={req.id} project={req} />
              ))}
            </div>
          )}
        </motion.section>

        {/* Tickets */}
        <motion.section
          variants={fadeInUp}
          className={`${styles.section} ${styles.ticketsSection}`}
        >
          <SectionHeader title="My Tickets" href="/tickets" />
          {recentTickets.length === 0 ? (
            <EmptyState
              title="No open tickets"
              body="Raise a ticket if your AC needs attention."
              cta={{ href: '/services/ticket', label: 'Raise a ticket' }}
            />
          ) : (
            <div className={styles.tickets}>
              {recentTickets.map((t) => <TicketRow key={t.id} ticket={t} />)}
            </div>
          )}
        </motion.section>

        {/* AMC */}
        <motion.section
          variants={fadeInUp}
          className={`${styles.section} ${styles.amcSection}`}
        >
          {activeContract ? (
            <Link href="/services/amc" className={styles.amcCard}>
              <div className={styles.amcIcon} aria-hidden="true">
                <ShieldCheck size={24} />
              </div>
              <div className={styles.amcBody}>
                <p className={styles.amcEyebrow}>Annual Maintenance</p>
                <h4 className={styles.amcTitle}>Your AMC is active</h4>
                <div className={styles.amcMeta}>
                  {amcVisit?.scheduledDate ? (
                    <span>
                      <CalendarDays size={14} /> Next visit:{' '}
                      <strong>
                        {new Date(amcVisit.scheduledDate).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </strong>
                    </span>
                  ) : (
                    <span><CalendarDays size={14} /> Visits scheduled when due</span>
                  )}
                  {amcMonthsLeft !== null && (
                    <span>{amcMonthsLeft} month{amcMonthsLeft === 1 ? '' : 's'} remaining</span>
                  )}
                </div>
              </div>
              <span className={styles.amcCta}>
                View details <ArrowRight size={14} />
              </span>
            </Link>
          ) : (
            <div className={styles.amcCardEmpty}>
              <div className={styles.amcIconEmpty} aria-hidden="true">
                <BadgeCheck size={22} />
              </div>
              <div className={styles.amcBody}>
                <h4 className={styles.amcTitle}>No active AMC</h4>
                <p className={styles.amcDesc}>
                  Get priority response, free labor and quarterly visits.
                </p>
              </div>
              <a href="tel:+914023540000" className={styles.amcCta}>
                Contact us <ArrowRight size={14} />
              </a>
            </div>
          )}
        </motion.section>
      </motion.main>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────── */

function TopBar({ userName, unread }) {
  return (
    <header className={styles.topBar}>
      <div className={styles.brandRow}>
        <div className={styles.brandIcon}><Snowflake size={20} color="#fff" /></div>
        <span className={styles.brandText}>Arial Engineering</span>
      </div>
      <div className={styles.topRight}>
        <ThemeToggle variant="round" />
        <Link href="/notifications" className={styles.bellButton} aria-label="Notifications">
          <Bell size={20} />
          {unread > 0 && (
            <span className={styles.bellBadge}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>
        <div className={styles.avatar}>
          {(userName || 'U').charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

function HelpCard() {
  return (
    <div className={styles.helpCard}>
      <span className={styles.helpEyebrow}>We're here</span>
      <h4 className={styles.helpTitle}>Talk to a specialist</h4>
      <p className={styles.helpDesc}>
        Quote, design, AMC or a quick fix &mdash; our team responds within 30 minutes
        during working hours.
      </p>
      <div className={styles.helpActions}>
        <a href="tel:+914023540000" className={styles.helpAction}>
          <span className={styles.helpActionIcon}><Phone size={15} /></span>
          <span>Call <strong>+91&nbsp;40&nbsp;2354&nbsp;0000</strong></span>
        </a>
        <a
          href="https://wa.me/919000022222"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.helpAction}
        >
          <span className={styles.helpActionIcon}><MessageSquare size={15} /></span>
          <span>WhatsApp <strong>+91&nbsp;90000&nbsp;22222</strong></span>
        </a>
      </div>
    </div>
  );
}

function SectionHeader({ title, href }) {
  return (
    <div className={styles.sectionHeader}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {href && (
        <Link href={href} className={styles.sectionLink}>
          View all <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function projectIconFor(acType) {
  switch ((acType || '').toUpperCase()) {
    case 'CENTRAL':
      return <Wind size={22} strokeWidth={2.2} />;
    case 'VRF':
    case 'VRV':
    case 'VRF_VRV':
      return <Layers size={22} strokeWidth={2.2} />;
    case 'SPLIT':
    default:
      return <Snowflake size={22} strokeWidth={2.2} />;
  }
}

function ProjectCard({ project }) {
  const tense = relativeIn(project.scheduledDate);
  const acLabel = (project.acType || '').replace('_', '/') || 'AC';
  return (
    <Link href={`/installations/${project.requestNumber}`} className={styles.projectCard}>
      <span className={styles.projectAccent} aria-hidden="true" />
      <div className={styles.projectIcon} aria-hidden="true">
        {projectIconFor(project.acType)}
      </div>
      <div className={styles.projectBody}>
        <p className={styles.projectNumber}>{project.requestNumber}</p>
        <h4 className={styles.projectTitle}>{acLabel} Installation</h4>
        <p className={styles.projectMeta}>
          <MapPin size={12} /> {project.propertyLabel || 'Hyderabad'}
        </p>
      </div>
      <div className={styles.projectAside}>
        <ChevronRight size={18} className={styles.projectChevron} />
        {tense && (
          <span className={styles.projectChip}>
            <CalendarDays size={11} /> Visit {tense}
          </span>
        )}
      </div>
    </Link>
  );
}

function TicketRow({ ticket }) {
  const sec = ticket.slaRemainingSecondsL1;
  const showCountdown = sec != null && sec > 0 && !ticket.isL1Breached;
  const minutes = sec != null ? Math.ceil(sec / 60) : null;
  const breached = ticket.isL1Breached || ticket.isL2Breached || ticket.isFinalBreached;

  return (
    <Link
      href={`/tickets/${ticket.ticketNumber}`}
      className={`${styles.ticketRow} ${breached ? styles.ticketRowAlert : ''}`}
    >
      <div className={styles.ticketTopRow}>
        <div className={styles.ticketTopLeft}>
          {priorityChip(ticket.priority)}
          <span className={styles.ticketNumber}>{ticket.ticketNumber}</span>
        </div>
        <ChevronRight size={18} className={styles.ticketChevron} />
      </div>

      <h4 className={styles.ticketTitle}>
        {(ticket.problemCategory || 'Service request').replace(/_/g, ' ')}
      </h4>

      <p className={styles.ticketMeta}>
        {ticket.acUnitRoom || ticket.propertyLabel || ticket.acBrand}
      </p>

      {showCountdown && (
        <span className={styles.ticketSla}>
          <Clock size={12} /> Response in {minutes} min
        </span>
      )}
      {breached && (
        <span className={`${styles.ticketSla} ${styles.ticketSlaBreached}`}>
          <AlertTriangle size={12} /> SLA exceeded
        </span>
      )}
    </Link>
  );
}

function EmptyState({ title, body, cta }) {
  return (
    <div className={styles.empty}>
      <h4 className={styles.emptyTitle}>{title}</h4>
      <p className={styles.emptyBody}>{body}</p>
      {cta && (
        <Link href={cta.href} className={`btn btn-outline btn-sm ${styles.emptyCta}`}>
          {cta.label} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div className="skeleton" style={{ width: 160, height: 28 }} />
        <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
      </header>
      <div className={styles.main}>
        <div className="skeleton" style={{ height: 132, borderRadius: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="skeleton" style={{ height: 196, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 196, borderRadius: 16 }} />
        </div>
        <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
        <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
      </div>
    </div>
  );
}
