'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { dashboard as dashboardApi, amc as amcApi, tickets as ticketsApi } from '@/lib/api';
import styles from './dashboard.module.css';

export default function CustomerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'CUSTOMER') {
      if (user.role === 'CRM_AGENT') router.replace('/crm');
      else router.replace('/admin');
      return;
    }

    async function load() {
      try {
        const [dashData, amcData, ticketData] = await Promise.allSettled([
          dashboardApi.customer(),
          amcApi.myContracts(),
          ticketsApi.list(),
        ]);
        if (dashData.status === 'fulfilled') setData(dashData.value);
        if (amcData.status === 'fulfilled') setContracts(Array.isArray(amcData.value) ? amcData.value : []);
        if (ticketData.status === 'fulfilled') setRecentTickets(Array.isArray(ticketData.value) ? ticketData.value.slice(0, 3) : []);
      } catch { /* handled by individual catches */ }
      setLoading(false);
    }
    load();
  }, [user, authLoading, router]);

  if (!mounted || authLoading || loading) {
    return <div className="loading-page"><div className="spinner"></div></div>;
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const activeContract = contracts.find(c => c.status === 'ACTIVE');

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className="container page-content">
        {/* Mobile Header */}
        <header className={styles.mobileHeader}>
          <div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            <span className={styles.mobileTitle}>Arial Engineering</span>
          </div>
          <div className={styles.mobileRight}>
            <div className={styles.avatar}>{(user?.name || 'U')[0]}</div>
          </div>
        </header>

        {/* Welcome Card */}
        <section className={styles.greeting}>
          <h2 className={styles.greetingTitle}>{greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋</h2>
          <p className={styles.greetingSubtext}>
            {data?.activeProjects || 0} active project{data?.activeProjects !== 1 ? 's' : ''} · {data?.openTickets || 0} open ticket{data?.openTickets !== 1 ? 's' : ''}
          </p>
          <div className={styles.greetingBadges}>
            <span className={styles.greetingBadge}>🏗 {data?.activeProjects || 0} Project{(data?.activeProjects !== 1) ? 's' : ''}</span>
            <span className={styles.greetingBadge}>🎫 {data?.openTickets || 0} Ticket{(data?.openTickets !== 1) ? 's' : ''}</span>
            {activeContract && <span className={styles.greetingBadge}>📋 AMC Active</span>}
          </div>
        </section>

        {/* Quick Action Cards */}
        <section className={styles.actionCards}>
          {/* Card 1: New AC Installation */}
          <Link href="/services/installation" className={`${styles.actionCard} ${styles.installCard}`}>
            <div className={styles.bgIcon}>❄️</div>
            <div className={styles.actionContent}>
              <div className={styles.actionIcon}>❄️</div>
              <h3 className={styles.actionTitle}>New AC Installation</h3>
              <p className={styles.actionDesc}>Get a quote for Split, Central, VRF/VRV</p>
              <div className={styles.actionTags}>
                <span>Split AC</span><span>Central AC</span><span>VRF/VRV</span>
              </div>
            </div>
            <span className={`${styles.actionBtn} ${styles.installBtn}`}>Request Now →</span>
          </Link>

          {/* Card 2: Service Request */}
          <Link href="/services/ticket" className={`${styles.actionCard} ${styles.serviceCard}`}>
            <div className={styles.bgIcon}>🔧</div>
            <div className={styles.actionContent}>
              <div className={styles.actionIcon}>🔧</div>
              <h3 className={styles.actionTitle}>Service Request</h3>
              <p className={styles.actionDesc}>AMC · Warranty · Paid Service</p>
              <div className={styles.actionTags}>
                <span>Not Cooling</span><span>Noise</span><span>Leaking</span><span>Other</span>
              </div>
            </div>
            <span className={`${styles.actionBtn} ${styles.serviceBtn}`}>Book Service →</span>
          </Link>
        </section>

        {/* Active Projects (Placeholder for UI design) */}
        {data?.activeProjects > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>My Projects</h3>
              <Link href="/account" className={styles.viewAll}>View All</Link>
            </div>
            <Link href="/account" className={`${styles.ticketCard} ${styles.projectCard}`}>
              <div>
                <div className={styles.ticketTop}>
                  <h4 className={styles.ticketTitle}>Ongoing AC Installation</h4>
                </div>
                <p className={styles.ticketDesc}>📍 Check address in profile</p>
                <div className={styles.ticketTags}>
                  <span className={`${styles.ticketTag} ${styles.tagStatus}`}>In Progress</span>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Bottom Grid: Tickets & AMC */}
        <section className={styles.bottomGrid}>
          {/* My Tickets */}
          <div className={styles.gridCol}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>My Tickets</h3>
              <Link href="/tickets" className={styles.viewAll}>View All</Link>
            </div>
            {recentTickets.length > 0 ? (
              <Link href={`/tickets/${recentTickets[0].ticketNumber}`} className={styles.ticketCard}>
                <div>
                  <div className={styles.ticketTop}>
                    <h4 className={styles.ticketTitle}>{recentTickets[0].problemCategory?.replace(/_/g, ' ')}</h4>
                    <span className="text-outline">→</span>
                  </div>
                  <p className={styles.ticketDesc}>{recentTickets[0].acUnitRoom || 'N/A'}</p>
                  <div className={styles.ticketTags}>
                    <span className={`${styles.ticketTag} ${styles.tagPriority}`}>{recentTickets[0].priority} — {recentTickets[0].serviceType?.replace(/_/g, ' ')}</span>
                    <span className={`${styles.ticketTag} ${styles.tagStatus}`}>Status: {recentTickets[0].status?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className={styles.ticketFooter}>
                  <span>⏱</span> SLA Deadline: {new Date(recentTickets[0].createdAt).toLocaleDateString()}
                </div>
              </Link>
            ) : (
               <div className={styles.ticketCard} style={{justifyContent: 'center', alignItems: 'center', color: 'var(--outline)'}}>
                 No open tickets
               </div>
            )}
          </div>

          {/* AMC Mini Card */}
          {activeContract && (
            <div className={styles.gridCol}>
              <div className={`${styles.sectionHeader} hidden-mobile`}>
                <h3 className={styles.sectionTitle} style={{opacity: 0}}>Spacer</h3>
              </div>
              <Link href="/services/amc" className={styles.amcCard}>
                <div className={styles.amcBgIcon}>🛡️</div>
                <div className={styles.amcIconWrapper}>
                  <span>📅</span>
                </div>
                <div className={styles.amcInfo}>
                  <h4>Your AMC is Active</h4>
                  <p>Next visit: {activeContract.nextVisitDate || 'TBD'}</p>
                  <span>Visits left: {(activeContract.visitsPerYear || 4) - (activeContract.visitsCompleted || 0)}</span>
                  <div className={styles.amcLink}>View AMC →</div>
                </div>
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
