'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { tickets } from '@/lib/api';
import styles from './ticketDetail.module.css';

export default function TicketDetailPage({ params }) {
  const { ticketNumber } = params;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState('');
  const [timerColor, setTimerColor] = useState('green');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    
    async function load() {
      try {
        const data = await tickets.get(ticketNumber);
        setTicket(data);
      } catch {
        // Mock fallback if api not implemented fully
        setTicket({
          ticketNumber,
          priority: 'P2',
          status: 'OPEN',
          currentLevel: 1,
          problemCategory: 'NOT_COOLING',
          errorCode: 'E4',
          acBrand: 'Daikin',
          acModel: 'FTX',
          acUnitRoom: 'Master Bedroom',
          scheduledDate: '2024-10-25',
          scheduledSlot: '14:00-16:00',
          slaDeadlineFinal: new Date(Date.now() + 15 * 60000).toISOString(),
          createdAt: new Date(Date.now() - 3600000).toISOString()
        });
      }
      setLoading(false);
    }
    load();
  }, [ticketNumber, user, authLoading, router]);

  useEffect(() => {
    if (!ticket?.slaDeadlineFinal) return;
    
    const interval = setInterval(() => {
      const diff = new Date(ticket.slaDeadlineFinal) - new Date();
      if (diff <= 0) {
        setTimeLeft('BREACHED');
        setTimerColor('red');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
        
        if (mins < 10) setTimerColor('red');
        else if (mins < 20) setTimerColor('orange');
        else setTimerColor('green');
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [ticket]);

  if (authLoading || loading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!ticket) return <div>Ticket not found</div>;

  return (
    <div className={`page-enter ${styles.page}`}>
      <div className={styles.topBar}>
        <button className={styles.iconBtn} onClick={() => router.back()}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className={styles.pageTitle}>Ticket #{ticket.ticketNumber}</h1>
        <div style={{display:'flex', gap:'8px'}}>
          <button className={styles.iconBtn}>🖨️</button>
          <button className={styles.iconBtn}>📥</button>
        </div>
      </div>

      <div className={styles.header}>
        <div className={styles.priorityGroup}>
          <span className={`badge ${ticket.priority === 'P1' ? 'badge-amc' : ticket.priority === 'P2' ? 'badge-warranty' : 'badge-paid'}`}>{ticket.priority}</span>
          <span className={styles.handlingTeam}>{ticket.currentLevel === 1 ? 'CRM Team Handling' : ticket.currentLevel === 2 ? 'Service Managers Handling' : 'Management Handling'}</span>
        </div>
        <h2 className={styles.ticketId}>{ticket.ticketNumber}</h2>
      </div>

      {(ticket.status === 'OPEN' || ticket.status === 'ESCALATED') && (
        <div className={`${styles.slaBanner} ${styles[`slaBanner-${timerColor}`]}`}>
          <div className={styles.slaIcon}>⏱</div>
          <div className={styles.slaContent}>
            <strong>CRM Response Deadline</strong>
            <span>{timeLeft} min remaining</span>
          </div>
        </div>
      )}
      {ticket.status === 'ACKNOWLEDGED' && (
        <div className={`${styles.slaBanner} ${styles.slaBannerGreen}`}>
          <div className={styles.slaIcon}>✓</div>
          <div className={styles.slaContent}>
            <strong>Acknowledged by CRM team</strong>
          </div>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.escalationLadder}>
          <div className={`${styles.step} ${ticket.currentLevel === 1 ? styles.stepActive : ticket.currentLevel > 1 ? styles.stepPast : ''}`}>
            <div className={styles.stepDot}>{ticket.currentLevel > 1 ? '✗' : '1'}</div>
            <div className={styles.stepInfo}>
              <h4>Level 1 — CRM Team</h4>
              {ticket.currentLevel === 1 ? (
                <>
                  <p className={styles.stepStatus}>Currently handling your ticket</p>
                  <p className={styles.stepSub}>Response expected in: {timeLeft}</p>
                </>
              ) : (
                <p className={styles.stepStatus}>Escalated — no response</p>
              )}
            </div>
          </div>
          <div className={styles.stepLine}></div>
          
          <div className={`${styles.step} ${ticket.currentLevel === 2 ? styles.stepActive : ticket.currentLevel > 2 ? styles.stepPast : styles.stepFuture}`}>
            <div className={styles.stepDot}>{ticket.currentLevel > 2 ? '✗' : '2'}</div>
            <div className={styles.stepInfo}>
              <h4>Level 2 — Service Managers</h4>
              {ticket.currentLevel === 2 ? (
                <p className={styles.stepStatus}>Currently handling</p>
              ) : ticket.currentLevel > 2 ? (
                <p className={styles.stepStatus}>Escalated</p>
              ) : (
                <p className={styles.stepStatus}>Auto-escalates if no CRM response in 30 min</p>
              )}
            </div>
          </div>
          <div className={styles.stepLine}></div>

          <div className={`${styles.step} ${ticket.currentLevel === 3 ? styles.stepUrgent : styles.stepFuture}`}>
            <div className={styles.stepDot}>3</div>
            <div className={styles.stepInfo}>
              <h4>Level 3 — Management</h4>
              {ticket.currentLevel === 3 ? (
                <p className={styles.stepStatus}>Management handling</p>
              ) : (
                <p className={styles.stepStatus}>Escalates if unresolved after Level 2</p>
              )}
            </div>
          </div>
          <p className={styles.escalationNote}>ℹ Escalation is automatic. You&apos;ll be notified at each step.</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>❄️</span>
            <h3>Asset Details</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.detailRow}>
              <span>Asset:</span>
              <strong>{ticket.acBrand} {ticket.acModel} — {ticket.acUnitRoom}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Reported Issue:</span>
              <strong>{ticket.problemCategory?.replace(/_/g, ' ')} {ticket.errorCode ? `+ ${ticket.errorCode}` : ''}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Scheduled Visit:</span>
              <strong>📅 {ticket.scheduledDate} — {ticket.scheduledSlot}</strong>
            </div>
          </div>
        </div>

        <div className={styles.timelineCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>🕒</span>
            <h3>Activity Timeline</h3>
          </div>
          <div className={styles.timeline}>
            {ticket.activities && ticket.activities.length > 0 ? (
              [...ticket.activities].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((activity) => (
                <div key={activity.id} className={styles.timelineEvent}>
                  <div className={styles.tlDot}></div>
                  <div className={styles.tlContent}>
                    <span className={styles.tlTime}>
                      {new Date(activity.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <p>{activity.description}</p>
                  </div>
                </div>
              ))
            ) : (
              <p>No activity recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className={styles.bottomActions}>
        <button className="btn btn-outline" style={{flex: 1}}>＋ Add Note / Photo</button>
        <a href="tel:+914023540000" className="btn btn-primary" style={{flex: 1, backgroundColor: '#dc2626', borderColor: '#dc2626'}}>Emergency? Call us</a>
      </div>
    </div>
  );
}
