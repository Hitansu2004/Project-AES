'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Snowflake,
  Wrench,
  ShieldCheck,
  ArrowUpRight,
  Phone,
  LayoutGrid,
  AlertCircle,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { AES_BRANDS } from '@/lib/aesCatalog';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
import styles from './services.module.css';

const OPTIONS = [
  {
    id: 'install',
    href: '/services/installation',
    eyebrow: 'Project',
    title: 'New AC Installation',
    desc: 'Install a Split, Central, VRF/VRV or Cassette unit at your home or office.',
    chips: ['Split AC', 'Central AC', 'VRF/VRV'],
    Icon: Snowflake,
  },
  {
    id: 'service',
    href: '/services/ticket',
    eyebrow: 'Support',
    title: 'Service / Repair Request',
    desc: 'Your existing AC needs attention — we will diagnose and fix it.',
    chips: ['Not Cooling', 'Noise', 'Water Leak'],
    Icon: Wrench,
  },
  {
    id: 'amc',
    href: '/services/amc',
    eyebrow: 'Maintenance',
    title: 'Schedule AMC Visit',
    desc: 'Book your routine AMC service or check upcoming visits.',
    chips: ['4 visits / year', 'Priority response'],
    Icon: ShieldCheck,
  },
  {
    id: 'catalog',
    href: '/services/products',
    eyebrow: 'Catalog',
    title: 'Browse Products',
    desc: 'VRF, chillers, ductable, cassettes, AHU, ventilation — see the full range.',
    chips: ['VRF', 'Chillers', 'Cassette', 'AHU'],
    Icon: LayoutGrid,
  },
  {
    id: 'errors',
    href: '/services/error-codes',
    eyebrow: 'Diagnose',
    title: 'Error Code Guide',
    desc: 'Look up your AC error code and learn what it means before raising a ticket.',
    chips: ['Daikin', 'Mitsubishi', 'Carrier'],
    Icon: AlertCircle,
  },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.32 } },
};

export default function ServicesChooserPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login?next=/services'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, loading, router]);

  if (loading || !user) return <RoseSplash message="Loading services…" />;

  const hero = (
    <>
      <h1 className={styles.heroTitle}>How can we help you?</h1>
      <p className={styles.heroSub}>
        Choose the type of service you need — we will route you to the right team
        and respond within 30 minutes.
      </p>
    </>
  );

  return (
    <RoseShell hero={hero}>
      <motion.div
        className={styles.cards}
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {OPTIONS.map(({ id, href, title, desc, chips, eyebrow, Icon }) => (
          <motion.div key={id} variants={itemAnim}>
            <Link href={href} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardIcon} aria-hidden="true">
                  <Icon size={24} strokeWidth={1.8} />
                </div>
                <span className={styles.eyebrow}>{eyebrow}</span>
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardDesc}>{desc}</p>
              </div>
              <div className={styles.cardFoot}>
                <div className={styles.chipRow}>
                  {chips.map((c) => <span key={c} className={styles.chip}>{c}</span>)}
                </div>
                <span className={styles.cardArrow}>
                  <ArrowUpRight size={18} strokeWidth={2} />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <section className={styles.brandStrip} aria-label="Authorised partners">
        <span className={styles.brandLabel}>Authorised dealer for</span>
        <div className={styles.brandLogos}>
          {AES_BRANDS.map((b) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={b.name} src={b.logo} alt={b.name} title={b.name} loading="lazy" />
          ))}
        </div>
      </section>

      <a href="tel:+914066131555" className={styles.helpLine}>
        <Phone size={14} /> Not sure where to start? Call us at <strong>+91 40-6613-1555</strong>
      </a>
    </RoseShell>
  );
}
