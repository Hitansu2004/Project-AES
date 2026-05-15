'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { dashboard as dashboardApi, tickets, ticketActions } from '@/lib/api';
import styles from './admin.module.css';

export default function AdminEscalationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [escalationData, setEscalationData] = useState(null);
  const [ticketList, setTicketList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'SERVICE_MANAGER' && user.role !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
    loadData();
  }, [user, authLoading, router]);

  async function loadData() {
    try {
      const [esc, tix] = await Promise.allSettled([
        dashboardApi.escalation(),
        tickets.list(),
      ]);
      if (esc.status === 'fulfilled') setEscalationData(esc.value);
      if (tix.status === 'fulfilled') setTicketList(Array.isArray(tix.value) ? tix.value : []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  const handleEscalate = async (ticketNumber) => {
    try {
      await ticketActions.escalate(ticketNumber, { reason: 'Escalated by manager' });
      await loadData();
    } catch { /* ignore */ }
  };

  const handleResolve = async (ticketNumber) => {
    try {
      await ticketActions.resolve(ticketNumber, { resolutionNotes: 'Resolved by manager' });
      await loadData();
    } catch { /* ignore */ }
  };

  if (authLoading || loading) return <div className="loading-page"><div className="spinner"></div></div>;

  const activeTickets = ticketList.filter(t => !['RESOLVED', 'CLOSED'].includes(t.status));
  const l1Tickets = activeTickets.filter(t => t.currentLevel === 1 || !t.currentLevel);
  const l2Tickets = activeTickets.filter(t => t.currentLevel === 2);
  const l3Tickets = activeTickets.filter(t => t.currentLevel === 3);
  const resolvedToday = ticketList.filter(t => {
    if (t.status !== 'RESOLVED' && t.status !== 'CLOSED') return false;
    const today = new Date().toDateString();
    return t.resolvedAt && new Date(t.resolvedAt).toDateString() === today;
  });
  const breachedTickets = activeTickets.filter(t => t.isFinalBreached || (t.slaDeadlineFinal && new Date(t.slaDeadlineFinal) < new Date()));

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className={`container ${styles.container}`}>
        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Escalated Now</span>
            <span className={styles.statValue}>{l2Tickets.length + l3Tickets.length}</span>
            <span className={styles.statIcon}>⚠️</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Avg Response</span>
            <span className={styles.statValue}>{escalationData?.avgResponseMinutes ? `${Math.round(escalationData.avgResponseMinutes)}m` : '—'}</span>
            <span className={styles.statIcon}>⏱</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>SLA Breach Today</span>
            <span className={`${styles.statValue} ${styles.statDanger}`}>{breachedTickets.length}</span>
            <span className={styles.statIcon}>❗</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Resolved Today</span>
            <span className={`${styles.statValue} ${styles.statSuccess}`}>{resolvedToday.length}</span>
            <span className={styles.statIcon}>✅</span>
          </div>
        </div>

        {/* 3-Column Board */}
        <div className={styles.board}>
          <div className={styles.column}>
            <div className={`${styles.colHeader} ${styles.colL1}`}>
              <h3>CRM Team — Level 1</h3>
              <p>{l1Tickets.length} active</p>
            </div>
            <div className={styles.colBody}>
              {l1Tickets.map(t => (
                <div key={t.ticketNumber} className={styles.boardCard}>
                  <div className={styles.boardCardTop}>
                    <span>{t.ticketNumber}</span>
                    <span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span>
                  </div>
                  <h4>{t.problemCategory?.replace(/_/g, ' ')}</h4>
                  <span className={styles.boardTime}>⏱ {getTimeOpen(t.createdAt)}</span>
                </div>
              ))}
              {l1Tickets.length === 0 && <p className={styles.colEmpty}>No tickets at L1</p>}
            </div>
          </div>

          <div className={styles.column}>
            <div className={`${styles.colHeader} ${styles.colL2}`}>
              <h3>Service Managers — Level 2</h3>
              <p>{l2Tickets.length} active{breachedTickets.length > 0 ? ` | ${breachedTickets.length} SLA breach` : ''}</p>
            </div>
            <div className={styles.colBody}>
              {l2Tickets.map(t => {
                const breached = t.isFinalBreached || (t.slaDeadlineFinal && new Date(t.slaDeadlineFinal) < new Date());
                return (
                  <div key={t.ticketNumber} className={`${styles.boardCard} ${breached ? styles.boardCardBreach : ''}`}>
                    <div className={styles.boardCardTop}>
                      <span>{t.ticketNumber}</span>
                      <span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span>
                    </div>
                    <h4>{t.problemCategory?.replace(/_/g, ' ')}</h4>
                    {breached && <span className={styles.breachLabel}>⚠️ BREACHED {getTimeAgo(t.slaDeadlineFinal)}</span>}
                    <div className={styles.boardActions}>
                      <button className={styles.escalateBtn} onClick={() => handleEscalate(t.ticketNumber)}>Escalate to L3 ↑</button>
                      <button className={styles.resolveBtn} onClick={() => handleResolve(t.ticketNumber)}>Resolve</button>
                    </div>
                    <span className={styles.boardTime}>⏱ {getTimeOpen(t.createdAt)}</span>
                  </div>
                );
              })}
              {l2Tickets.length === 0 && <p className={styles.colEmpty}>No tickets at L2</p>}
            </div>
          </div>

          <div className={styles.column}>
            <div className={`${styles.colHeader} ${styles.colL3}`}>
              <h3>Management — Level 3</h3>
              <p>{l3Tickets.length} active</p>
            </div>
            <div className={styles.colBody}>
              {l3Tickets.map(t => (
                <div key={t.ticketNumber} className={styles.boardCard}>
                  <div className={styles.boardCardTop}>
                    <span>{t.ticketNumber}</span>
                    <span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span>
                  </div>
                  <h4>{t.problemCategory?.replace(/_/g, ' ')}</h4>
                  <span className={styles.boardTime}>⏱ {getTimeOpen(t.createdAt)}</span>
                </div>
              ))}
              {l3Tickets.length === 0 && (
                <div className={styles.colEmptyLarge}>
                  <span>✔️</span>
                  <p>No tickets at management level</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Escalation Log */}
        <div className={styles.logSection}>
          <h3 className="headline-md">Escalation Log</h3>
          <div className={styles.logTable}>
            <div className={styles.logHeader}>
              <span>Time</span><span>Ticket</span><span>From</span><span>To</span><span>Reason</span>
            </div>
            {ticketList
              .filter(t => t.status === 'ESCALATED' || t.currentLevel > 1)
              .slice(0, 10)
              .map(t => (
                <div key={t.ticketNumber} className={styles.logRow}>
                  <span>{t.escalatedAt ? new Date(t.escalatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                  <span className={styles.logTicket}>{t.ticketNumber}</span>
                  <span>L{(t.currentLevel || 2) - 1}</span>
                  <span className={styles.logTo}>L{t.currentLevel || 2}</span>
                  <span>{t.escalationReason || 'Auto: SLA timeout'}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeOpen(date) {
  if (!date) return '';
  const mins = Math.floor((Date.now() - new Date(date)) / 60000);
  if (mins < 60) return `${mins} min open`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min open`;
}

function getTimeAgo(date) {
  if (!date) return '';
  const mins = Math.floor((Date.now() - new Date(date)) / 60000);
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
