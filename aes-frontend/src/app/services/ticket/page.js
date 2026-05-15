'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, ShieldCheck, Award, Wrench, Snowflake,
  Volume2, Droplet, PowerOff, Wind, Settings, MoreHorizontal, Camera, X,
  Pencil, MapPin, AlertTriangle, Plus, ChevronDown, CalendarDays, Sun,
  CloudSun, Moon, Phone, MessageCircle, Sparkles, Info,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useService, PRIORITY_INFO, priorityFromServiceStatus } from '@/store/serviceStore';
import { useToast } from '@/components/ui/Toast';
import {
  properties as propertiesApi,
  tickets as ticketsApi,
} from '@/lib/api';
import { TIME_SLOTS, PROBLEM_CATEGORIES, slotLabel } from '@/lib/constants';
import { lookupErrorCode } from '@/lib/errorCodes';
import AppTopBar from '@/components/ui/AppTopBar';
import StepIndicator from '@/components/ui/StepIndicator';
import DayPicker from '@/components/ui/DayPicker';
import PriorityBadge from '@/components/ui/PriorityBadge';
import styles from './ticket.module.css';

const TOTAL_STEPS = 4;
const SLOT_ICONS = { MORNING: Sun, AFTERNOON: CloudSun, EVENING: Moon };

const PROBLEM_ICON = {
  NOT_COOLING: Snowflake,
  NOISE: Volume2,
  LEAKING: Droplet,
  NOT_TURNING_ON: PowerOff,
  NO_AIRFLOW: Wind,
  REMOTE_WIFI: Settings,
  OTHER: MoreHorizontal,
};

const DURATIONS = ['Today', '2-3 Days', 'This Week', 'Over a Week'];

const stepVariants = {
  initial: (dir) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
  enter:   { x: 0, opacity: 1, transition: { duration: 0.22 } },
  exit:    (dir) => ({ x: dir > 0 ? -24 : 24, opacity: 0, transition: { duration: 0.18 } }),
};

const acStatusBadge = (status) => {
  switch (status) {
    case 'P1_AMC':      return { label: 'AMC Covered',   tone: 'amc' };
    case 'P2_WARRANTY': return { label: 'In Warranty',   tone: 'warranty' };
    case 'P3_PAID':     return { label: 'Out of Warranty', tone: 'paid' };
    default:            return { label: 'Unknown',       tone: 'neutral' };
  }
};

export default function ServiceTicketWizardPage() {
  return (
    <Suspense fallback={<div className="loading-page"><div className="spinner" /></div>}>
      <ServiceTicketWizard />
    </Suspense>
  );
}

function ServiceTicketWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { state, set, reset, hydrated } = useService();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [propertiesList, setPropertiesList] = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [activePropertyId, setActivePropertyId] = useState(null);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/services/ticket'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router]);

  // Pre-fetch properties + AC units once
  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;
    let cancelled = false;
    (async () => {
      try {
        const list = await propertiesApi.list();
        const arr = Array.isArray(list) ? list : [];
        // Each property already includes acUnits (PropertyResponse.acUnits)
        if (cancelled) return;
        setPropertiesList(arr);
        // Default-active property: first one with AC units, else first.
        const firstWithUnits = arr.find((p) => (p.acUnits?.length ?? 0) > 0);
        const initial = firstWithUnits || arr[0];
        if (initial) setActivePropertyId(initial.id);
        // Re-hydrate cached AC unit metadata if our store holds an acUnitId
        if (state.acUnitId) {
          const found = arr.flatMap((p) => (p.acUnits || []).map((u) => ({ ...u, propertyLabel: p.label, propertyId: p.id })))
            .find((u) => u.id === state.acUnitId);
          if (found) {
            set({
              acUnitMeta: {
                roomLabel: found.roomLabel,
                brand: found.brand,
                modelNumber: found.modelNumber,
                acType: found.acType,
                tonnage: found.tonnage,
                serviceStatus: found.serviceStatus,
                propertyId: found.propertyId,
                propertyLabel: found.propertyLabel,
              },
            });
            setActivePropertyId(found.propertyId);
          }
        }
      } catch {
        if (!cancelled) toast.error('Could not load your properties.');
      } finally {
        if (!cancelled) setPropertiesLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Honour ?step=N when returning from Error Code Reference
  useEffect(() => {
    if (!hydrated) return;
    const stepParam = searchParams.get('step');
    const codeParam = searchParams.get('code');
    if (stepParam) {
      const n = Number(stepParam);
      if (n >= 1 && n <= TOTAL_STEPS) setStep(n);
    }
    if (codeParam) {
      set({ errorCode: codeParam.toUpperCase() });
      // strip the param so subsequent navigation doesn't keep re-applying it
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('step');
      window.history.replaceState({}, '', url.toString());
    }
  }, [hydrated, searchParams, set]);

  const goNext = () => {
    if (step < TOTAL_STEPS) { setDirection(1); setStep((s) => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  const goBack = () => {
    if (step > 1) { setDirection(-1); setStep((s) => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else router.back();
  };
  const goToStep = (n) => { setDirection(n > step ? 1 : -1); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // Validation per step
  const step1Valid = !!state.priorityHint;
  const step2Valid = !!state.acUnitId;
  const step3Valid = !!state.problemCategory;
  const step4Valid = !!state.scheduledDate && !!state.scheduledSlot;
  const stepValid = [step1Valid, step2Valid, step3Valid, step4Valid][step - 1];

  // The displayed priority once an AC unit is selected derives from its serviceStatus;
  // before an AC is selected we use the user-tapped priorityHint from step 1.
  const effectivePriority =
    (state.acUnitMeta && priorityFromServiceStatus(state.acUnitMeta.serviceStatus)) || state.priorityHint;

  const allACs = useMemo(() => {
    const out = [];
    propertiesList.forEach((p) => {
      (p.acUnits || []).forEach((u) => out.push({
        ...u,
        propertyId: p.id,
        propertyLabel: p.label,
      }));
    });
    return out;
  }, [propertiesList]);

  const acUnitsForActiveProperty = useMemo(() => {
    if (!activePropertyId) return [];
    return allACs.filter((u) => u.propertyId === activePropertyId);
  }, [allACs, activePropertyId]);

  const activeProperty = useMemo(
    () => propertiesList.find((p) => p.id === activePropertyId) || null,
    [propertiesList, activePropertyId]
  );

  // Submit
  const handleSubmit = async () => {
    if (!step4Valid || !state.acUnitId) return;
    setSubmitting(true);
    try {
      const description = [
        state.duration ? `Duration: ${state.duration}` : null,
        state.description?.trim() ? state.description.trim() : null,
      ].filter(Boolean).join('\n');
      const payload = {
        acUnitId: state.acUnitId,
        problemCategory: state.problemCategory,
        errorCode: state.errorCode?.trim() ? state.errorCode.trim().toUpperCase() : null,
        problemDescription: description || null,
        photoUrls: state.photoUrls?.length ? state.photoUrls : [],
        scheduledDate: state.scheduledDate,
        scheduledSlot: state.scheduledSlot,
      };
      const res = await ticketsApi.create(payload);
      setSubmittedTicket(res);
      reset();
      toast.success('Service ticket raised.');
    } catch (err) {
      toast.error(err.message || 'Could not raise ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user || !hydrated) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  if (submittedTicket) {
    return <SuccessScreen ticket={submittedTicket} onHome={() => router.replace('/dashboard')} />;
  }

  return (
    <div className={styles.shell}>
      <AppTopBar
        title="Service Request"
        onBack={goBack}
        right={
          <div className={styles.topRight}>
            {effectivePriority && <PriorityBadge priority={effectivePriority} dense />}
            <StepIndicator current={step} total={TOTAL_STEPS} />
          </div>
        }
      />

      <div className={styles.body}>
        <AnimatePresence custom={direction} mode="wait" initial={false}>
          {step === 1 && (
            <motion.section key="s1" custom={direction} variants={stepVariants}
              initial="initial" animate="enter" exit="exit" className={styles.stepBody}>
              <Step1Priority value={state.priorityHint} onChange={(v) => set({ priorityHint: v })} />
            </motion.section>
          )}

          {step === 2 && (
            <motion.section key="s2" custom={direction} variants={stepVariants}
              initial="initial" animate="enter" exit="exit" className={styles.stepBody}>
              <Step2SelectAc
                loading={propertiesLoading}
                properties={propertiesList}
                activeProperty={activeProperty}
                acUnits={acUnitsForActiveProperty}
                onPickProperty={setActivePropertyId}
                selectedId={state.acUnitId}
                onSelect={(unit) => {
                  set({
                    acUnitId: unit.id,
                    acUnitMeta: {
                      roomLabel: unit.roomLabel,
                      brand: unit.brand,
                      modelNumber: unit.modelNumber,
                      acType: unit.acType,
                      tonnage: unit.tonnage,
                      serviceStatus: unit.serviceStatus,
                      propertyId: unit.propertyId,
                      propertyLabel: unit.propertyLabel,
                    },
                    priorityHint: priorityFromServiceStatus(unit.serviceStatus) || state.priorityHint,
                  });
                  goNext();
                }}
              />
            </motion.section>
          )}

          {step === 3 && (
            <motion.section key="s3" custom={direction} variants={stepVariants}
              initial="initial" animate="enter" exit="exit" className={styles.stepBody}>
              <Step3Problem
                priority={effectivePriority}
                acMeta={state.acUnitMeta}
                value={state}
                onChange={set}
              />
            </motion.section>
          )}

          {step === 4 && (
            <motion.section key="s4" custom={direction} variants={stepVariants}
              initial="initial" animate="enter" exit="exit" className={styles.stepBody}>
              <Step4Schedule
                priority={effectivePriority}
                acMeta={state.acUnitMeta}
                state={state}
                set={set}
                onEdit={(target) => {
                  if (target === 'ac') goToStep(2);
                  if (target === 'problem') goToStep(3);
                }}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.actionBar}>
        <div className={styles.actionInner}>
          {step === 4 ? (
            <button
              className="btn btn-primary btn-full btn-lg"
              disabled={!step4Valid || submitting}
              onClick={handleSubmit}
            >
              {submitting ? <span className="spinner spinner-sm" /> : (
                <>Raise Service Ticket <ArrowRight size={18} /></>
              )}
            </button>
          ) : step === 2 ? (
            <p className={styles.tipFootnote}>
              Tap an AC unit to continue
            </p>
          ) : (
            <button
              className="btn btn-primary btn-full btn-lg"
              disabled={!stepValid}
              onClick={goNext}
            >
              Continue <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1 — Priority overview ────────────────────────── */
function Step1Priority({ value, onChange }) {
  const router = useRouter();
  return (
    <>
      <div className={styles.heading}>
        <h2>What type of service do you have?</h2>
        <p>This determines your priority and service charges.</p>
      </div>

      <div className={styles.priorityStack}>
        <PriorityCard
          tone="amc"
          accentClass={styles.cardAmc}
          eyebrow={PRIORITY_INFO.P1.badge}
          title={PRIORITY_INFO.P1.headline}
          icon={<ShieldCheck size={26} />}
          desc={PRIORITY_INFO.P1.desc}
          chips={PRIORITY_INFO.P1.chips}
          cta={PRIORITY_INFO.P1.cta}
          selected={value === 'P1'}
          onSelect={() => { onChange('P1'); requestAnimationFrame(() => router.refresh?.()); }}
        />
        <PriorityCard
          tone="warranty"
          accentClass={styles.cardWarranty}
          eyebrow={PRIORITY_INFO.P2.badge}
          title={PRIORITY_INFO.P2.headline}
          icon={<Award size={26} />}
          desc={PRIORITY_INFO.P2.desc}
          chips={PRIORITY_INFO.P2.chips}
          cta={PRIORITY_INFO.P2.cta}
          selected={value === 'P2'}
          onSelect={() => onChange('P2')}
        />
        <PriorityCard
          tone="paid"
          accentClass={styles.cardPaid}
          eyebrow={PRIORITY_INFO.P3.badge}
          title={PRIORITY_INFO.P3.headline}
          icon={<Wrench size={26} />}
          desc={PRIORITY_INFO.P3.desc}
          chips={PRIORITY_INFO.P3.chips}
          cta={PRIORITY_INFO.P3.cta}
          selected={value === 'P3'}
          onSelect={() => onChange('P3')}
          dark
        />
      </div>

      <p className={styles.tipFootnote}>
        Not sure? Our team will verify your contract status upon assignment.
      </p>
    </>
  );
}

function PriorityCard({
  tone, accentClass, eyebrow, title, icon, desc, chips, cta, selected, onSelect, dark = false,
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.99 }}
      className={`${styles.priorityCard} ${accentClass} ${selected ? styles.priorityCardSelected : ''} ${dark ? styles.priorityCardDark : ''}`}
    >
      <div className={styles.priorityCardHead}>
        <span className={styles.priorityEyebrow}>{eyebrow}</span>
        <span className={styles.priorityIcon}>{icon}</span>
      </div>
      <h3 className={styles.priorityTitle}>{title}</h3>
      <p className={styles.priorityDesc}>{desc}</p>
      <div className={styles.priorityChipRow}>
        {chips.map((c) => (
          <span key={c} className={styles.priorityChip}>
            <Check size={12} strokeWidth={3} /> {c}
          </span>
        ))}
      </div>
      <div className={styles.priorityCta}>
        {selected ? (
          <><Check size={16} strokeWidth={3} /> Selected — Tap Continue</>
        ) : (
          <>{cta} <ArrowRight size={16} /></>
        )}
      </div>
    </motion.button>
  );
}

/* ─── Step 2 — Select AC unit ───────────────────────────── */
function Step2SelectAc({
  loading, properties, activeProperty, acUnits, onPickProperty, selectedId, onSelect,
}) {
  const [showPropertySheet, setShowPropertySheet] = useState(false);
  if (loading) {
    return (
      <div className={styles.skeletonStack}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 96 }} />
        ))}
      </div>
    );
  }

  if (!properties.length) {
    return (
      <div className={styles.emptyState}>
        <Snowflake size={36} color="var(--secondary)" />
        <h3>No properties yet</h3>
        <p>Add a property and an AC unit before raising a service request.</p>
        <Link href="/dashboard" className="btn btn-primary">Back to Home</Link>
      </div>
    );
  }

  return (
    <>
      <div className={styles.headingTight}>
        <button
          type="button"
          className={styles.propertyTrigger}
          onClick={() => setShowPropertySheet(true)}
          disabled={properties.length <= 1}
        >
          <MapPin size={16} />
          <span className={styles.propertyTriggerLabel}>
            {activeProperty?.label || 'Pick a property'}
          </span>
          {properties.length > 1 && <ChevronDown size={16} />}
        </button>
        <h2>Which AC needs service?</h2>
      </div>

      <div className={styles.acList}>
        {acUnits.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No AC units on this property</h3>
            <p>Add an AC unit on this property to raise a service ticket.</p>
          </div>
        ) : (
          acUnits.map((u) => {
            const status = acStatusBadge(u.serviceStatus);
            const selected = selectedId === u.id;
            return (
              <motion.button
                key={u.id}
                type="button"
                onClick={() => onSelect(u)}
                whileTap={{ scale: 0.99 }}
                className={`${styles.acCard} ${selected ? styles.acCardSelected : ''}`}
              >
                <div className={`${styles.acIconWrap} ${styles[`tone_${status.tone}`]}`}>
                  <Snowflake size={26} />
                </div>
                <div className={styles.acBody}>
                  <div className={styles.acTopRow}>
                    <h4 className={styles.acRoom}>{u.roomLabel}</h4>
                    <span className={`${styles.acStatusPill} ${styles[`pill_${status.tone}`]}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className={styles.acMeta}>
                    {u.brand} {u.modelNumber || ''}
                  </p>
                  <p className={styles.acMetaSub}>
                    {labelForAcType(u.acType)} · {Number(u.tonnage).toFixed(1)} Ton
                  </p>
                  <span className={styles.acCta}>
                    {selected ? <>Selected <Check size={14} strokeWidth={3} /></> : <>Select for service <ArrowRight size={14} /></>}
                  </span>
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      <Link href="/dashboard" className={styles.outlineBtn}>
        <Plus size={16} /> Add a new AC unit
      </Link>

      <AnimatePresence>
        {showPropertySheet && (
          <PropertySheet
            properties={properties}
            activeId={activeProperty?.id}
            onPick={(id) => { onPickProperty(id); setShowPropertySheet(false); }}
            onClose={() => setShowPropertySheet(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function PropertySheet({ properties, activeId, onPick, onClose }) {
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
        <h3 className={styles.sheetTitle}>Choose a property</h3>
        <div className={styles.sheetList}>
          {properties.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.sheetItem} ${p.id === activeId ? styles.sheetItemActive : ''}`}
              onClick={() => onPick(p.id)}
            >
              <div>
                <span className={styles.sheetItemLabel}>{p.label}</span>
                <span className={styles.sheetItemSub}>
                  {[p.addressLine1, p.city].filter(Boolean).join(', ')}
                </span>
              </div>
              {p.id === activeId && <Check size={18} color="var(--secondary)" />}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Step 3 — Problem description ──────────────────────── */
function Step3Problem({ priority, acMeta, value, onChange }) {
  const [photoCount, setPhotoCount] = useState(value.photoUrls?.length || 0);
  const lookup = lookupErrorCode(value.errorCode);

  const handleFiles = (files) => {
    const remaining = 4 - (value.photoUrls?.length || 0);
    const list = Array.from(files).slice(0, remaining);
    if (!list.length) return;
    Promise.all(list.map((f) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(f);
    }))).then((dataUrls) => {
      const next = [...(value.photoUrls || []), ...dataUrls].slice(0, 4);
      onChange({ photoUrls: next });
      setPhotoCount(next.length);
    });
  };

  const removePhoto = (i) => {
    const next = (value.photoUrls || []).filter((_, idx) => idx !== i);
    onChange({ photoUrls: next });
    setPhotoCount(next.length);
  };

  return (
    <>
      {acMeta && (
        <div className={styles.contextStrip}>
          <Snowflake size={14} />
          <span>
            <strong>{acMeta.roomLabel}</strong> · {acMeta.brand} {acMeta.modelNumber || ''} · {Number(acMeta.tonnage).toFixed(1)}T {labelForAcType(acMeta.acType)}
          </span>
        </div>
      )}

      <div className={styles.heading}>
        <h2>What&apos;s the problem?</h2>
        <p>Select the issue that best matches your observation.</p>
      </div>

      <div className={styles.problemGrid}>
        {PROBLEM_CATEGORIES.map(({ value: cat, label }) => {
          const Icon = PROBLEM_ICON[cat] || MoreHorizontal;
          const selected = value.problemCategory === cat;
          return (
            <motion.button
              key={cat}
              type="button"
              onClick={() => onChange({ problemCategory: cat })}
              whileTap={{ scale: 0.97 }}
              className={`${styles.problemTile} ${selected ? styles.problemTileSelected : ''}`}
            >
              {selected && <span className={styles.problemTick}><Check size={12} strokeWidth={3} /></span>}
              <span className={`${styles.problemIcon} ${selected ? styles.problemIconSelected : ''}`}>
                <Icon size={20} strokeWidth={2} />
              </span>
              <span className={styles.problemLabel}>{label}</span>
            </motion.button>
          );
        })}
      </div>

      <div className={styles.divider} />

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="errorCode">Error Code (if any)</label>
        <input
          id="errorCode"
          className={`input ${styles.errorCodeInput}`}
          placeholder="e.g. E1, H6, P1..."
          value={value.errorCode}
          onChange={(e) => onChange({ errorCode: e.target.value.toUpperCase() })}
          maxLength={10}
        />
        <Link href="/services/error-codes?from=wizard" className={styles.helperLink}>
          <Info size={14} /> View common error codes
        </Link>
        {lookup && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={styles.codeMatchCard}
          >
            <div className={styles.codeMatchHead}>
              <span className={styles.codePill}>{lookup.code}</span>
              <span className={styles.codeMatchTitle}>{lookup.title}</span>
              <span className={`${styles.codeMatchSeverity} ${lookup.severity === 'TECH' ? styles.codeSevTech : styles.codeSevReset}`}>
                <span className={styles.codeSevDot} /> {lookup.severity === 'TECH' ? 'Requires Tech' : 'Try Reset First'}
              </span>
            </div>
            <p className={styles.codeMatchDesc}>{lookup.desc}</p>
            <div className={styles.codeMatchTip}>
              <Sparkles size={14} /> {lookup.tip}
            </div>
          </motion.div>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>How long has this been happening?</label>
        <div className={styles.chipScroll}>
          {DURATIONS.map((d) => {
            const selected = value.duration === d;
            return (
              <button
                key={d}
                type="button"
                className={`${styles.durationChip} ${selected ? styles.durationChipActive : ''}`}
                onClick={() => onChange({ duration: selected ? '' : d })}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="description">Additional Details</label>
        <textarea
          id="description"
          className={`input textarea ${styles.descTextarea}`}
          rows={4}
          maxLength={1500}
          placeholder="Describe any specific noises, smells or patterns you have noticed..."
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <span className={styles.charCount}>{value.description?.length || 0}/1500</span>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldLabelRow}>
          <label className={styles.fieldLabel}>Attach Photos (Optional)</label>
          <span className={styles.charCount}>{photoCount}/4</span>
        </div>
        <div className={styles.photoGrid}>
          {(value.photoUrls || []).map((src, i) => (
            <div key={i} className={styles.photoTile}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Attached photo ${i + 1}`} />
              <button type="button" className={styles.photoRemove} onClick={() => removePhoto(i)} aria-label="Remove photo">
                <X size={14} />
              </button>
            </div>
          ))}
          {photoCount < 4 && (
            <label className={styles.photoAdd}>
              <Camera size={20} />
              <span>Add Photo</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Step 4 — Schedule & Confirm ───────────────────────── */
function Step4Schedule({ priority, acMeta, state, set, onEdit }) {
  const info = priority ? PRIORITY_INFO[priority] : null;

  return (
    <>
      {info && (
        <div className={`${styles.priorityBanner} ${styles[`banner_${info.accent}`]}`}>
          <span className={styles.priorityBannerIcon}>
            {priority === 'P1' && <ShieldCheck size={20} />}
            {priority === 'P2' && <Award size={20} />}
            {priority === 'P3' && <Wrench size={20} />}
          </span>
          <div>
            <strong>{info.badge}</strong>
            <span>{info.sla} · {info.headline}</span>
          </div>
        </div>
      )}

      <section className={styles.summaryCard}>
        <div className={styles.summaryHead}>
          <h3>Service Summary</h3>
        </div>
        <SummaryRow
          icon={<MapPin size={18} />}
          label="Property"
          value={acMeta?.propertyLabel || '—'}
          onEdit={() => onEdit('ac')}
        />
        <SummaryRow
          icon={<Snowflake size={18} />}
          label="AC Unit"
          value={acMeta ? `${acMeta.brand} ${acMeta.modelNumber || ''} · ${acMeta.roomLabel}` : '—'}
          onEdit={() => onEdit('ac')}
        />
        <SummaryRow
          icon={<AlertTriangle size={18} />}
          label="Problem"
          value={[
            problemLabel(state.problemCategory),
            state.errorCode ? `Code ${state.errorCode}` : null,
          ].filter(Boolean).join(' + ') || 'Not set'}
          onEdit={() => onEdit('problem')}
        />
      </section>

      <section className={styles.scheduleSection}>
        <h3 className={styles.sectionHeading}>Select Date &amp; Time</h3>
        <DayPicker
          value={state.scheduledDate}
          onChange={(iso) => set({ scheduledDate: iso })}
          days={14}
        />
        <div className={styles.slotGrid}>
          {TIME_SLOTS.map(({ value: v, label, range, tag }) => {
            const Icon = SLOT_ICONS[v];
            const selected = state.scheduledSlot === v;
            return (
              <motion.button
                key={v}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => set({ scheduledSlot: v })}
                className={`${styles.slotCard} ${selected ? styles.slotCardSelected : ''}`}
              >
                <Icon size={18} />
                <span className={styles.slotLabel}>{label}</span>
                <span className={styles.slotRange}>{range}</span>
                {tag && <span className={styles.slotTag}>{tag}</span>}
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className={styles.whatsNext}>
        <h3 className={styles.sectionHeading}>
          <Info size={16} /> What Happens Next
        </h3>
        <ul className={styles.timeline}>
          <li>Ticket generated &amp; assigned to available technician</li>
          <li>Technician confirms dispatch time via app</li>
          <li>Service performed and documented</li>
          <li>Review and closure</li>
        </ul>
      </section>

      {info && (
        <div className={`${styles.chargeNote} ${styles[`charge_${info.chargeTone}`]}`}>
          {info.chargeTone === 'success' ? <Check size={18} /> : <CalendarDays size={18} />}
          <p>{info.chargeNote}</p>
        </div>
      )}
    </>
  );
}

function SummaryRow({ icon, label, value, onEdit }) {
  return (
    <div className={styles.summaryRow}>
      <span className={styles.summaryIcon}>{icon}</span>
      <div>
        <span className={styles.summaryLabel}>{label}</span>
        <span className={styles.summaryValue}>{value}</span>
      </div>
      <button type="button" className={styles.summaryEdit} onClick={onEdit} aria-label={`Edit ${label}`}>
        <Pencil size={14} />
      </button>
    </div>
  );
}

/* ─── Success ───────────────────────────────────────────── */
function SuccessScreen({ ticket, onHome }) {
  const router = useRouter();
  return (
    <div className={styles.shell}>
      <div className={styles.successInner}>
        <motion.div
          className={styles.successRing}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
        >
          <Check size={44} strokeWidth={3} />
        </motion.div>
        <motion.h2
          className={styles.successTitle}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Ticket Raised!
        </motion.h2>
        <motion.span
          className={styles.successNumber}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
        >
          {ticket.ticketNumber}
        </motion.span>

        <motion.div
          className={styles.successInfo}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <CalendarDays size={16} />
          <span>
            Visit scheduled for <strong>{prettyDate(ticket.scheduledDate)}</strong>
            {ticket.scheduledSlot ? <> · {slotLabel(ticket.scheduledSlot)}</> : null}
          </span>
        </motion.div>

        <motion.ul
          className={styles.successTimeline}
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } } }}
        >
          {[
            { state: 'done',    label: 'Ticket received' },
            { state: 'active',  label: 'CRM team responding (within 30 min)' },
            { state: 'pending', label: 'Technician dispatched on scheduled date' },
            { state: 'pending', label: 'Service performed and closed out' },
          ].map((it, i) => (
            <motion.li
              key={i}
              variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
              className={styles[`successItem_${it.state}`]}
            >
              <span className={styles.successItemDot}>
                {it.state === 'done' && <Check size={12} strokeWidth={3} />}
              </span>
              <span>{it.label}</span>
            </motion.li>
          ))}
        </motion.ul>

        <div className={styles.successContact}>
          <p>Need to update us before the visit?</p>
          <div className={styles.successContactRow}>
            <a href="tel:+914023540000" className={styles.contactBtn}><Phone size={14} /> Call AES</a>
            <a href="https://wa.me/914023540000" className={styles.contactBtn}><MessageCircle size={14} /> WhatsApp</a>
          </div>
        </div>

        <div className={styles.successCtaRow}>
          <button
            className="btn btn-outline btn-full"
            onClick={() => router.replace(`/tickets/${ticket.ticketNumber}`)}
          >
            Track This Ticket
          </button>
          <button
            className="btn btn-primary btn-full"
            onClick={onHome}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────── */
function labelForAcType(t) {
  const map = {
    SPLIT: 'Split AC', CASSETTE: 'Cassette', CENTRAL: 'Central / Ducted',
    VRF_VRV: 'VRF / VRV', WINDOW: 'Window', PORTABLE: 'Portable',
  };
  return map[t] || t;
}

function problemLabel(category) {
  const found = PROBLEM_CATEGORIES.find((p) => p.value === category);
  return found?.label || (category ? category : '');
}

function prettyDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
