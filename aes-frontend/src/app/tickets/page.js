'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { tickets } from '@/lib/api';
import styles from './tickets.module.css';

const FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Escalated'];

export default function TicketsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [ticketList, setTicketList] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    async function load() {
      try {
        const data = await tickets.list();
        setTicketList(Array.isArray(data) ? data : []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [user, authLoading, router]);

  const filtered = ticketList.filter(t => {
    if (filter === 'All') return true;
    if (filter === 'Open') return t.status === 'OPEN' || t.status === 'ASSIGNED';
    if (filter === 'In Progress') return t.status === 'IN_PROGRESS' || t.status === 'ACKNOWLEDGED';
    if (filter === 'Resolved') return t.status === 'RESOLVED' || t.status === 'CLOSED';
    if (filter === 'Escalated') return t.status === 'ESCALATED';
    return true;
  });

  if (authLoading || loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className={styles.topBar}>
        <div className={styles.logoGroup}>
          <div className={styles.logo}></div>
          <span className={styles.brand}>Arial Engineering</span>
        </div>
        <h1 className={styles.pageTitle}>My Tickets</h1>
        <div className={styles.bellBtn}>
          <span className={styles.notificationDot}></span>
          🔔
        </div>
      </div>
      <div className="container page-content">

        <div className={styles.filters}>
          {FILTERS.map(f => (
            <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🎫</span>
            <h3>No tickets found</h3>
            <p>You haven&apos;t raised any service tickets yet.</p>
            <Link href="/services/ticket" className="btn btn-primary">Raise a Ticket</Link>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(ticket => (
              <Link key={ticket.ticketNumber} href={`/tickets/${ticket.ticketNumber}`} className={styles.card}>
                <div className={styles.cardBorder} style={{ background: getBorderColor(ticket.status) }}></div>
                <div className={styles.cardContent}>
                  <div className={styles.cardTop}>
                    <span className={styles.ticketId}>{ticket.ticketNumber}</span>
                    <div className={styles.badges}>
                      <span className={`badge ${ticket.priority === 'P1' ? 'badge-amc' : ticket.priority === 'P2' ? 'badge-warranty' : 'badge-paid'}`}>{ticket.priority}</span>
                      {ticket.status === 'ESCALATED' && <span className="badge" style={{background:'#fff3cd', color:'#856404'}}>ESCALATED</span>}
                      {(ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && <span className="badge" style={{background:'#d4edda', color:'#155724'}}>RESOLVED</span>}
                      {ticket.status === 'OPEN' && <span className="badge" style={{background:'#cce5ff', color:'#004085'}}>OPEN</span>}
                    </div>
                  </div>
                  <h3 className={styles.ticketTitle}>{ticket.problemCategory?.replace(/_/g, ' ')} — {ticket.acUnitRoom || 'N/A'}</h3>
                  <div className={styles.ticketMeta}>
                    {ticket.currentLevel && <span className={styles.metaLabel}>● Level {ticket.currentLevel} — {ticket.currentLevel === 1 ? 'CRM Team' : 'Service Managers'}</span>}
                    <span className={styles.metaDate}>{new Date(ticket.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  {ticket.slaDeadlineFinal && new Date(ticket.slaDeadlineFinal) > new Date() && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                    <div className={styles.slaTimer}>
                      ⏱ {getSlaRemaining(ticket.slaDeadlineFinal)} SLA remaining
                    </div>
                  )}
                  {(ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && (
                    <div style={{marginTop: '12px', fontSize: '13px', color: '#f59e0b', fontWeight: '600'}}>
                      ⭐ Rate your experience
                    </div>
                  )}
                </div>
                <span className={styles.cardArrow}>›</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getBorderColor(status) {
  if (status === 'ESCALATED') return '#f59e0b';
  if (status === 'RESOLVED' || status === 'CLOSED') return '#16a34a';
  return '#0099CC';
}

function getPriorityBadge(p) {
  if (p === 'P1') return 'badge-p1';
  if (p === 'P2') return 'badge-p2';
  return 'badge-p3';
}

function getSlaRemaining(deadline) {
  const diff = new Date(deadline) - new Date();
  if (diff <= 0) return 'BREACHED';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}min`;
}
