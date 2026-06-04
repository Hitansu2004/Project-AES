'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  Calendar,
  ShieldCheck,
  Phone,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { amc } from '@/lib/api';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
import styles from './amc.module.css';

const PERKS = [
  { label: '4 visits per year', icon: Calendar },
  { label: 'Priority response (4 h SLA)', icon: ShieldCheck },
  { label: 'Genuine spare parts', icon: CheckCircle2 },
];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function AmcPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    (async () => {
      try {
        const data = await amc.myContracts();
        setContracts(Array.isArray(data) ? data : []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [user, authLoading, router]);

  if (authLoading || loading || !user) {
    return <RoseSplash message="Loading AMC contracts…" />;
  }

  const activeContracts = contracts.filter((c) => c.isActive);
  const expired = contracts.filter((c) => !c.isActive);

  const hero = (
    <div className={styles.heroRow}>
      <div className={styles.heroText}>
        <h1 className={styles.heroTitle}>AMC Service</h1>
        <p className={styles.heroSub}>
          {contracts.length === 0
            ? 'Get peace of mind with our Annual Maintenance Contracts — 4 visits a year and priority service.'
            : `${activeContracts.length} active · ${expired.length} expired — manage your maintenance contracts here.`}
        </p>
      </div>
      <a href="tel:+914066131555" className={styles.heroCta}>
        <Phone size={14} /> Call AMC desk
      </a>
    </div>
  );

  return (
    <RoseShell hero={hero}>
      {/* Perks strip */}
      <section className={styles.perks}>
        {PERKS.map(({ label, icon: Icon }) => (
          <div key={label} className={styles.perk}>
            <span className={styles.perkIcon}>
              <Icon size={16} strokeWidth={2} />
            </span>
            <span>{label}</span>
          </div>
        ))}
      </section>

      {contracts.length === 0 ? (
        <motion.div
          className={styles.empty}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
        >
          <div className={styles.emptyIcon}>
            <ClipboardCheck size={26} />
          </div>
          <h3>No AMC contracts on file</h3>
          <p>
            We don&apos;t have any AMC contracts under your name. Call the AMC desk to enrol
            your equipment for proactive maintenance and faster ticket resolution.
          </p>
          <div className={styles.emptyActions}>
            <a href="tel:+914066131555" className={styles.primaryBtn}>
              <Phone size={14} /> Call AMC desk
            </a>
            <Link href="/services" className={styles.secondaryBtn}>
              Back to services
            </Link>
          </div>
        </motion.div>
      ) : (
        <motion.div
          className={styles.contractList}
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        >
          {contracts.map((c) => (
            <motion.article
              key={c.id}
              className={`${styles.card} ${c.isActive ? styles.cardActive : styles.cardExpired}`}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show:   { opacity: 1, y: 0 },
              }}
            >
              <header className={styles.cardHead}>
                <div className={styles.cardHeadLeft}>
                  <span className={styles.contractNum}>{c.contractNumber || 'AMC'}</span>
                  <span className={`${styles.statusPill} ${c.isActive ? styles.statusActive : styles.statusExpired}`}>
                    {c.isActive ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    {c.isActive ? 'Active' : 'Expired'}
                  </span>
                </div>
                <h2 className={styles.cardTitle}>
                  {c.planLabel || 'Annual Maintenance Contract'}
                </h2>
              </header>

              <div className={styles.metaGrid}>
                <Metric label="Start" value={fmtDate(c.startDate)} />
                <Metric label="Ends" value={fmtDate(c.endDate)} />
                <Metric
                  label="Visits Used"
                  value={`${c.visitsCompleted || 0}/${c.visitsPerYear || 4}`}
                  emphasize
                />
              </div>

              {(c.visitsPerYear || 4) > 0 && (
                <div className={styles.progressBar} aria-hidden="true">
                  <span
                    className={styles.progressFill}
                    style={{
                      width: `${Math.min(100, ((c.visitsCompleted || 0) / (c.visitsPerYear || 4)) * 100)}%`,
                    }}
                  />
                </div>
              )}

              <footer className={styles.cardFoot}>
                {c.isActive && (
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => router.push('/services/ticket?amc=1')}
                  >
                    Schedule visit <ArrowRight size={13} />
                  </button>
                )}
                <Link href="/account?tab=amc" className={styles.secondaryBtn}>
                  View details
                </Link>
              </footer>
            </motion.article>
          ))}
        </motion.div>
      )}
    </RoseShell>
  );
}

function Metric({ label, value, emphasize }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={`${styles.metricValue} ${emphasize ? styles.metricValueStrong : ''}`}>
        {value}
      </span>
    </div>
  );
}
