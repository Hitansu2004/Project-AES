'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Building2, MapPin, Calendar, ArrowRight, ChevronRight, Snowflake,
  CheckCircle2, Clock, FileText,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { installations as installationsApi } from '@/lib/api';
import AppTopBar from '@/components/ui/AppTopBar';
import styles from './installations.module.css';

const STATUS_GROUP = {
  PENDING:                'pending',
  NEW:                    'pending',
  OFFERED_CRM:            'pending',
  CONFIRMED:              'active',
  SURVEY_SCHEDULED:       'active',
  SITE_VISITED:           'active',
  SITE_VISIT_DONE:        'active',
  QUOTE_DRAFT:            'quote',
  QUOTE_PENDING_APPROVAL: 'quote',
  QUOTE_REJECTED_INTERNAL:'quote',
  QUOTE_SENT:             'quote',
  QUOTE_NEGOTIATING:      'quote',
  QUOTE_ACCEPTED:         'active',
  INSTALLATION_SCHEDULED: 'active',
  INSTALLATION_IN_PROGRESS: 'active',
  COMPLETED:              'done',
  CANCELLED:              'done',
};

const STATUS_LABEL = {
  PENDING:                  'Awaiting triage',
  NEW:                      'Awaiting triage',
  OFFERED_CRM:              'Awaiting CRM acceptance',
  CONFIRMED:                'Confirmed by CRM',
  SURVEY_SCHEDULED:         'Site survey scheduled',
  SITE_VISITED:             'Site survey done',
  SITE_VISIT_DONE:          'Site survey done',
  QUOTE_DRAFT:              'Quote being prepared',
  QUOTE_PENDING_APPROVAL:   'Quote awaiting approval',
  QUOTE_REJECTED_INTERNAL:  'Quote rework in progress',
  QUOTE_SENT:               'Estimate sent — review',
  QUOTE_NEGOTIATING:        'Negotiating quote',
  QUOTE_ACCEPTED:           'Quote accepted',
  INSTALLATION_SCHEDULED:   'Installation scheduled',
  INSTALLATION_IN_PROGRESS: 'Installation in progress',
  COMPLETED:                'Completed',
  CANCELLED:                'Cancelled',
};

const TABS = [
  { key: 'all',     label: 'All' },
  { key: 'pending', label: 'New' },
  { key: 'active',  label: 'In progress' },
  { key: 'quote',   label: 'Quote' },
  { key: 'done',    label: 'Completed' },
];

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CustomerInstallationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems]   = useState([]);
  const [loading, setLoad]  = useState(true);
  const [tab, setTab]       = useState('all');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/installations'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;
    let cancelled = false;
    installationsApi.list()
      .then((r) => {
        if (cancelled) return;
        const arr = Array.isArray(r) ? r : r?.content || [];
        setItems(arr);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoad(false));
    return () => { cancelled = true; };
  }, [user]);

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, active: 0, quote: 0, done: 0 };
    items.forEach((i) => { const g = STATUS_GROUP[i.status] || 'pending'; c[g] = (c[g] || 0) + 1; });
    return c;
  }, [items]);

  const visible = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter((i) => (STATUS_GROUP[i.status] || 'pending') === tab);
  }, [items, tab]);

  if (authLoading || !user || loading) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  return (
    <div className={styles.shell}>
      <AppTopBar title="My Projects" />
      <main className={styles.body}>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.key}
                    className={`${styles.tab} ${tab === t.key ? styles.tabOn : ''}`}
                    onClick={() => setTab(t.key)}>
              {t.label}
              <span className={styles.tabCount}>{counts[t.key] || 0}</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className={styles.empty}>
            <Snowflake size={36} />
            <h3>No projects yet</h3>
            <p>Request a new AC installation and we'll take care of survey, quote and fitting.</p>
            <Link href="/services/installation" className="btn btn-primary">
              Start a new installation <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <motion.div className={styles.list}
                      initial="hidden" animate="show"
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}>
            {visible.map((req) => (
              <motion.div key={req.id}
                          variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}>
                <InstallCard req={req} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

function InstallCard({ req }) {
  const group = STATUS_GROUP[req.status] || 'pending';
  const label = STATUS_LABEL[req.status] || req.status;
  const Icon = group === 'done' ? CheckCircle2 : group === 'quote' ? FileText : group === 'active' ? Building2 : Clock;
  const rooms = (() => {
    try { const r = JSON.parse(req.roomsJson || '[]'); return Array.isArray(r) ? r.length : 0; }
    catch { return 0; }
  })();

  return (
    <Link href={`/installations/${req.requestNumber}`} className={`${styles.card} ${styles[`card_${group}`]}`}>
      <span className={styles.cardAccent} />
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.numberPill}>{req.requestNumber}</span>
          <span className={`${styles.statusPill} ${styles[`pill_${group}`]}`}>
            <Icon size={12} /> {label}
          </span>
        </div>
        <h3 className={styles.cardTitle}>
          {(req.acType || '').replace('_', '/')} Installation
          {req.tonnage && <> · {req.tonnage} ton</>}
        </h3>
        <div className={styles.cardMeta}>
          {req.brand && <span><Snowflake size={12} /> {req.brand} {req.modelNumber || ''}</span>}
          {req.propertyLabel && <span><MapPin size={12} /> {req.propertyLabel}</span>}
          {rooms > 0 && <span>{rooms} room{rooms > 1 ? 's' : ''}</span>}
          {req.scheduledDate && <span><Calendar size={12} /> {fmtDate(req.scheduledDate)}</span>}
        </div>
      </div>
      <ChevronRight size={20} className={styles.chevron} />
    </Link>
  );
}
