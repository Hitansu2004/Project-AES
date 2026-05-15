'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { tickets, ticketActions } from '@/lib/api';
import styles from './detail.module.css';

export default function TicketDetailPage({ params }) {
  const resolvedParams = use(params);
  const ticketNumber = resolvedParams.ticketNumber;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [sla, setSla] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    async function load() {
      try {
        const [t, s] = await Promise.allSettled([
          tickets.get(ticketNumber),
          tickets.getSlaStatus(ticketNumber),
        ]);
        if (t.status === 'fulfilled') setTicket(t.value);
        if (s.status === 'fulfilled') setSla(s.value);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [user, authLoading, router, ticketNumber]);

  const handleRate = async () => {
    try {
      await ticketActions.rate(ticketNumber, { rating, feedback: '' });
      setRatingSubmitted(true);
    } catch { /* ignore */ }
  };

  if (authLoading || loading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!ticket) return <div className="loading-page"><p>Ticket not found</p></div>;

  const isActive = !['RESOLVED', 'CLOSED'].includes(ticket.status);
  const isEscalated = ticket.status === 'ESCALATED';

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className="container page-content">
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>
          <h1 className={styles.pageTitle}>Ticket #{ticketNumber}</h1>
          <span></span>
        </div>

        {/* Status Header */}
        <div className={`${styles.statusCard} ${isEscalated ? styles.statusEscalated : ''}`}>
          <div className={styles.statusBadges}>
            <span className={`badge ${getPriorityBadge(ticket.priority)}`}>{ticket.priority} — {ticket.serviceType?.toUpperCase()}</span>
            <span className={`badge ${getStatusBadge(ticket.status)}`}>{formatStatus(ticket.status)}</span>
          </div>
          <h2 className={styles.statusTitle}>{ticket.ticketNumber}</h2>
        </div>

        {/* SLA Banner */}
        {isActive && sla && (
          <div className={`${styles.slaBanner} ${sla.isFinalBreached ? styles.slaBreach : ''}`}>
            <span className={styles.slaIcon}>⏱</span>
            <div>
              <h4>{sla.isFinalBreached ? 'SLA BREACHED' : `Response Deadline: ${formatSlaSeconds(sla.slaRemainingSecondsFinal)} remaining`}</h4>
              <div className={styles.slaBar}>
                <div className={styles.slaProgress} style={{ width: `${sla.isFinalBreached ? 100 : Math.max(0, 100 - (sla.slaRemainingSecondsFinal / 36 || 50))}%`, background: sla.isFinalBreached ? 'var(--error)' : 'var(--success)' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Escalation Banner */}
        {isEscalated && (
          <div className={styles.escalationBanner}>
            <h3>⚠️ Escalated to Service Managers</h3>
            <p>Ticket #{ticketNumber} • No CRM response within 30 minutes</p>
          </div>
        )}

        {/* Support Team Progression */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Support Team</h3>
          <div className={styles.progression}>
            <div className={`${styles.level} ${ticket.currentLevel >= 1 ? styles.levelActive : ''} ${ticket.currentLevel === 1 ? styles.levelCurrent : ''}`}>
              <div className={styles.levelDot}>{ticket.currentLevel > 1 ? '✕' : '●'}</div>
              <div className={styles.levelLine}></div>
              <div className={styles.levelContent}>
                <h4>Level 1 — CRM Team</h4>
                <p>{ticket.currentLevel === 1 ? 'Currently handling your ticket' : ticket.currentLevel > 1 ? 'Escalated: No response within 30 min' : 'On standby'}</p>
              </div>
            </div>
            <div className={`${styles.level} ${ticket.currentLevel >= 2 ? styles.levelActive : ''} ${ticket.currentLevel === 2 ? styles.levelCurrent : ''}`}>
              <div className={styles.levelDot}>●</div>
              <div className={styles.levelLine}></div>
              <div className={styles.levelContent}>
                <h4>Level 2 — Service Managers</h4>
                <p>{ticket.currentLevel === 2 ? 'Currently handling this ticket' : 'On standby'}</p>
                {ticket.currentLevel === 2 && sla && (
                  <div className={styles.slaMini}>SLA TIME REMAINING<br /><strong>{formatSlaSeconds(sla.slaRemainingSecondsL2)}</strong></div>
                )}
              </div>
            </div>
            <div className={`${styles.level} ${ticket.currentLevel >= 3 ? styles.levelActive : ''}`}>
              <div className={styles.levelDot}>○</div>
              <div className={styles.levelContent}>
                <h4>Level 3 — Management</h4>
                <p>Standby</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Details */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>❄️ Ticket Details</h3>
          <div className={styles.detailGrid}>
            <div className={styles.detailRow}><span>ASSET</span><p>{ticket.acBrand} {ticket.acModel} — {ticket.acUnitRoom}</p></div>
            <div className={styles.detailRow}><span>REPORTED ISSUE</span><p className={styles.issueTxt}>{ticket.problemCategory?.replace(/_/g, ' ')}{ticket.errorCode ? ` + ${ticket.errorCode}` : ''}</p></div>
            {ticket.scheduledDate && <div className={styles.detailRow}><span>SCHEDULED VISIT</span><p>{ticket.scheduledDate} — {ticket.scheduledSlot || 'TBD'}</p></div>}
          </div>
        </div>

        {/* Timeline */}
        {ticket.activities && ticket.activities.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>⏱ Timeline</h3>
            <div className={styles.timeline}>
              {ticket.activities.map((event, i) => (
                <div key={i} className={styles.timelineEvent}>
                  <div className={styles.timelineDot}></div>
                  <div>
                    <span className={styles.timelineTime}>{new Date(event.createdAt).toLocaleString('en-IN')}</span>
                    <p>{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rating */}
        {(ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && !ratingSubmitted && (
          <div className={styles.ratingSection}>
            <h3>⭐ Rate your experience</h3>
            <div className={styles.stars}>
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} className={`${styles.star} ${rating >= s ? styles.starFilled : ''}`} onClick={() => setRating(s)}>★</button>
              ))}
            </div>
            {rating > 0 && <button className="btn btn-primary" onClick={handleRate}>Submit Rating</button>}
          </div>
        )}

        {/* Action Buttons */}
        {isActive && (
          <div className={styles.actionBtns}>
            <a href="tel:+914023540000" className="btn btn-danger btn-full">📞 Emergency? Call us</a>
          </div>
        )}
      </div>
    </div>
  );
}

function getPriorityBadge(p) {
  if (p === 'P1') return 'badge-p1';
  if (p === 'P2') return 'badge-p2';
  return 'badge-p3';
}

function getStatusBadge(s) {
  if (s === 'RESOLVED' || s === 'CLOSED') return 'badge-resolved';
  if (s === 'ESCALATED') return 'badge-escalated';
  return 'badge-open';
}

function formatStatus(s) { return s?.replace(/_/g, ' ') || ''; }

function getSlaRemaining(deadline) {
  if (!deadline) return 'N/A';
  const diff = new Date(deadline) - new Date();
  if (diff <= 0) return 'BREACHED';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return `${hrs}:${String(m).padStart(2, '0')}:00`;
}

function formatSlaSeconds(seconds) {
  if (seconds == null || seconds <= 0) return 'BREACHED';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return `${hrs}h ${m}min`;
}
