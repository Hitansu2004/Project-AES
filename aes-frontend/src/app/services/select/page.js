'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './select.module.css';

export default function SelectRequestTypePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!user) { router.replace('/login'); return null; }

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className={styles.pageTitle}>What do you need?</h1>
        <button className={styles.backBtn} style={{ opacity: 0, pointerEvents: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.headerSection}>
          <h1 className={styles.title}>How can we help you?</h1>
          <p className={styles.subtitle}>Select the type of service you need</p>
        </div>

        <div className={styles.cardContainer}>
          {/* Card 1 */}
          <button className={`${styles.card} ${styles.cardPrimary}`} onClick={() => router.push('/services/installation')}>
            <div className={styles.badge}>P — NEW</div>
            <div className={styles.cardInner}>
              <div className={styles.iconBox}><span style={{fontSize:'32px'}}>🏗️</span></div>
              <div className={styles.cardText}>
                <h2>New AC Installation</h2>
                <p>Install Split, Central, VRF/VRV, or Cassette AC...</p>
                <div className={styles.chipRow}>
                  <span className={styles.chip}>Split AC</span>
                  <span className={styles.chip}>Central AC</span>
                  <span className={styles.chip}>VRF/VRV</span>
                </div>
              </div>
              <div className={styles.arrowBox}>→</div>
            </div>
          </button>

          {/* Card 2 */}
          <button className={`${styles.card} ${styles.cardSecondary}`} onClick={() => router.push('/services/ticket')}>
            <div className={styles.cardInner}>
              <div className={styles.iconBox}><span style={{fontSize:'32px'}}>🔧</span></div>
              <div className={styles.cardText}>
                <h2>Service / Repair Request</h2>
                <p>Your existing AC needs attention...</p>
                <div className={styles.chipRow}>
                  <span className={styles.chip}>Not Cooling</span>
                  <span className={styles.chip}>Noise</span>
                  <span className={styles.chip}>Water Leak</span>
                </div>
              </div>
              <div className={styles.arrowBox}>→</div>
            </div>
          </button>

          {/* Card 3 */}
          <button className={`${styles.card} ${styles.cardTertiary}`} onClick={() => alert('AMC Scheduling is coming in a future update.')}>
            <div className={styles.cardInner}>
              <div className={styles.iconBox}><span style={{fontSize:'32px'}}>📅</span></div>
              <div className={styles.cardText}>
                <h2>Schedule AMC Visit</h2>
                <p>Book your routine AMC service...</p>
                <div className={styles.chipRow}>
                  <span className={`${styles.chip} ${styles.chipBold}`}>AMC Active — 4 visits/year</span>
                </div>
              </div>
              <div className={styles.arrowBox}>→</div>
            </div>
          </button>
        </div>

        <div className={styles.footerContact}>
          <p>Not sure? Call us: <a href="tel:+914023540000" className={styles.phoneLink}>+91 40-2354-XXXX</a></p>
        </div>
      </div>
    </div>
  );
}
