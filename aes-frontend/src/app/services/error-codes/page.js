'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Lightbulb, ArrowRight, Wrench } from 'lucide-react';
import AppTopBar from '@/components/ui/AppTopBar';
import { ERROR_CODE_BRANDS, ERROR_CODES } from '@/lib/errorCodes';
import styles from './error.module.css';

export default function ErrorCodesPage() {
  return (
    <Suspense fallback={<div className="loading-page"><div className="spinner" /></div>}>
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

  return (
    <div className={styles.shell}>
      <AppTopBar title="Error Code Guide" />

      <div className={styles.brandTabs}>
        {ERROR_CODE_BRANDS.map((brand) => {
          const active = brand === activeBrand;
          return (
            <button
              key={brand}
              type="button"
              onClick={() => setActiveBrand(brand)}
              className={`${styles.brandTab} ${active ? styles.brandTabActive : ''}`}
            >
              {brand}
              {active && <motion.span layoutId="brandUnderline" className={styles.brandUnderline} />}
            </button>
          );
        })}
      </div>

      <div className={styles.searchRow}>
        <Search size={18} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search error code (e.g. E1, H6, P1...)"
        />
      </div>

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
              <Search size={28} color="var(--on-surface-variant)" />
              <h3>No matching codes</h3>
              <p>Try a different brand tab or clear the search.</p>
            </motion.div>
          ) : (
            codes.map((c, i) => (
              <motion.article
                key={`${activeBrand}-${c.code}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.03 }}
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
                        <span className={styles.severityDot} />
                        {c.severity === 'TECH' ? 'Requires Tech' : 'Try Reset First'}
                      </span>
                    </div>
                  </div>
                  <p className={styles.cardDesc}>{c.desc}</p>
                  <div className={styles.cardTip}>
                    <Lightbulb size={14} />
                    <p>{c.tip}</p>
                  </div>
                  <span className={styles.applyHint}>
                    Apply to my ticket <ArrowRight size={14} />
                  </span>
                </button>
              </motion.article>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className={styles.bottomBar}>
        <button onClick={goBookService} className="btn btn-primary btn-full btn-lg">
          <Wrench size={18} /> {fromWizard ? 'Back to Ticket' : 'Book Service'}
        </button>
      </div>
    </div>
  );
}
