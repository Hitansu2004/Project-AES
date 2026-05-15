'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ArrowRight, Phone, Sparkles, X, Check,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import {
  PRODUCT_FAMILIES, AES_BRANDS, AES_PROJECTS, BUILDING_TYPES,
} from '@/lib/aesCatalog';
import AppTopBar from '@/components/ui/AppTopBar';
import styles from './products.module.css';

const FILTERS = [
  { value: 'ALL', label: 'All spaces' },
  ...BUILDING_TYPES.map((b) => ({ value: b.value, label: b.label.split(' /')[0] })),
];

const HERO_PHOTOS = PRODUCT_FAMILIES.slice(0, 6).map((f) => f.cover);

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32 } },
};

export default function ProductsCatalogPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [filter, setFilter] = useState('ALL');
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login?next=/services/products'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, loading, router]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return PRODUCT_FAMILIES;
    return PRODUCT_FAMILIES.filter((p) =>
      p.bestFor.some((t) => t.toUpperCase() === filter)
    );
  }, [filter]);

  const projectStrip = useMemo(() => {
    const pool = filter === 'ALL'
      ? AES_PROJECTS
      : AES_PROJECTS.filter((p) => p.category === filter);
    return pool.slice(0, 8);
  }, [filter]);

  if (loading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  return (
    <div className={styles.shell}>
      <AppTopBar title="Our Products" showBack />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>
            <Sparkles size={12} /> Authorised dealer
          </span>
          <h1 className={styles.heroTitle}>
            Cooling &amp; air-distribution<br />for every kind of space.
          </h1>
          <p className={styles.heroSub}>
            We design, supply, install and maintain Mitsubishi Electric, LG,
            Hisense, Hitachi and O&apos;General systems across residential,
            commercial, industrial and institutional projects since 2006.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/services/installation" className="btn btn-primary">
              Plan an installation <ArrowRight size={16} />
            </Link>
            <a href="tel:+914066131555" className={styles.heroCall}>
              <Phone size={14} /> +91 40-6613-1555
            </a>
          </div>
        </div>
        <div className={styles.heroMosaic} aria-hidden="true">
          {HERO_PHOTOS.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading="lazy" style={{ '--i': i }} />
          ))}
        </div>
      </section>

      {/* Filters */}
      <section className={styles.filterBar}>
        <div className={styles.filterScroll}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`${styles.filterChip} ${filter === f.value ? styles.filterChipActive : ''}`}
            >
              {filter === f.value && <Check size={12} strokeWidth={3} />}
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Product family grid */}
      <motion.section
        className={styles.grid}
        variants={stagger}
        initial="hidden"
        animate="show"
        key={filter}
      >
        {filtered.map((fam) => (
          <motion.button
            key={fam.slug}
            type="button"
            variants={item}
            whileHover={{ y: -3 }}
            onClick={() => setActive(fam)}
            className={styles.card}
          >
            <div className={styles.cardMedia}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fam.cover} alt={fam.name} loading="lazy" />
              <div className={styles.cardMediaShade} aria-hidden="true" />
              <span className={styles.cardCount}>{fam.photos.length} photos</span>
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{fam.name}</h3>
              <p className={styles.cardTagline}>{fam.tagline}</p>
              <div className={styles.cardChips}>
                {fam.bestFor.slice(0, 3).map((t) => (
                  <span key={t} className={styles.cardChip}>{t}</span>
                ))}
              </div>
              <span className={styles.cardArrow}>
                Explore range <ChevronRight size={16} />
              </span>
            </div>
          </motion.button>
        ))}

        {filtered.length === 0 && (
          <div className={styles.empty}>
            <p>No families match this space — try another filter.</p>
          </div>
        )}
      </motion.section>

      {/* Brand strip */}
      <section className={styles.brandSection}>
        <h2 className={styles.sectionTitle}>Authorised dealer for</h2>
        <div className={styles.brandRow}>
          {AES_BRANDS.map((b) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={b.name} src={b.logo} alt={b.name} title={b.name} loading="lazy" />
          ))}
        </div>
      </section>

      {/* Project showcase */}
      <section className={styles.projects}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Trusted on projects like</h2>
          <span className={styles.sectionSub}>
            {filter === 'ALL' ? 'Across India' : `${filter[0] + filter.slice(1).toLowerCase()} portfolio`}
          </span>
        </div>
        <div className={styles.projectGrid}>
          {projectStrip.map((p) => (
            <article key={p.name + p.city} className={styles.projectTile}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={p.name} loading="lazy" />
              <div className={styles.projectMeta}>
                <h4>{p.name}</h4>
                <span>{p.city}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Detail dialog */}
      <AnimatePresence>
        {active && (
          <motion.div
            className={styles.modalBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            <motion.div
              className={styles.modal}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.modalClose}
                aria-label="Close"
                onClick={() => setActive(null)}
              >
                <X size={18} />
              </button>
              <div className={styles.modalHero}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={active.cover} alt={active.name} />
              </div>
              <div className={styles.modalBody}>
                <h3 className={styles.modalTitle}>{active.name}</h3>
                <p className={styles.modalTagline}>{active.tagline}</p>

                <h4 className={styles.modalSub}>Variants</h4>
                <div className={styles.thumbRow}>
                  {active.photos.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" loading="lazy" />
                  ))}
                </div>

                {(active.indoorUnits || active.variants || active.accessories) && (
                  <>
                    <h4 className={styles.modalSub}>Configurations</h4>
                    <div className={styles.variantGrid}>
                      {(active.indoorUnits || active.variants || active.accessories).map((v) => (
                        <div key={v.label} className={styles.variantTile}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={v.image} alt={v.label} loading="lazy" />
                          <span>{v.label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <h4 className={styles.modalSub}>Best for</h4>
                <div className={styles.cardChips}>
                  {active.bestFor.map((t) => (
                    <span key={t} className={styles.cardChip}>{t}</span>
                  ))}
                </div>

                <Link
                  href="/services/installation"
                  className="btn btn-primary btn-full btn-lg"
                  style={{ marginTop: 22 }}
                >
                  Get a quote for this <ArrowRight size={16} />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
