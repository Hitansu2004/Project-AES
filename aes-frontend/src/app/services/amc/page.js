'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { amc } from '@/lib/api';
import styles from './amc.module.css';

export default function AmcPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    async function load() {
      try {
        const data = await amc.myContracts();
        setContracts(Array.isArray(data) ? data : []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [user, authLoading, router]);

  if (authLoading || loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className="container page-content">
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
          <h1 className={styles.pageTitle}>AMC Service</h1>
          <span></span>
        </div>

        {contracts.length === 0 ? (
          <div className={styles.empty}>
            <span>📋</span>
            <h3>No AMC Contracts</h3>
            <p>You don&apos;t have active AMC contracts. Contact us to get started.</p>
            <a href="tel:+914023540000" className="btn btn-primary">📞 Call Us</a>
          </div>
        ) : (
          <div className={styles.contractList}>
            {contracts.map(c => (
              <div key={c.id} className={styles.contractCard}>
                <div className={styles.contractHeader}>
                  <span className={`badge ${c.isActive ? 'badge-resolved' : 'badge-paid'}`}>{c.isActive ? 'ACTIVE' : 'EXPIRED'}</span>
                  <span>{c.contractNumber}</span>
                </div>
                <h3>Annual Maintenance Contract</h3>
                <p>Valid: {c.startDate} — {c.endDate}</p>
                <p>Visits: {c.visitsCompleted || 0}/{c.visitsPerYear || 4} completed</p>
                <button className="btn btn-primary btn-sm" onClick={() => router.push('/services/ticket')}>
                  Schedule AMC Visit →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
