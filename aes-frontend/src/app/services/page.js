'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import styles from './services.module.css';

export default function ServicesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className="container page-content">
        <div className={styles.header}>
          <h1 className="headline-lg">How can we help you?</h1>
          <p className={styles.subtitle}>Select the type of service you need</p>
        </div>

        <div className={styles.cards}>
          <Link href="/services/installation" className={`${styles.card} ${styles.installCard}`}>
            <div className={styles.cardBadge}>P — NEW</div>
            <div className={styles.cardIcon}>🔧</div>
            <h2 className={styles.cardTitle}>New AC Installation</h2>
            <p className={styles.cardDesc}>Install Split, Central, VRF/VRV, or Cassette AC...</p>
            <div className={styles.cardTags}>
              <span>Split AC</span><span>Central AC</span><span>VRF/VRV</span>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link>

          <Link href="/services/ticket" className={`${styles.card} ${styles.serviceCard}`}>
            <div className={styles.cardIcon}>🔧</div>
            <h2 className={styles.cardTitle}>Service / Repair Request</h2>
            <p className={styles.cardDesc}>Your existing AC needs attention...</p>
            <div className={styles.cardTags}>
              <span>Not Cooling</span><span>Noise</span><span>Water Leak</span>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link>

          <Link href="/services/amc" className={`${styles.card} ${styles.amcCard}`}>
            <div className={styles.cardIcon}>📅</div>
            <h2 className={styles.cardTitle}>Schedule AMC Visit</h2>
            <p className={styles.cardDesc}>Book your routine AMC service...</p>
            <div className={styles.cardTags}>
              <span>AMC Active — 4 visits/year</span>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link>
        </div>

        <p className={styles.help}>
          Not sure? Call us: <a href="tel:+914023540000" className={styles.helpLink}>+91 40-2354-XXXX</a>
        </p>
      </div>
    </div>
  );
}
