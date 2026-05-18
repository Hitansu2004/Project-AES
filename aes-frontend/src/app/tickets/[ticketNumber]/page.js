'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertCircle, Camera, Phone, Clock, History, Snowflake, MapPin,
  Star, CalendarDays, MoreHorizontal, X, CheckCircle2, Send,
  ArrowUp, RefreshCw, RotateCcw, FileText, ThumbsUp, ThumbsDown,
  MessageSquare,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { tickets as ticketsApi, ticketActions, quotes as quotesApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import AppTopBar from '@/components/ui/AppTopBar';
import PriorityBadge from '@/components/ui/PriorityBadge';
import SlaCountdown from '@/components/ui/SlaCountdown';
import EscalationLadder from '@/components/ui/EscalationLadder';
import useStompTopic from '@/hooks/useStompTopic';
import { slotLabel } from '@/lib/constants';
import styles from './ticketDetail.module.css';

const TICKET_EVENT_TONE = {
  ACKNOWLEDGED: 'success',
  ENGINEER_ASSIGNED: 'info',
  ESCALATED_TO_L2: 'warning',
  ESCALATED_TO_L3: 'warning',
  RESOLVED: 'success',
};

const TICKET_EVENT_TEXT = {
  ACKNOWLEDGED: 'CRM team acknowledged your ticket',
  ENGINEER_ASSIGNED: 'An engineer has been assigned',
  ESCALATED_TO_L2: 'Ticket escalated to Service Manager',
  ESCALATED_TO_L3: 'Ticket escalated to Management',
  RESOLVED: 'Your ticket has been resolved',
};

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
  const [ticketQuotes, setTicketQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRate, setShowRate] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showEscalate, setShowEscalate]     = useState(false);
  const [showReopen, setShowReopen]         = useState(false);
  const [openQuote, setOpenQuote]           = useState(null);

  // Auth guard — every authenticated role can open a ticket detail
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(`/login?next=/tickets/${ticketNumber}`); return; }
  }, [user, authLoading, router, ticketNumber]);

  // Fetch + 30s soft refresh while open
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchTicket = async () => {
      try {
        const data = await ticketsApi.get(ticketNumber);
        if (cancelled) return;
        setTicket(data);
        if (data?.id) {
          quotesApi.forTicket(data.id)
            .then((qs) => { if (!cancelled) setTicketQuotes(Array.isArray(qs) ? qs : []); })
            .catch(() => {});
        }
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

  // Live updates — refresh on any ticket-level WS event and toast meaningful ones
  useStompTopic(
    user ? `/topic/tickets/${ticketNumber}` : null,
    (msg) => {
      const text = TICKET_EVENT_TEXT[msg?.event];
      if (text) {
        const tone = TICKET_EVENT_TONE[msg.event] || 'info';
        const fn = tone === 'warning' ? toast.info : toast[tone];
        (fn || toast.info)(text);
      }
      ticketsApi.get(ticketNumber).then(setTicket).catch(() => {});
    },
    [ticketNumber],
  );

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

  const reload = async () => {
    try {
      const fresh = await ticketsApi.get(ticket.ticketNumber);
      setTicket(fresh);
      if (fresh?.id) {
        const qs = await quotesApi.forTicket(fresh.id).catch(() => []);
        setTicketQuotes(Array.isArray(qs) ? qs : []);
      }
    } catch {}
  };
  const handleEscalate = async ({ reason, details }) => {
    try {
      await ticketActions.customerEscalate(ticket.ticketNumber, { reason, details });
      toast.success('Escalation raised. Service Manager will be in touch.');
      setShowEscalate(false); reload();
    } catch (e) { toast.error(e?.message || 'Could not escalate'); }
  };
  const handleReschedule = async ({ scheduledDate, scheduledSlot, reason }) => {
    try {
      await ticketActions.reschedule(ticket.ticketNumber, { scheduledDate, scheduledSlot, reason });
      toast.success('Visit rescheduled.');
      setShowReschedule(false); reload();
    } catch (e) { toast.error(e?.message || 'Could not reschedule'); }
  };
  const handleReopen = async ({ reason }) => {
    try {
      await ticketActions.reopen(ticket.ticketNumber, { reason });
      toast.success('Ticket reopened. CRM is on it.');
      setShowReopen(false); reload();
    } catch (e) { toast.error(e?.message || 'Could not reopen'); }
  };
  const handleQuoteDecision = async (decision, comment) => {
    if (!openQuote) return;
    try {
      await quotesApi.customerDecision(openQuote.quoteNumber, { decision, comment });
      toast.success(`Quote ${decision.toLowerCase()}ed.`);
      setOpenQuote(null); reload();
    } catch (e) { toast.error(e?.message || 'Could not submit decision'); }
  };

  const isCustomer = user.role === 'CUSTOMER';
  const canReopen  = isCustomer && ticket.status === 'CLOSED';
  const canRequest = isCustomer && ['OPEN','ACKNOWLEDGED','ASSIGNED','EN_ROUTE','ON_SITE','IN_PROGRESS'].includes(ticket.status);
  const pendingQuote = (ticketQuotes || []).find((q) => q.status === 'SENT_TO_CUSTOMER');

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

        {/* ─── Pending quote panel ─── */}
        {pendingQuote && isCustomer && (
          <motion.section className={styles.card}
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className={styles.cardTitle}><FileText size={16} /> Estimate awaiting your decision</h3>
            <p style={{ marginTop: -4, marginBottom: 12, fontSize: 13, color: 'var(--on-surface-variant)' }}>
              We've prepared a quote of <strong>₹{Number(pendingQuote.total || 0).toLocaleString('en-IN')}</strong>.
              Tap below to review and accept, negotiate, or reject.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-full" onClick={() => setOpenQuote(pendingQuote)}>
                Review estimate
              </button>
            </div>
          </motion.section>
        )}

        {/* ─── Customer action buttons ─── */}
        {!resolved && isCustomer && canRequest && (
          <div className={styles.actionRow}>
            <button type="button" className="btn btn-outline btn-full"
                    onClick={() => setShowReschedule(true)}>
              <CalendarDays size={16} /> Reschedule visit
            </button>
            <button type="button" className="btn btn-soft btn-full"
                    onClick={() => setShowEscalate(true)}>
              <ArrowUp size={16} /> Escalate to manager
            </button>
            <a href="tel:+914023540000" className="btn btn-danger btn-full">
              <Phone size={16} /> Emergency? Call us
            </a>
          </div>
        )}

        {/* ─── Closed-ticket: reopen ─── */}
        {canReopen && (
          <div className={styles.actionRow}>
            <button type="button" className="btn btn-primary btn-full" onClick={() => setShowReopen(true)}>
              <RotateCcw size={16} /> Re-open this ticket
            </button>
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
      {showReschedule && (
        <RescheduleSheet ticket={ticket} onClose={() => setShowReschedule(false)} onSubmit={handleReschedule} />
      )}
      {showEscalate && (
        <EscalateSheet ticket={ticket} onClose={() => setShowEscalate(false)} onSubmit={handleEscalate} />
      )}
      {showReopen && (
        <ReopenSheet ticket={ticket} onClose={() => setShowReopen(false)} onSubmit={handleReopen} />
      )}
      {openQuote && (
        <QuoteReviewSheet quote={openQuote} onClose={() => setOpenQuote(null)} onSubmit={handleQuoteDecision} />
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

function SheetFrame({ children, onClose }) {
  return (
    <motion.div
      className={styles.sheetBackdrop}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.sheet}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.sheetHandle} />
        {children}
      </motion.div>
    </motion.div>
  );
}

function EscalateSheet({ ticket, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    await onSubmit({ reason: reason.trim(), details: details.trim() || null });
    setSaving(false);
  };
  return (
    <SheetFrame onClose={onClose}>
      <div className={styles.sheetHeader}>
        <h3>Escalate {ticket.ticketNumber}</h3>
        <button type="button" onClick={onClose} className={styles.iconBtn}><X size={18} /></button>
      </div>
      <p className={styles.sheetSub}>
        A Service Manager will be alerted. Use this when CRM hasn't responded or the issue is urgent.
      </p>
      <label className="input-group">
        <span>What's wrong?*</span>
        <input className="input" placeholder="No response for 30 min, urgent business need…"
               value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label className="input-group">
        <span>Anything else (optional)</span>
        <textarea className="input textarea" rows={3} maxLength={500}
                  value={details} onChange={(e) => setDetails(e.target.value)} />
      </label>
      <button type="button" className="btn btn-primary btn-full btn-lg"
              disabled={!reason.trim() || saving} onClick={submit}>
        {saving ? <span className="spinner spinner-sm" /> : 'Escalate'}
      </button>
    </SheetFrame>
  );
}

function RescheduleSheet({ ticket, onClose, onSubmit }) {
  const [date, setDate] = useState(ticket.scheduledDate || '');
  const [slot, setSlot] = useState(ticket.scheduledSlot || 'AFTERNOON');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!date) return;
    setSaving(true);
    await onSubmit({ scheduledDate: date, scheduledSlot: slot, reason: reason.trim() || null });
    setSaving(false);
  };
  return (
    <SheetFrame onClose={onClose}>
      <div className={styles.sheetHeader}>
        <h3>Reschedule visit</h3>
        <button type="button" onClick={onClose} className={styles.iconBtn}><X size={18} /></button>
      </div>
      <p className={styles.sheetSub}>Pick a date and slot that works for you.</p>
      <label className="input-group">
        <span>New date*</span>
        <input className="input" type="date" value={date}
               min={new Date().toISOString().slice(0, 10)}
               onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="input-group">
        <span>Slot</span>
        <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
          <option value="MORNING">Morning (9 AM – 12 PM)</option>
          <option value="AFTERNOON">Afternoon (12 PM – 3 PM)</option>
          <option value="EVENING">Evening (3 PM – 6 PM)</option>
        </select>
      </label>
      <label className="input-group">
        <span>Reason (optional)</span>
        <input className="input" placeholder="Will be out, prefer weekend, etc."
               value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <button type="button" className="btn btn-primary btn-full btn-lg"
              disabled={!date || saving} onClick={submit}>
        {saving ? <span className="spinner spinner-sm" /> : 'Confirm reschedule'}
      </button>
    </SheetFrame>
  );
}

function ReopenSheet({ ticket, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    await onSubmit({ reason: reason.trim() });
    setSaving(false);
  };
  return (
    <SheetFrame onClose={onClose}>
      <div className={styles.sheetHeader}>
        <h3>Re-open {ticket.ticketNumber}</h3>
        <button type="button" onClick={onClose} className={styles.iconBtn}><X size={18} /></button>
      </div>
      <p className={styles.sheetSub}>
        Tell us what's still wrong. We'll re-open the ticket and assign it to a CRM right away.
      </p>
      <label className="input-group">
        <span>What's still broken?*</span>
        <textarea className="input textarea" rows={4} value={reason}
                  onChange={(e) => setReason(e.target.value)} maxLength={1000}
                  placeholder="Same issue came back yesterday, etc." />
      </label>
      <button type="button" className="btn btn-primary btn-full btn-lg"
              disabled={!reason.trim() || saving} onClick={submit}>
        {saving ? <span className="spinner spinner-sm" /> : 'Re-open ticket'}
      </button>
    </SheetFrame>
  );
}

function QuoteReviewSheet({ quote, onClose, onSubmit }) {
  const [decision, setDecision] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (d) => {
    if (!d) return;
    setSaving(true);
    await onSubmit(d, comment.trim() || null);
    setSaving(false);
  };

  return (
    <SheetFrame onClose={onClose}>
      <div className={styles.sheetHeader}>
        <h3>{quote.quoteNumber} · ₹{Number(quote.total || 0).toLocaleString('en-IN')}</h3>
        <button type="button" onClick={onClose} className={styles.iconBtn}><X size={18} /></button>
      </div>
      <p className={styles.sheetSub}>
        Estimate prepared by {quote.preparedByName || 'AES'} on{' '}
        {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('en-IN') : '—'}.
      </p>

      <div style={{ border: '1px solid var(--outline-variant)', borderRadius: 12, padding: '8px 0', marginBottom: 12 }}>
        {(quote.items || []).map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px',
                                 borderBottom: i === quote.items.length - 1 ? 'none' : '1px solid var(--outline-variant)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.description}</div>
              <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)' }}>
                {it.quantity} × ₹{Number(it.unitPrice || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              ₹{Number(it.lineTotal || (it.quantity * it.unitPrice) || 0).toLocaleString('en-IN')}
            </div>
          </div>
        ))}
        {(quote.gst != null || quote.discount != null) && (
          <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--on-surface-variant)' }}>
            Subtotal ₹{Number(quote.subtotal || 0).toLocaleString('en-IN')}
            {quote.discount > 0 && <> · Discount −₹{Number(quote.discount).toLocaleString('en-IN')}</>}
            {quote.gst > 0 && <> · GST ₹{Number(quote.gst).toLocaleString('en-IN')}</>}
          </div>
        )}
        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
                       borderTop: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)' }}>
          <strong>Total</strong>
          <strong>₹{Number(quote.total || 0).toLocaleString('en-IN')}</strong>
        </div>
      </div>

      {quote.validUntil && (
        <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 12 }}>
          Valid until {new Date(quote.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.
        </p>
      )}

      <label className="input-group">
        <span>Comment (required for negotiate / reject)</span>
        <textarea className="input textarea" rows={3} maxLength={500}
                  value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder="What you'd like adjusted, or why you're declining" />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <button type="button" className="btn btn-outline" disabled={saving}
                onClick={() => submit('REJECT')}>
          <ThumbsDown size={14} /> Reject
        </button>
        <button type="button" className="btn btn-soft" disabled={saving}
                onClick={() => submit('NEGOTIATE')}>
          <MessageSquare size={14} /> Negotiate
        </button>
        <button type="button" className="btn btn-primary" disabled={saving}
                onClick={() => submit('ACCEPT')}>
          <ThumbsUp size={14} /> Accept
        </button>
      </div>
    </SheetFrame>
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
