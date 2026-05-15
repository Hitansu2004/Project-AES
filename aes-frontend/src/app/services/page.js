'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Snowflake, Wrench, ShieldCheck, ChevronRight, Phone, LayoutGrid,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { AES_BRANDS } from '@/lib/aesCatalog';
import AppTopBar from '@/components/ui/AppTopBar';
import styles from './services.module.css';

const OPTIONS = [
  {
    id: 'install',
    href: '/services/installation',
    title: 'New AC Installation',
    desc: 'Install a Split, Central, VRF/VRV or Cassette unit at your home or office.',
    chips: ['Split AC', 'Central AC', 'VRF/VRV'],
    eyebrow: 'Project',
    Icon: Snowflake,
    accent: 'install',
  },
  {
    id: 'service',
    href: '/services/ticket',
    title: 'Service / Repair Request',
    desc: 'Your existing AC needs attention — we will diagnose and fix it.',
    chips: ['Not Cooling', 'Noise', 'Water Leak'],
    eyebrow: 'Support',
    Icon: Wrench,
    accent: 'service',
  },
  {
    id: 'amc',
    href: '/services/amc',
    title: 'Schedule AMC Visit',
    desc: 'Book your routine AMC service or check upcoming visits.',
    chips: ['4 visits / year', 'Priority response'],
    eyebrow: 'Maintenance',
    Icon: ShieldCheck,
    accent: 'amc',
  },
  {
    id: 'catalog',
    href: '/services/products',
    title: 'Browse Products',
    desc: 'VRF, chillers, ductable, cassettes, AHU, ventilation — see the full range.',
    chips: ['VRF', 'Chillers', 'Cassette', 'AHU'],
    eyebrow: 'Catalog',
    Icon: LayoutGrid,
    accent: 'catalog',
  },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32 } },
};

export default function ServicesChooserPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login?next=/services'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  return (
    <div className={styles.shell}>
      <AppTopBar title="What do you need?" showBack />

      <div className={styles.intro}>
        <motion.h1
          className={styles.heading}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          How can we help you?
        </motion.h1>
        <motion.p
          className={styles.sub}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          Choose the type of service you need — we will route you to the right team.
        </motion.p>
      </div>

      <motion.div
        className={styles.cards}
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {OPTIONS.map(({ id, href, title, desc, chips, eyebrow, Icon, accent }) => (
          <motion.div key={id} variants={item}>
            <Link href={href} className={`${styles.card} ${styles[accent]}`}>
              <span className={styles.eyebrow}>{eyebrow}</span>
              <div className={styles.iconWrap}><Icon size={26} /></div>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardDesc}>{desc}</p>
              <div className={styles.chipRow}>
                {chips.map((c) => <span key={c} className={styles.chip}>{c}</span>)}
              </div>
              <span className={styles.cardArrow}>
                <ChevronRight size={20} />
              </span>
              <div className={styles.cardDeco} aria-hidden="true">
                <Icon size={140} />
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
        <Phone size={14} /> Not sure? Call us at <strong>+91 40-6613-1555</strong>
      </a>
    </div>
  );
}
