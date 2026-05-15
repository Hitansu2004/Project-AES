'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertCircle, Camera, Phone, Clock, History, Snowflake, MapPin,
  Star, CalendarDays, MoreHorizontal, X, CheckCircle2, Send,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { tickets as ticketsApi, ticketActions } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import AppTopBar from '@/components/ui/AppTopBar';
import PriorityBadge from '@/components/ui/PriorityBadge';
import SlaCountdown from '@/components/ui/SlaCountdown';
import EscalationLadder from '@/components/ui/EscalationLadder';
import { slotLabel } from '@/lib/constants';
import styles from './ticketDetail.module.css';

const PROBLEM_LABEL = {
  NOT_COOLING: 'Not Cooling',
  NOISE: 'Noise',
  LEAKING: 'Water Leak',
  NOT_TURNING_ON: 'Not Turning On',
  NO_AIRFLOW: 'No Airflow',
  REMOTE_WIFI: 'Remote / Wi-Fi',
  OTHER: 'Other Issue',
};

function activityIcon(type) {
  switch (type) {
    case 'TICKET_RAISED':       return <CheckCircle2 size={14} />;
    case 'ACKNOWLEDGED':        return <CheckCircle2 size={14} />;
    case 'ASSIGNED':            return <Phone size={14} />;
    case 'ESCALATED':           return <AlertCircle size={14} />;
    case 'NOTE_ADDED':
    case 'CUSTOMER_NOTE':       return <Send size={14} />;
    case 'PHOTO_ADDED':         return <Camera size={14} />;
    case 'RESOLVED':            return <CheckCircle2 size={14} />;
    default:                    return <Clock size={14} />;
  }
}

function formatStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function TicketDetailPage({ params }) {
  const { ticketNumber } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRate, setShowRate] = useState(false);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(`/login?next=/tickets/${ticketNumber}`); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router, ticketNumber]);

  // Fetch + 30s soft refresh while open
  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;
    let cancelled = false;
    const fetchTicket = async () => {
      try {
        const data = await ticketsApi.get(ticketNumber);
        if (cancelled) return;
        setTicket(data);
      } catch {
        if (!cancelled) toast.error('Could not load ticket.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTicket();
    const id = setInterval(fetchTicket, 30000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketNumber, user]);

  const escalated = ticket && (ticket.currentLevel || 1) > 1;
  const resolved = ticket && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED');
  const closed = ticket?.status === 'CLOSED';

  const activeSla = useMemo(() => {
    if (!ticket || resolved) return null;
    const lvl = ticket.currentLevel || 1;
    if (ticket.acknowledgedAt && lvl === 1) {
      return { deadline: ticket.slaDeadlineFinal, total: 24 * 60 * 60, label: 'Resolution SLA' };
    }
    if (lvl === 1)  return { deadline: ticket.slaDeadlineL1,    total: 30 * 60,    label: 'CRM Response Deadline' };
    if (lvl === 2)  return { deadline: ticket.slaDeadlineL2,    total: 30 * 60,    label: 'L2 Response Deadline' };
    if (lvl === 3)  return { deadline: ticket.slaDeadlineFinal, total: 24 * 60 * 60, label: 'Final Resolution Deadline' };
    return null;
  }, [ticket, resolved]);

  if (authLoading || loading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }
  if (!ticket) {
    return (
      <div className={styles.shell}>
        <AppTopBar title="Ticket not found" width="detail" />
        <div className={styles.empty}>
          <h2>We couldn&apos;t find that ticket.</h2>
          <p>It may have been removed, or you might not have access.</p>
        </div>
      </div>
    );
  }

  const handleRate = async (rating, feedback) => {
    try {
      await ticketActions.rate(ticket.ticketNumber, { rating, feedback });
      toast.success('Thanks for the feedback!');
      setShowRate(false);
      const fresh = await ticketsApi.get(ticket.ticketNumber);
      setTicket(fresh);
    } catch (err) {
      toast.error(err.message || 'Could not submit rating.');
    }
  };

  return (
    <div className={styles.shell}>
      <AppTopBar
        title={`Ticket ${ticket.ticketNumber}`}
        width="detail"
        right={
          <button className={styles.iconBtn} aria-label="More" type="button">
            <MoreHorizontal size={20} />
          </button>
        }
      />

      <div className={styles.body}>
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={`${styles.statusCard} ${styles[`status_${escalated ? 'esc' : resolved ? 'resolved' : 'open'}`]}`}
        >
          <div className={styles.statusBar} />
          <div className={styles.statusHead}>
            <PriorityBadge priority={ticket.priority} />
            <span className={styles.statusBadge}>
              <span className={styles.statusDot} />
              {resolved
                ? 'Resolved'
                : escalated
                  ? `Escalated to L${ticket.currentLevel}`
                  : ticket.acknowledgedAt
                    ? 'CRM Acknowledged'
                    : 'CRM Team Handling'}
            </span>
          </div>
          <h2 className={styles.ticketNumber}>{ticket.ticketNumber}</h2>
        </motion.section>

        {!resolved && activeSla?.deadline && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
          >
            <SlaCountdown
              variant="banner"
              deadlineISO={activeSla.deadline}
              totalSeconds={activeSla.total}
              label={activeSla.label}
            />
          </motion.div>
        )}

        <motion.section
          className={styles.card}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <h3 className={styles.cardTitle}>Support Team</h3>
          <EscalationLadder
            currentLevel={ticket.currentLevel || 1}
            slaRemainingSeconds={activeSla?.deadline ? Math.max(0, Math.floor((new Date(activeSla.deadline).getTime() - Date.now()) / 1000)) : null}
            acknowledgedAtCurrentLevel={!!ticket.acknowledgedAt && (ticket.currentLevel || 1) === 1}
          />
        </motion.section>

        <div className={styles.twoCol}>
          <motion.section
            className={styles.card}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
          >
            <h3 className={styles.cardTitle}>
              <Snowflake size={16} /> Ticket Details
            </h3>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Asset</span>
              <span className={styles.detailValue}>
                {ticket.acBrand} {ticket.acModel || ''} — {ticket.acUnitRoom}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Reported Issue</span>
              <span className={`${styles.detailValue} ${styles.issueText}`}>
                {[
                  PROBLEM_LABEL[ticket.problemCategory] || ticket.problemCategory,
                  ticket.errorCode ? `Code ${ticket.errorCode}` : null,
                ].filter(Boolean).join(' + ')}
              </span>
            </div>
            {ticket.problemDescription && (
              <div className={styles.descBlock}>
                <span className={styles.detailLabel}>Description</span>
                <p>{ticket.problemDescription}</p>
              </div>
            )}
            {ticket.scheduledDate && (
              <div className={styles.scheduleBlock}>
                <CalendarDays size={18} color="#0099CC" />
                <div>
                  <span className={styles.detailLabel}>Scheduled Visit</span>
                  <p>
                    {new Date(ticket.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {ticket.scheduledSlot ? ` · ${slotLabel(ticket.scheduledSlot)}` : ''}
                  </p>
                </div>
              </div>
            )}
            {(ticket.propertyLabel || ticket.propertyId) && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Property</span>
                <span className={styles.detailValue}>
                  <MapPin size={14} /> {ticket.propertyLabel || '—'}
                </span>
              </div>
            )}
          </motion.section>

          <motion.section
            className={styles.card}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.2 }}
          >
            <h3 className={styles.cardTitle}>
              <History size={16} /> Timeline
            </h3>
            <ActivityTimeline activities={ticket.activities || []} createdAt={ticket.createdAt} />
          </motion.section>
        </div>

        {/* ─── Action buttons ─── */}
        {!resolved && (
          <div className={styles.actionRow}>
            <button type="button" className="btn btn-outline btn-full">
              <Camera size={16} /> Add Note / Photo
            </button>
            <a href="tel:+914023540000" className="btn btn-danger btn-full">
              <Phone size={16} /> Emergency? Call us
            </a>
          </div>
        )}

        {/* ─── Rating CTA ─── */}
        {ticket.status === 'RESOLVED' && !ticket.customerRating && (
          <motion.section
            className={`${styles.card} ${styles.rateCard}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Star size={22} color="#f59e0b" fill="#f59e0b" />
            <div>
              <h4>How did we do?</h4>
              <p>Tap to rate your service experience.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setShowRate(true)}>
              Rate Service
            </button>
          </motion.section>
        )}

        {ticket.customerRating && (
          <section className={`${styles.card} ${styles.rateCard}`}>
            <div className={styles.ratedStars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={18}
                  fill={n <= ticket.customerRating ? '#f59e0b' : 'transparent'}
                  color="#f59e0b"
                />
              ))}
            </div>
            <p style={{ flex: 1 }}>
              You rated this service <strong>{ticket.customerRating}/5</strong>{ticket.customerFeedback ? ` — "${ticket.customerFeedback}"` : ''}
            </p>
          </section>
        )}
      </div>

      {showRate && (
        <RatingSheet ticket={ticket} onClose={() => setShowRate(false)} onSubmit={handleRate} />
      )}
    </div>
  );
}

function ActivityTimeline({ activities, createdAt }) {
  // Always show "Ticket raised" as the first item
  const items = [
    ...(activities || []).map((a) => ({
      type: a.activityType,
      desc: a.description,
      stamp: a.createdAt,
    })),
  ];
  if (!items.find((i) => i.type === 'TICKET_RAISED')) {
    items.push({ type: 'TICKET_RAISED', desc: 'Ticket raised', stamp: createdAt });
  }
  // sort newest first
  items.sort((a, b) => new Date(b.stamp || 0) - new Date(a.stamp || 0));

  if (items.length === 0) {
    return <p className={styles.timelineEmpty}>No activity yet.</p>;
  }

  return (
    <ul className={styles.timeline}>
      {items.map((it, i) => (
        <li key={i} className={styles.timelineRow}>
          <span className={styles.timelineDot}>
            {activityIcon(it.type)}
          </span>
          <div className={styles.timelineMain}>
            <span className={styles.timelineStamp}>{formatStamp(it.stamp)}</span>
            <p>{it.desc || it.type.replace(/_/g, ' ').toLowerCase()}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RatingSheet({ ticket, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    if (rating < 1) return;
    setSaving(true);
    await onSubmit(rating, feedback?.trim() || null);
    setSaving(false);
  };

  return (
    <motion.div
      className={styles.sheetBackdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.sheet}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <h3>Rate your service</h3>
          <button type="button" onClick={onClose} className={styles.iconBtn} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className={styles.sheetSub}>How was your experience with ticket {ticket.ticketNumber}?</p>
        <div className={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className={styles.starBtn}
            >
              <Star
                size={36}
                fill={(hover || rating) >= n ? '#f59e0b' : 'transparent'}
                color="#f59e0b"
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
        <textarea
          className="input textarea"
          rows={3}
          maxLength={500}
          placeholder="Tell us what went well or what we can improve (optional)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary btn-full btn-lg"
          disabled={rating < 1 || saving}
          onClick={handle}
        >
          {saving ? <span className="spinner spinner-sm" /> : 'Submit Rating'}
        </button>
      </motion.div>
    </motion.div>
  );
}
