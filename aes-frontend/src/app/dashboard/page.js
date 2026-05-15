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

  if (authLoading || loading) {
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
        <div className={styles.mobileHeader}>
          <div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            <span className={styles.mobileTitle}>Arial Engineering</span>
          </div>
          <div className={styles.mobileRight}>
            <div className={styles.avatar}>{(user?.name || 'U')[0]}</div>
          </div>
        </div>

        {/* Greeting Banner */}
        <div className={styles.greeting}>
          <h1 className={styles.greetingTitle}>{greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋</h1>
          <p className={styles.greetingSubtext}>
            {data?.activeProjects || 0} active project{data?.activeProjects !== 1 ? 's' : ''} · {data?.openTickets || 0} open ticket{data?.openTickets !== 1 ? 's' : ''}
          </p>
          <div className={styles.greetingBadges}>
            {data?.activeProjects > 0 && (
              <span className={styles.greetingBadge}>🏗️ {data.activeProjects} Project{data.activeProjects !== 1 ? 's' : ''}</span>
            )}
            {data?.openTickets > 0 && (
              <span className={styles.greetingBadge}>🎫 {data.openTickets} Ticket{data.openTickets !== 1 ? 's' : ''}</span>
            )}
            {activeContract && <span className={styles.greetingBadge}>📋 AMC Active</span>}
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className={styles.actionCards}>
          <Link href="/services/installation" className={`${styles.actionCard} ${styles.installCard}`}>
            <div className={styles.actionIcon}>❄️</div>
            <h2 className={styles.actionTitle}>New AC Installation</h2>
            <p className={styles.actionDesc}>Get a quote for Split, Central, VRF/VRV</p>
            <div className={styles.actionTags}>
              <span>Split AC</span><span>Central AC</span><span>VRF/VRV</span>
            </div>
            <span className={styles.actionBtn}>Request Now →</span>
          </Link>

          <Link href="/services/ticket" className={`${styles.actionCard} ${styles.serviceCard}`}>
            <div className={styles.actionIcon}>🔧</div>
            <h2 className={styles.actionTitle}>Service Request</h2>
            <p className={styles.actionDesc}>AMC · Warranty · Paid Service</p>
            <div className={styles.actionTags}>
              <span>Not Cooling</span><span>Noise</span><span>Leaking</span><span>Other</span>
            </div>
            <span className={styles.actionBtn}>Book Service →</span>
          </Link>
        </div>

        {/* My Tickets */}
        {recentTickets.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className="headline-sm">My Tickets</h2>
              <Link href="/tickets" className={styles.viewAll}>View All</Link>
            </div>
            <div className={styles.ticketList}>
              {recentTickets.map((ticket) => (
                <Link key={ticket.ticketNumber} href={`/tickets/${ticket.ticketNumber}`} className={styles.ticketCard}>
                  <div className={styles.ticketTop}>
                    <span className={styles.ticketId}>{ticket.ticketNumber}</span>
                    <span className={`badge ${getPriorityBadgeClass(ticket.priority)}`}>
                      {ticket.priority} {ticket.serviceType?.toUpperCase()}
                    </span>
                  </div>
                  <h3 className={styles.ticketTitle}>{ticket.problemCategory?.replace(/_/g, ' ')} — {ticket.acUnitRoom || 'N/A'}</h3>
                  <div className={styles.ticketMeta}>
                    <span className={`badge ${getStatusBadgeClass(ticket.status)}`}>{formatStatus(ticket.status)}</span>
                    <span className={styles.ticketDate}>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* AMC Banner */}
        {activeContract && (
          <Link href="/account" className={styles.amcBanner}>
            <div className={styles.amcIcon}>📋</div>
            <div className={styles.amcInfo}>
              <h3>Your AMC is Active</h3>
              <p>Next visit: {activeContract.nextVisitDate || 'TBD'}</p>
              <span className={styles.amcLink}>View AMC →</span>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

function getPriorityBadgeClass(priority) {
  if (priority === 'P1') return 'badge-p1';
  if (priority === 'P2') return 'badge-p2';
  return 'badge-p3';
}

function getStatusBadgeClass(status) {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'badge-resolved';
  if (status === 'ESCALATED') return 'badge-escalated';
  return 'badge-open';
}

function formatStatus(status) {
  return status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';
}
