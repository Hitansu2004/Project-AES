'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Lightbulb, ArrowRight, Wrench, AlertTriangle, RotateCcw,
} from 'lucide-react';
import RoseShell from '@/components/rose/RoseShell';
import RoseSplash from '@/components/rose/RoseSplash';
import { ERROR_CODE_BRANDS, ERROR_CODES } from '@/lib/errorCodes';
import styles from './error.module.css';

export default function ErrorCodesPage() {
  return (
    <Suspense fallback={<RoseSplash message="Loading error code guide…" />}>
      <ErrorCodesScreen />
    </Suspense>
  );
}

function ErrorCodesScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromWizard = searchParams.get('from') === 'wizard';
  const [activeBrand, setActiveBrand] = useState(ERROR_CODE_BRANDS[0]);
  const [query, setQuery] = useState('');

  const codes = useMemo(() => {
    const list = ERROR_CODES[activeBrand] || [];
    if (!query.trim()) return list;
    const needle = query.trim().toLowerCase();
    return list.filter((c) =>
      c.code.toLowerCase().includes(needle)
      || c.title.toLowerCase().includes(needle)
      || c.desc.toLowerCase().includes(needle)
    );
  }, [activeBrand, query]);

  const pickCode = (code) => {
    if (fromWizard) {
      router.replace(`/services/ticket?step=3&code=${encodeURIComponent(code)}`);
    } else {
      router.push(`/services/ticket?step=3&code=${encodeURIComponent(code)}`);
    }
  };

  const goBookService = () => {
    if (fromWizard) router.back();
    else router.push('/services/ticket');
  };

  const hero = (
    <div className={styles.heroRow}>
      <div className={styles.heroText}>
        <h1 className={styles.heroTitle}>Error Code Guide</h1>
        <p className={styles.heroSub}>
          Look up your AC&apos;s error code, learn what it means, and pick the right
          fix — or apply it directly to a new service ticket.
        </p>
      </div>
      <button
        type="button"
        onClick={goBookService}
        className={styles.heroCta}
      >
        <Wrench size={14} /> {fromWizard ? 'Back to ticket' : 'Book service'}
      </button>
    </div>
  );

  return (
    <RoseShell hero={hero}>
      {/* Brand pills */}
      <section className={styles.brandTabs} role="tablist" aria-label="Brand">
        {ERROR_CODE_BRANDS.map((brand) => {
          const active = brand === activeBrand;
          return (
            <button
              key={brand}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => { setActiveBrand(brand); setQuery(''); }}
              className={`${styles.brandTab} ${active ? styles.brandTabActive : ''}`}
            >
              {brand}
            </button>
          );
        })}
      </section>

      {/* Search */}
      <div className={styles.searchRow}>
        <Search size={16} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${activeBrand} codes — e.g. E1, H6, P1…`}
        />
        {query && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* Cards */}
      <div className={styles.list}>
        <AnimatePresence mode="popLayout">
          {codes.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={styles.empty}
            >
              <div className={styles.emptyIcon}><Search size={26} /></div>
              <h3>No matching codes</h3>
              <p>Try a different brand or clear the search.</p>
            </motion.div>
          ) : (
            codes.map((c, i) => (
              <motion.article
                key={`${activeBrand}-${c.code}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.025 }}
                className={styles.card}
              >
                <button
                  type="button"
                  className={styles.cardClick}
                  onClick={() => pickCode(c.code)}
                  aria-label={`Apply error code ${c.code} to your ticket`}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.codePill}>{c.code}</span>
                    <div className={styles.cardTitleCol}>
                      <h3 className={styles.cardTitle}>{c.title}</h3>
                      <span className={`${styles.severity} ${c.severity === 'TECH' ? styles.sevTech : styles.sevReset}`}>
                        {c.severity === 'TECH'
                          ? <AlertTriangle size={11} />
                          : <RotateCcw size={11} />}
                        {c.severity === 'TECH' ? 'Requires Technician' : 'Try Reset First'}
                      </span>
                    </div>
                  </div>
                  <p className={styles.cardDesc}>{c.desc}</p>
                  <div className={styles.cardTip}>
                    <Lightbulb size={14} />
                    <p>{c.tip}</p>
                  </div>
                  <span className={styles.applyHint}>
                    Apply to my ticket <ArrowRight size={12} />
                  </span>
                </button>
              </motion.article>
            ))
          )}
        </AnimatePresence>
      </div>
    </RoseShell>
  );
}
