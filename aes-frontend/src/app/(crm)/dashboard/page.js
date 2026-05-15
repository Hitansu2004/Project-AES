'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tickets, ticketActions } from '@/lib/api';
import styles from './dashboard.module.css';

export default function CRMDashboard() {
  const router = useRouter();
  const [ticketList, setTicketList] = useState([]);
  const [filter, setFilter] = useState('All');
  const [sortField, setSortField] = useState('SLA Critical');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTickets = async () => {
    try {
      const data = await tickets.list();
      setTicketList(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (ticketNum) => {
    try {
      await ticketActions.acknowledge(ticketNum);
      fetchTickets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolve = async (ticketNum) => {
    try {
      await ticketActions.resolve(ticketNum, { notes: 'Resolved by CRM Level 1' });
      fetchTickets();
    } catch (e) {
      console.error(e);
    }
  };

  // Calculations
  const getSlaInfo = (ticket) => {
    if (ticket.status === 'ACKNOWLEDGED') return { type: 'ACKNOWLEDGED', text: 'Acknowledged' };
    if (!ticket.slaDeadlineL1) return { type: 'NORMAL', text: 'No SLA' };
    
    const diff = new Date(ticket.slaDeadlineL1) - currentTime;
    if (diff <= 0) return { type: 'BREACHED', text: 'BREACHED', minLeft: 0 };
    
    const mins = Math.floor(diff / 60000);
    if (mins < 15) return { type: 'CRITICAL', text: `${mins} min — RESPOND NOW`, minLeft: mins };
    if (mins < 30) return { type: 'URGENT', text: `${mins} min remaining`, minLeft: mins };
    return { type: 'NORMAL', text: `${mins} min remaining`, minLeft: mins };
  };

  // Filter & Sort
  const filtered = ticketList.filter(t => {
    if (t.status === 'RESOLVED' || t.status === 'CLOSED') return false;
    // Allow currentLevel === 1, OR recently escalated to L2 (to show the grayed out state)
    if (t.currentLevel > 2) return false;

    if (filter === 'All') return true;
    if (filter === 'P1 AMC') return t.priority === 'P1';
    if (filter === 'P2 Warranty') return t.priority === 'P2';
    if (filter === 'P3 Paid') return t.priority === 'P3';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === 'Newest First') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortField === 'Oldest First') return new Date(a.createdAt) - new Date(b.createdAt);
    
    // SLA Critical
    const aSla = new Date(a.slaDeadlineL1 || a.createdAt);
    const bSla = new Date(b.slaDeadlineL1 || b.createdAt);
    return aSla - bSla;
  });

  // Breach Alert
  const breachAlertTicket = sorted.find(t => {
    if (t.status === 'ACKNOWLEDGED') return false;
    const sla = getSlaInfo(t);
    return sla.type === 'CRITICAL' && sla.minLeft <= 5;
  });

  const timeAgo = (dateStr) => {
    const diff = (currentTime - new Date(dateStr)) / 60000;
    if (diff < 60) return `${Math.floor(diff)} min ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  const getBorderClass = (ticket) => {
    if (ticket.status === 'ACKNOWLEDGED') return styles.borderAck;
    const sla = getSlaInfo(ticket);
    if (sla.type === 'CRITICAL' || sla.type === 'BREACHED') return styles.borderCritical;
    if (sla.type === 'URGENT') return styles.borderUrgent;
    return styles.borderNormal;
  };

  return (
    <div className={styles.layout}>
      {/* HEADER BAR */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.brandIcon}>⚙️</span>
          <span className={styles.brandName}>Arial Engineering</span>
          <span className={styles.headerTitle}>CRM Dashboard — Level 1</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.agentName}>Agent: J. Smith</span>
          <div className={styles.headerIcon}>
            🔔
            <span className={styles.notificationBadge}>4</span>
          </div>
          <div className={styles.headerIcon} onClick={() => router.push('/login')}>
            🚪
          </div>
        </div>
      </header>

      <div className={styles.mainContainer}>
        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <div className={`${styles.navItem} ${styles.navItemActive}`}>
              <div className={styles.navItemLeft}>
                <span>📥</span>
                <span className={styles.navItemLabel}>My Inbox</span>
              </div>
              <span className={styles.navBadgeSecondary}>{sorted.length}</span>
            </div>
            <div className={styles.navItem}>
              <div className={styles.navItemLeft}>
                <span>📋</span>
                <span className={styles.navItemLabel}>All Tickets</span>
              </div>
            </div>
            <div className={styles.navItem}>
              <div className={styles.navItemLeft}>
                <span>⚠️</span>
                <span className={styles.navItemLabel}>Escalated</span>
              </div>
              <span className={styles.navBadgeError}>1</span>
            </div>
            <div className={styles.navItem}>
              <div className={styles.navItemLeft}>
                <span>✅</span>
                <span className={styles.navItemLabel}>Resolved Today</span>
              </div>
            </div>
          </nav>
          <div className={styles.sidebarFooter}>
            <div className={styles.navItem}>
              <div className={styles.navItemLeft}>
                <span>⚙️</span>
                <span className={styles.navItemLabel}>Settings</span>
              </div>
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <main className={styles.content}>
          {/* SLA BREACH ALERT */}
          {breachAlertTicket && (
            <div className={styles.slaAlertBanner}>
              <span className={styles.slaAlertText}>⚠ {breachAlertTicket.ticketNumber} — {getSlaInfo(breachAlertTicket).minLeft} min to SLA breach! Respond immediately.</span>
            </div>
          )}

          <div className={styles.dashboardInner}>
            {/* FILTER ROW */}
            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Filter:</span>
                {['All', 'P1 AMC', 'P2 Warranty', 'P3 Paid'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`${styles.filterChip} ${filter === f ? styles.filterChipActive : ''}`}
                  >
                    {f !== 'All' && <span className={styles.chipDot} style={{backgroundColor: f.includes('P1') ? '#7B2FBE' : f.includes('P2') ? '#0099CC' : '#E63946'}} />}
                    {f}
                  </button>
                ))}
              </div>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Sort:</span>
                <select className={styles.sortSelect} value={sortField} onChange={(e) => setSortField(e.target.value)}>
                  <option>SLA Critical</option>
                  <option>Newest First</option>
                  <option>Oldest First</option>
                </select>
              </div>
            </div>

            {/* TICKETS LIST */}
            {loading ? (
              <div style={{padding:'40px', textAlign:'center'}}>Loading tickets...</div>
            ) : sorted.length === 0 ? (
              <div style={{padding:'40px', textAlign:'center', color:'var(--on-surface-variant)'}}>No active tickets in inbox.</div>
            ) : (
              <div className={styles.ticketList}>
                {sorted.map(ticket => {
                  const sla = getSlaInfo(ticket);
                  const isEscalated = ticket.currentLevel > 1 || ticket.status === 'ESCALATED';
                  
                  return (
                    <div key={ticket.ticketNumber} className={`${styles.ticketCard} ${getBorderClass(ticket)} ${isEscalated ? styles.cardEscalated : ''}`}>
                      <div className={styles.cardHeader}>
                        <div className={styles.cardHeaderLeft}>
                          <span className={`${styles.priorityBadge} ${ticket.priority === 'P1' ? styles.priorityP1 : ticket.priority === 'P2' ? styles.priorityP2 : styles.priorityP3}`}>
                            {ticket.priority} {ticket.serviceType || ''}
                          </span>
                          <span className={styles.ticketNum}>{ticket.ticketNumber}</span>
                          <span className={styles.timeAgo}>• {timeAgo(ticket.createdAt)}</span>
                        </div>
                        <div className={`${styles.slaTimer} ${isEscalated ? styles.slaNormal : sla.type === 'ACKNOWLEDGED' ? styles.slaAck : sla.type === 'CRITICAL' || sla.type === 'BREACHED' ? styles.slaCritical : sla.type === 'URGENT' ? styles.slaUrgent : styles.slaNormal}`}>
                          {isEscalated ? 'Escalated to L2' : sla.type === 'ACKNOWLEDGED' ? `✓ ${sla.text}` : `⏱ ${sla.text}`}
                        </div>
                      </div>

                      <div className={styles.cardBody}>
                        <h3 className={styles.problemTitle}>{ticket.problemCategory?.replace(/_/g, ' ')} — {ticket.acUnitRoom || 'N/A'}</h3>
                        <div className={styles.customerInfo}>
                          <span>👤 {ticket.customerName || 'Customer'}</span>
                          <span>•</span>
                          <span>📍 {ticket.propertyLabel || 'Property Address'}</span>
                        </div>
                      </div>

                      <div className={styles.cardFooter}>
                        {isEscalated ? (
                          <div style={{color: 'var(--on-surface-variant)', fontWeight: 'bold'}}>Ticket has been escalated to Service Managers.</div>
                        ) : (
                          <>
                            <div className={styles.actionGroup}>
                              <button className={`${styles.btn} ${styles.btnSecondary}`}>
                                📞 Call Customer
                              </button>
                              
                              {ticket.status !== 'ACKNOWLEDGED' ? (
                                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => handleAcknowledge(ticket.ticketNumber)}>
                                  ✓ Mark Acknowledged
                                </button>
                              ) : (
                                <>
                                  <button className={`${styles.btn} ${styles.btnPrimary}`}>
                                    👷 Assign Engineer
                                  </button>
                                  <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={() => handleResolve(ticket.ticketNumber)}>
                                    ✅ Resolve
                                  </button>
                                </>
                              )}
                            </div>
                            <button className={styles.escalateLink}>
                              Escalate to L2 ⬆
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
