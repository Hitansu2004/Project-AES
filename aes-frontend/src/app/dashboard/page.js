'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bell, Snowflake, Wrench, ShieldCheck, ChevronRight, Clock, MapPin, Sparkles,
  CalendarDays, ArrowRight,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
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
    !['COMPLETED', 'CANCELLED'].includes(r.status)
  );

  if (authLoading || !user || loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className={styles.shell}>
      <TopBar userName={user.name} unread={0} />

      <motion.main
        className={styles.main}
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Hero — greeting card */}
        <motion.section variants={fadeInUp} className={styles.hero}>
          <div className={styles.heroDeco} aria-hidden="true">
            <Snowflake size={120} />
          </div>
          <div className={styles.heroBody}>
            <p className={styles.greeting}>
              {greetingFor()}, <strong>{user.name?.split(' ')[0] || 'there'}</strong> 👋
            </p>
            <p className={styles.heroSubtitle}>
              {dash?.activeProjects ?? 0} active project
              {dash?.activeProjects === 1 ? '' : 's'} · {dash?.openTickets ?? 0} open ticket
              {dash?.openTickets === 1 ? '' : 's'}
            </p>
            <div className={styles.heroChips}>
              <Chip icon={<Wrench size={14} />} label={`${dash?.activeProjects ?? 0} Projects`} />
              <Chip icon={<Clock size={14} />} label={`${dash?.openTickets ?? 0} Tickets`} />
              {activeContract && (
                <Chip icon={<ShieldCheck size={14} />} label="AMC Active" tone="amc" />
              )}
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

        {/* Projects */}
        {activeProjects.length > 0 && (
          <motion.section variants={fadeInUp} className={styles.section}>
            <SectionHeader title="My Projects" href="/tickets" />
            <div className={styles.scrollRow}>
              {activeProjects.slice(0, 5).map((req) => (
                <ProjectCard key={req.id} project={req} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Tickets */}
        <motion.section variants={fadeInUp} className={styles.section}>
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
        <motion.section variants={fadeInUp} className={styles.section}>
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
              <ChevronRight size={20} className={styles.amcChevron} />
            </Link>
          ) : (
            <div className={styles.amcCardEmpty}>
              <div className={styles.amcIconEmpty} aria-hidden="true">
                <Sparkles size={20} />
              </div>
              <div className={styles.amcBody}>
                <h4 className={styles.amcTitle}>No active AMC</h4>
                <p className={styles.amcDesc}>
                  Get priority response, free labor and quarterly visits.
                </p>
              </div>
              <a href="tel:+914023540000" className={styles.amcCta}>Contact us</a>
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
        <button className={styles.bellButton} aria-label="Notifications">
          <Bell size={20} />
          {unread > 0 && <span className={styles.bellBadge}>{unread}</span>}
        </button>
        <div className={styles.avatar}>
          {(userName || 'U').charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

function Chip({ icon, label, tone = 'default' }) {
  return (
    <span className={`${styles.chip} ${tone === 'amc' ? styles.chipAmc : ''}`}>
      {icon}
      {label}
    </span>
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

function ProjectCard({ project }) {
  const tense = relativeIn(project.scheduledDate);
  return (
    <Link href={`/tickets`} className={styles.projectCard}>
      <span className={styles.projectAccent} aria-hidden="true" />
      <div className={styles.projectBody}>
        <p className={styles.projectNumber}>{project.requestNumber}</p>
        <h4 className={styles.projectTitle}>
          {project.acType?.replace('_', '/')} Installation
        </h4>
        <p className={styles.projectMeta}>
          <MapPin size={12} /> {project.propertyLabel || 'Hyderabad'}
        </p>
        {tense && <span className={styles.projectChip}>Visit {tense}</span>}
      </div>
      <ChevronRight size={18} className={styles.projectChevron} />
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
      <span className={styles.ticketAccent} aria-hidden="true" />
      <div className={styles.ticketBody}>
        <div className={styles.ticketTopRow}>
          {priorityChip(ticket.priority)}
          <span className="label-md">{ticket.ticketNumber}</span>
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
            <Clock size={12} /> SLA exceeded
          </span>
        )}
      </div>
      <ChevronRight size={18} className={styles.ticketChevron} />
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
