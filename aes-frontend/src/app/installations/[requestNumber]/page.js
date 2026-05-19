'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Building2, Calendar, MapPin, Snowflake, FileText, ThumbsUp, ThumbsDown,
  MessageSquare, Clock, CheckCircle2, X, ArrowLeft, ChevronRight,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { installations as installationsApi, quotes as quotesApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import AppTopBar from '@/components/ui/AppTopBar';
import styles from './detail.module.css';

const STATUS_LABEL = {
  PENDING:                  'Awaiting triage',
  NEW:                      'Awaiting triage',
  OFFERED_CRM:              'Awaiting CRM acceptance',
  CONFIRMED:                'Confirmed — site visit being scheduled',
  SURVEY_SCHEDULED:         'Site survey scheduled',
  SITE_VISITED:             'Site survey done',
  SITE_VISIT_DONE:          'Site survey done',
  QUOTE_DRAFT:              'Preparing your quote',
  QUOTE_PENDING_APPROVAL:   'Quote being approved internally',
  QUOTE_REJECTED_INTERNAL:  'Quote rework in progress',
  QUOTE_SENT:               'Estimate sent — please review',
  QUOTE_NEGOTIATING:        'Negotiating your quote',
  QUOTE_ACCEPTED:           'Quote accepted — installation will be scheduled',
  INSTALLATION_SCHEDULED:   'Installation scheduled',
  INSTALLATION_IN_PROGRESS: 'Installation in progress',
  COMPLETED:                'Installation completed',
  CANCELLED:                'Request cancelled',
};

const STEPS = [
  { key: 'submitted',  label: 'Request' },
  { key: 'triaged',    label: 'CRM' },
  { key: 'survey',     label: 'Survey' },
  { key: 'quote',      label: 'Quote' },
  { key: 'install',    label: 'Install' },
  { key: 'done',       label: 'Done' },
];

const STAGE_OF = (s) => {
  if (['COMPLETED', 'CANCELLED'].includes(s)) return 'done';
  if (['INSTALLATION_IN_PROGRESS','INSTALLATION_SCHEDULED','QUOTE_ACCEPTED'].includes(s)) return 'install';
  if (['QUOTE_DRAFT','QUOTE_PENDING_APPROVAL','QUOTE_REJECTED_INTERNAL','QUOTE_SENT','QUOTE_NEGOTIATING'].includes(s)) return 'quote';
  if (['SURVEY_SCHEDULED','SITE_VISITED','SITE_VISIT_DONE'].includes(s)) return 'survey';
  if (['CONFIRMED','OFFERED_CRM'].includes(s)) return 'triaged';
  return 'submitted';
};
const STAGE_INDEX = (st) => STEPS.findIndex((s) => s.key === st);

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InstallationDetailPage({ params }) {
  const { requestNumber } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();

  const [req, setReq] = useState(null);
  const [installQuotes, setQuotes] = useState([]);
  const [loading, setLoad] = useState(true);
  const [openQuote, setOpenQuote] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(`/login?next=/installations/${requestNumber}`); return; }
  }, [user, authLoading, router, requestNumber]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    installationsApi.getByNumber(requestNumber)
      .then((r) => {
        if (cancelled) return;
        setReq(r);
        if (r?.id) {
          return quotesApi.forInstall(r.id).then((q) => {
            if (cancelled) return;
            setQuotes(Array.isArray(q) ? q : []);
          });
        }
      })
      .catch((e) => toast.error(e?.message || 'Could not load project'))
      .finally(() => !cancelled && setLoad(false));
    return () => { cancelled = true; };
  }, [user, requestNumber, toast]);

  const reload = async () => {
    try {
      const fresh = await installationsApi.getByNumber(requestNumber);
      setReq(fresh);
      const qs = await quotesApi.forInstall(fresh.id).catch(() => []);
      setQuotes(Array.isArray(qs) ? qs : []);
    } catch {}
  };

  const handleQuoteDecision = async (decision, comment) => {
    if (!openQuote) return;
    try {
      await quotesApi.customerDecision(openQuote.quoteNumber, { decision, comment });
      toast.success(`Quote ${decision.toLowerCase()}ed.`);
      setOpenQuote(null); reload();
    } catch (e) { toast.error(e?.message || 'Could not submit decision'); }
  };

  if (authLoading || loading || !user) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  if (!req) {
    return (
      <div className={styles.shell}>
        <AppTopBar title="Project not found" width="detail" />
        <div className={styles.empty}>
          <Building2 size={32} />
          <h2>We couldn't find that project.</h2>
          <Link href="/installations" className="btn btn-outline">
            <ArrowLeft size={14} /> Back to my projects
          </Link>
        </div>
      </div>
    );
  }

  const stage = STAGE_OF(req.status);
  const stageIdx = STAGE_INDEX(stage);
  const pendingQuote = installQuotes.find((q) => q.status === 'SENT_TO_CUSTOMER');
  const acceptedQuote = installQuotes.find((q) => q.status === 'ACCEPTED');
  const rooms = (() => {
    try { return JSON.parse(req.roomsJson || '[]'); }
    catch { return []; }
  })();

  return (
    <div className={styles.shell}>
      <AppTopBar title={req.requestNumber} width="detail" />

      <div className={styles.body}>
        <motion.section className={styles.statusCard}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className={styles.statusHead}>
            <span className={styles.numPill}>{req.requestNumber}</span>
            <span className={styles.statusLabel}>{STATUS_LABEL[req.status] || req.status}</span>
          </div>
          <h2 className={styles.title}>
            {(req.acType || '').replace('_', '/')} Installation
            {req.tonnage && <> · {req.tonnage} ton</>}
          </h2>
          {req.brand && (
            <p className={styles.subtitle}>
              {req.brand} {req.modelNumber || ''}
              {req.energyRating && ` · ${req.energyRating}-star`}
            </p>
          )}

          {/* Progress strip */}
          <div className={styles.steps}>
            {STEPS.map((s, idx) => {
              const done   = idx < stageIdx;
              const active = idx === stageIdx;
              return (
                <div key={s.key} className={`${styles.stepWrap} ${done ? styles.stepDone : ''} ${active ? styles.stepActive : ''}`}>
                  <div className={styles.stepDot}>
                    {done ? <CheckCircle2 size={12} strokeWidth={3} /> : idx + 1}
                  </div>
                  <span className={styles.stepLabel}>{s.label}</span>
                  {idx < STEPS.length - 1 && <span className={styles.stepLine} />}
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Pending estimate */}
        {pendingQuote && (
          <motion.section className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className={styles.cardTitle}><FileText size={16} /> Estimate awaiting your decision</h3>
            <p className={styles.cardSub}>
              We've prepared a quote of <strong>₹{Number(pendingQuote.total || 0).toLocaleString('en-IN')}</strong>.
            </p>
            <button className="btn btn-primary btn-full" onClick={() => setOpenQuote(pendingQuote)}>
              Review estimate <ChevronRight size={14} />
            </button>
          </motion.section>
        )}

        {acceptedQuote && (
          <motion.section className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className={styles.cardTitle}><CheckCircle2 size={16} color="var(--success)" /> Accepted quote</h3>
            <p className={styles.cardSub}>
              {acceptedQuote.quoteNumber} · ₹{Number(acceptedQuote.total || 0).toLocaleString('en-IN')}
            </p>
            <button className="btn btn-outline btn-full" onClick={() => setOpenQuote(acceptedQuote)}>
              View accepted estimate
            </button>
          </motion.section>
        )}

        {/* Schedule */}
        {req.scheduledDate && (
          <motion.section className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className={styles.cardTitle}><Calendar size={16} /> Scheduled</h3>
            <p className={styles.cardSub}>
              {fmtDate(req.scheduledDate)}{req.scheduledSlot ? ` · ${req.scheduledSlot}` : ''}
            </p>
            {req.assignedEngineerName && (
              <p className={styles.cardSub}>
                Engineer: <strong>{req.assignedEngineerName}</strong>
              </p>
            )}
          </motion.section>
        )}

        {/* Property */}
        {(req.propertyLabel || req.propertyAddress) && (
          <motion.section className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className={styles.cardTitle}><MapPin size={16} /> Site</h3>
            {req.propertyLabel && <p className={styles.cardSub}><strong>{req.propertyLabel}</strong></p>}
            {req.propertyAddress && <p className={styles.cardSub}>{req.propertyAddress}</p>}
          </motion.section>
        )}

        {/* Rooms */}
        {rooms.length > 0 && (
          <motion.section className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className={styles.cardTitle}><Snowflake size={16} /> Rooms ({rooms.length})</h3>
            <ul className={styles.rooms}>
              {rooms.map((r, i) => (
                <li key={i}>
                  <strong>{r.name || r.roomName || `Room ${i + 1}`}</strong>
                  {r.size  && <> · {r.size} sq ft</>}
                  {r.units && <> · {r.units} unit{r.units > 1 ? 's' : ''}</>}
                  {r.type  && <> · {r.type}</>}
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {/* Notes */}
        {req.notes && (
          <motion.section className={styles.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className={styles.cardTitle}>Notes</h3>
            <p className={styles.cardSub}>{req.notes}</p>
          </motion.section>
        )}

        {/* Stamp */}
        <p className={styles.stamp}>
          <Clock size={12} /> Submitted {fmtDate(req.createdAt)}
        </p>
      </div>

      {openQuote && (
        <QuoteReviewSheet quote={openQuote} onClose={() => setOpenQuote(null)} onSubmit={handleQuoteDecision} />
      )}
    </div>
  );
}

function QuoteReviewSheet({ quote, onClose, onSubmit }) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (d) => {
    if (!d) return;
    setSaving(true);
    await onSubmit(d, comment.trim() || null);
    setSaving(false);
  };
  const isLive = quote.status === 'SENT_TO_CUSTOMER';

  return (
    <motion.div className={styles.sheetBackdrop}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}>
      <motion.div className={styles.sheet}
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <h3>{quote.quoteNumber} · ₹{Number(quote.total || 0).toLocaleString('en-IN')}</h3>
          <button type="button" onClick={onClose} className={styles.iconBtn}><X size={18} /></button>
        </div>
        <p className={styles.sheetSub}>
          Prepared by {quote.preparedByName || 'AES'} on {fmtDate(quote.createdAt)}.
        </p>

        <div className={styles.itemsBox}>
          {(quote.items || []).map((it, i) => (
            <div key={i} className={styles.itemRow}>
              <div>
                <div className={styles.itemDesc}>{it.description}</div>
                <div className={styles.itemSub}>
                  {it.quantity} × ₹{Number(it.unitPrice || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className={styles.itemTotal}>
                ₹{Number(it.lineTotal || (it.quantity * it.unitPrice) || 0).toLocaleString('en-IN')}
              </div>
            </div>
          ))}
          <div className={styles.totalRow}>
            <strong>Total</strong>
            <strong>₹{Number(quote.total || 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>

        {isLive && (
          <>
            <label className="input-group">
              <span>Comment (required for negotiate / reject)</span>
              <textarea className="input textarea" rows={3} maxLength={500}
                        value={comment} onChange={(e) => setComment(e.target.value)}
                        placeholder="What you'd like adjusted, or why you're declining" />
            </label>
            <div className={styles.decisionRow}>
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
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
