'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { tickets, ticketActions, dashboard as dashboardApi } from '@/lib/api';
import styles from './crm.module.css';

const FILTER_TYPES = ['All', 'P1 AMC', 'P2 Warranty', 'P3 Paid'];

export default function CrmDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [ticketList, setTicketList] = useState([]);
  const [filter, setFilter] = useState('All');
  const [sortBy, setSortBy] = useState('sla');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'CRM_AGENT' && user.role !== 'ADMIN' && user.role !== 'SERVICE_MANAGER') {
      router.replace('/dashboard');
      return;
    }
    loadTickets();
  }, [user, authLoading, router]);

  async function loadTickets() {
    try {
      const data = await tickets.list();
      setTicketList(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  const handleAcknowledge = async (ticketNumber) => {
    setActionLoading(ticketNumber);
    try {
      await ticketActions.acknowledge(ticketNumber);
      await loadTickets();
    } catch { /* ignore */ }
    setActionLoading('');
  };

  const handleEscalate = async (ticketNumber) => {
    setActionLoading(ticketNumber);
    try {
      await ticketActions.escalate(ticketNumber, { reason: 'Manual escalation by CRM agent' });
      await loadTickets();
    } catch { /* ignore */ }
    setActionLoading('');
  };

  const handleResolve = async (ticketNumber) => {
    setActionLoading(ticketNumber);
    try {
      await ticketActions.resolve(ticketNumber, { resolutionNotes: 'Resolved by CRM agent' });
      await loadTickets();
    } catch { /* ignore */ }
    setActionLoading('');
  };

  const filtered = ticketList.filter(t => {
    if (filter === 'All') return true;
    if (filter === 'P1 AMC') return t.priority === 'P1';
    if (filter === 'P2 Warranty') return t.priority === 'P2';
    if (filter === 'P3 Paid') return t.priority === 'P3';
    return true;
  });

  const activeTickets = filtered.filter(t => !['RESOLVED', 'CLOSED'].includes(t.status));
  const slaUrgent = activeTickets.find(t => t.slaDeadlineL1 && (new Date(t.slaDeadlineL1) - new Date()) < 15 * 60000);

  if (authLoading || loading) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <div className={`page-enter ${styles.page}`}>
      {/* SLA Alert Banner */}
      {slaUrgent && (
        <div className={styles.alertBanner}>
          ⚠️ {slaUrgent.ticketNumber} — {getSlaRemaining(slaUrgent.slaDeadlineL1)} to SLA breach! Respond immediately.
        </div>
      )}

      <div className={`container ${styles.container}`}>
        <div className={styles.header}>
          <h1 className="headline-lg">CRM Inbox</h1>
          <span className={styles.ticketCount}>{activeTickets.length} active ticket{activeTickets.length !== 1 ? 's' : ''}</span>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.filters}>
            <span className={styles.filterLabel}>FILTER:</span>
            {FILTER_TYPES.map(f => (
              <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`} onClick={() => setFilter(f)}>
                {f !== 'All' && <span className={styles.filterDot} style={{ background: f === 'P1 AMC' ? '#7B2FBE' : f === 'P2 Warranty' ? '#0099CC' : '#E63946' }}></span>}
                {f}
              </button>
            ))}
          </div>
          <div className={styles.sortGroup}>
            <span className={styles.sortLabel}>SORT:</span>
            <select className={styles.sortSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="sla">SLA Critical</option>
              <option value="date">Newest First</option>
            </select>
          </div>
        </div>

        {activeTickets.length === 0 ? (
          <div className={styles.empty}>
            <span>📭</span>
            <h3>No active tickets</h3>
            <p>All tickets have been resolved.</p>
          </div>
        ) : (
          <div className={styles.ticketList}>
            {activeTickets.map(ticket => {
              const isAcknowledged = ticket.status === 'ACKNOWLEDGED' || ticket.status === 'IN_PROGRESS';
              const slaMin = getSlaRemaining(ticket.slaDeadlineL1);
              const isUrgent = ticket.slaDeadlineL1 && (new Date(ticket.slaDeadlineL1) - new Date()) < 15 * 60000;
              return (
                <div key={ticket.ticketNumber} className={`${styles.ticketCard} ${isUrgent ? styles.ticketUrgent : ''}`}>
                  <div className={styles.ticketBorder} style={{ background: getPriorityColor(ticket.priority) }}></div>
                  <div className={styles.ticketContent}>
                    <div className={styles.ticketTop}>
                      <div className={styles.ticketTopLeft}>
                        <span className={`badge ${getPriorityBadge(ticket.priority)}`}>{ticket.priority} {ticket.serviceType?.toUpperCase()}</span>
                        <span className={styles.ticketNum}>{ticket.ticketNumber}</span>
                        <span className={styles.ticketTime}>• {getTimeAgo(ticket.createdAt)}</span>
                      </div>
                      <div className={styles.slaInfo}>
                        {isAcknowledged ? (
                          <span className={styles.acknowledged}>✓ Acknowledged</span>
                        ) : (
                          <span className={`${styles.slaTimer} ${isUrgent ? styles.slaUrgent : ''}`}>
                            ⏱ {slaMin} {isUrgent ? '— RESPOND NOW' : 'remaining'}
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className={styles.ticketTitle}>{ticket.problemCategory?.replace(/_/g, ' ')} — {ticket.acUnitRoom || 'N/A'}</h3>
                    <p className={styles.ticketMeta}>
                      👤 {ticket.customerName || 'Customer'} • 📍 {ticket.propertyLabel || 'Property'}
                    </p>
                    <div className={styles.ticketActions}>
                      <a href={`tel:+914023540000`} className={`btn btn-primary btn-sm`}>📞 Call Customer</a>
                      {!isAcknowledged && (
                        <button className={`btn btn-outline btn-sm`}
                          disabled={actionLoading === ticket.ticketNumber}
                          onClick={() => handleAcknowledge(ticket.ticketNumber)}>
                          ✓ Mark Acknowledged
                        </button>
                      )}
                      {isAcknowledged && (
                        <>
                          <button className={`btn btn-secondary btn-sm`}
                            disabled={actionLoading === ticket.ticketNumber}
                            onClick={() => handleResolve(ticket.ticketNumber)}>
                            ✓ Resolve
                          </button>
                        </>
                      )}
                      <button className={styles.escalateBtn} onClick={() => handleEscalate(ticket.ticketNumber)}
                        disabled={actionLoading === ticket.ticketNumber}>
                        Escalate to L2 ↑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getPriorityColor(p) {
  if (p === 'P1') return '#7B2FBE';
  if (p === 'P2') return '#0099CC';
  return '#E63946';
}

function getPriorityBadge(p) {
  if (p === 'P1') return 'badge-p1';
  if (p === 'P2') return 'badge-p2';
  return 'badge-p3';
}

function getSlaRemaining(deadline) {
  if (!deadline) return 'N/A';
  const diff = new Date(deadline) - new Date();
  if (diff <= 0) return 'BREACHED';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function getTimeAgo(date) {
  if (!date) return '';
  const mins = Math.floor((Date.now() - new Date(date)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
