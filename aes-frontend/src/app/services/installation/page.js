'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Plus, X, MapPin, Home, Building2, ChevronDown,
  Sun, CloudSun, Moon, Pencil, ShieldCheck, Sparkles, ArrowLeft,
  Snowflake, CalendarDays, Lightbulb, Phone, MessageCircle,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useInstall, INSTALL_STEPS } from '@/store/installationStore';
import { useToast } from '@/components/ui/Toast';
import { properties as propertiesApi, installations as installationsApi } from '@/lib/api';
import {
  AC_TYPES, BRANDS, TONNAGES, ENERGY_RATINGS, SUGGESTED_MODELS,
  ROOM_TYPES, TIME_SLOTS, slotLabel, acTypeLabel,
} from '@/lib/constants';
import AppTopBar from '@/components/ui/AppTopBar';
import StepIndicator from '@/components/ui/StepIndicator';
import DayPicker from '@/components/ui/DayPicker';
import AcTypeIcon from '@/components/ui/AcTypeIcon';
import styles from './installation.module.css';

const TOTAL_STEPS = 4;
const SLOT_ICONS = { MORNING: Sun, AFTERNOON: CloudSun, EVENING: Moon };

const stepVariants = {
  initial: (dir) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
  enter: { x: 0, opacity: 1, transition: { duration: 0.22 } },
  exit: (dir) => ({ x: dir > 0 ? -24 : 24, opacity: 0, transition: { duration: 0.18 } }),
};

export default function InstallationWizard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { state, set, reset, addRoom, updateRoom, removeRoom, hydrated } = useInstall();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [propertyList, setPropertyList] = useState([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/services/installation'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router]);

  // Pre-load properties for step 3
  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;
    propertiesApi.list().then((res) => {
      const arr = Array.isArray(res) ? res : [];
      setPropertyList(arr);
      // Auto-select first property if none chosen yet
      if (arr.length > 0 && !state.propertyId && !state.propertyAddress) {
        set({ propertyId: arr[0].id });
      }
    }).catch(() => { /* silent */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const goNext = () => {
    if (step < TOTAL_STEPS) { setDirection(1); setStep((s) => s + 1); }
  };
  const goBack = () => {
    if (step > 1) { setDirection(-1); setStep((s) => s - 1); }
    else router.back();
  };

  // ─── Validations per step ──────────────────────────────
  const step1Valid = !!state.acType;
  const step2Valid = !!state.brand;
  const step3Valid = useMemo(() => {
    if (!state.propertyId && !state.propertyAddress?.trim()) return false;
    if (state.rooms.length === 0) return false;
    return state.rooms.every((r) =>
      r.roomType && r.acType && r.sizeSqft && Number(r.sizeSqft) > 0
    );
  }, [state]);
  const step4Valid = !!state.scheduledDate && !!state.scheduledSlot;

  const stepValid = [step1Valid, step2Valid, step3Valid, step4Valid][step - 1];

  // ─── Submit ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!step4Valid) return;
    setSubmitting(true);
    try {
      const payload = {
        propertyId: state.propertyId || null,
        propertyAddress: !state.propertyId ? state.propertyAddress?.trim() || null : null,
        acType: state.acType,
        brand: state.brand || null,
        modelNumber: state.modelNumber || null,
        tonnage: state.tonnage ? Number(state.tonnage) : null,
        energyRating: state.energyRating ? Number(state.energyRating) : null,
        rooms: state.rooms.map((r) => ({
          roomType: r.roomType,
          sizeSqft: Number(r.sizeSqft),
          acType: r.acType || state.acType,
        })),
        notes: state.notes?.trim() || null,
        scheduledDate: state.scheduledDate,
        scheduledSlot: state.scheduledSlot,
      };
      const res = await installationsApi.create(payload);
      setSubmittedRequest(res);
      reset();
      toast.success('Installation request submitted.');
    } catch (err) {
      toast.error(err.message || 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user || !hydrated) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  // Success page
  if (submittedRequest) {
    return <SuccessScreen request={submittedRequest} onHome={() => router.replace('/dashboard')} />;
  }

  return (
    <div className={styles.shell}>
      <AppTopBar
        title="New Installation"
        onBack={goBack}
        right={<StepIndicator current={step} total={TOTAL_STEPS} />}
      />

      <div className={styles.body}>
        <AnimatePresence custom={direction} mode="wait" initial={false}>
          {step === 1 && (
            <motion.section
              key="s1"
              custom={direction}
              variants={stepVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className={styles.stepBody}
            >
              <Step1
                value={state.acType}
                onChange={(v) => set({ acType: v })}
              />
            </motion.section>
          )}

          {step === 2 && (
            <motion.section
              key="s2"
              custom={direction}
              variants={stepVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className={styles.stepBody}
            >
              <Step2 state={state} set={set} />
            </motion.section>
          )}

          {step === 3 && (
            <motion.section
              key="s3"
              custom={direction}
              variants={stepVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className={styles.stepBody}
            >
              <Step3
                state={state}
                set={set}
                addRoom={addRoom}
                updateRoom={updateRoom}
                removeRoom={removeRoom}
                propertyList={propertyList}
                showAddAddress={showAddAddress}
                setShowAddAddress={setShowAddAddress}
              />
            </motion.section>
          )}

          {step === 4 && (
            <motion.section
              key="s4"
              custom={direction}
              variants={stepVariants}
              initial="initial"
              animate="enter"
              exit="exit"
              className={styles.stepBody}
            >
              <Step4
                state={state}
                set={set}
                propertyList={propertyList}
                onEdit={(idx) => { setDirection(-1); setStep(idx); }}
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
                <>Submit Request <ArrowRight size={18} /></>
              )}
            </button>
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

/* ─── Step 1 — AC Type ────────────────────────────────── */
function Step1({ value, onChange }) {
  return (
    <>
      <Heading title="What type of AC do you need?" sub="Choose based on your space requirements." />
      <div className={styles.acTypeGrid}>
        {AC_TYPES.map((t) => {
          const selected = value === t.value;
          return (
            <motion.button
              key={t.value}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(t.value)}
              className={`${styles.acTypeCard} ${selected ? styles.acTypeSelected : ''}`}
            >
              {selected && (
                <span className={styles.checkBadge}><Check size={14} strokeWidth={3} /></span>
              )}
              <div className={styles.acTypeIcon}>
                <AcTypeIcon type={t.value} size={22} />
              </div>
              <div>
                <h4 className={styles.acTypeName}>{t.label}</h4>
                <p className={styles.acTypeDesc}>{t.desc}</p>
                <span className={styles.acTypeRange}>{t.range}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </>
  );
}

/* ─── Step 2 — Brand & Model ──────────────────────────── */
function Step2({ state, set }) {
  const filteredModels = useMemo(
    () => SUGGESTED_MODELS.filter(
      (m) => m.brand === state.brand && m.tonnage === state.tonnage
    ),
    [state.brand, state.tonnage]
  );

  return (
    <>
      <SectionLabel>Select Brand</SectionLabel>
      <div className={styles.brandGrid}>
        {BRANDS.map((b) => {
          const selected = state.brand === b;
          return (
            <button
              key={b}
              type="button"
              className={`${styles.brandTile} ${selected ? styles.brandSelected : ''}`}
              onClick={() => set({ brand: b, modelNumber: '' })}
            >
              {selected && (
                <span className={styles.brandCheck}><Check size={12} strokeWidth={3} /></span>
              )}
              <span>{b}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.linkButton} onClick={() => set({ brand: 'Other' })}>
        <Plus size={14} /> Other brand
      </button>

      <SectionLabel>Capacity (Tonnage)</SectionLabel>
      <div className={styles.chipScroll}>
        {TONNAGES.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.chipPill} ${state.tonnage === t ? styles.chipPillActive : ''}`}
            onClick={() => set({ tonnage: t, modelNumber: '' })}
          >
            {t}T
          </button>
        ))}
      </div>

      <SectionLabel>Energy Rating</SectionLabel>
      <div className={styles.chipScroll}>
        {ENERGY_RATINGS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`${styles.ratingChip} ${state.energyRating === value ? styles.ratingChipActive : ''} ${value === 5 ? styles.ratingChipGold : ''}`}
            onClick={() => set({ energyRating: value })}
          >
            {label}
            <span className={styles.starRow}>
              {Array.from({ length: value }).map((_, i) => (
                <span key={i}>★</span>
              ))}
            </span>
          </button>
        ))}
      </div>

      {state.brand && state.brand !== 'Other' && (
        <>
          <SectionLabel
            right={filteredModels.length > 0 ? <span className={styles.swipeHint}>Swipe to view more</span> : null}
          >
            Suggested Models
          </SectionLabel>
          {filteredModels.length === 0 ? (
            <p className={styles.muted}>
              No suggested models for {state.brand} {state.tonnage}T. Our engineer will recommend the best fit during the site visit.
            </p>
          ) : (
            <div className={styles.modelScroll}>
              {filteredModels.map((m) => {
                const selected = state.modelNumber === m.model;
                return (
                  <div key={m.model} className={`${styles.modelCard} ${selected ? styles.modelCardSelected : ''}`}>
                    <span className={styles.modelEyebrow}>{m.model}</span>
                    <h4 className={styles.modelTitle}>
                      {m.brand} {m.tonnage}T {m.features.includes('Inverter') ? 'Inverter' : ''} Split AC
                    </h4>
                    <span className={styles.modelPrice}>{m.price} <span className={styles.modelPriceSub}>onwards</span></span>
                    <div className={styles.modelFeatures}>
                      {m.features.map((f) => (
                        <span key={f} className={styles.modelFeature}>{f}</span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={`${styles.modelButton} ${selected ? styles.modelButtonSelected : ''}`}
                      onClick={() => set({ modelNumber: selected ? '' : m.model })}
                    >
                      {selected ? (
                        <><Check size={14} strokeWidth={3} /> Selected</>
                      ) : 'Select Model'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ─── Step 3 — Property & Rooms ───────────────────────── */
function Step3({
  state, set, addRoom, updateRoom, removeRoom,
  propertyList, showAddAddress, setShowAddAddress,
}) {
  const [propertyType, setPropertyType] = useState('RESIDENTIAL');

  return (
    <>
      <Heading
        title="Where do you need installation?"
        sub="Pick from your saved properties or add a new address."
      />

      <div className={styles.segment} role="tablist">
        <button
          role="tab"
          aria-selected={propertyType === 'RESIDENTIAL'}
          className={`${styles.segmentButton} ${propertyType === 'RESIDENTIAL' ? styles.segmentActive : ''}`}
          onClick={() => setPropertyType('RESIDENTIAL')}
        >
          <Home size={14} /> Residential
        </button>
        <button
          role="tab"
          aria-selected={propertyType === 'COMMERCIAL'}
          className={`${styles.segmentButton} ${propertyType === 'COMMERCIAL' ? styles.segmentActive : ''}`}
          onClick={() => setPropertyType('COMMERCIAL')}
        >
          <Building2 size={14} /> Commercial / Office
        </button>
        <span
          className={styles.segmentIndicator}
          style={{ transform: `translateX(${propertyType === 'COMMERCIAL' ? '100%' : '0%'})` }}
        />
      </div>

      <SectionLabel>Installation Address</SectionLabel>
      {propertyList.length > 0 ? (
        <div className={styles.propertyList}>
          {propertyList.map((p) => {
            const selected = state.propertyId === p.id && !showAddAddress;
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.propertyCard} ${selected ? styles.propertySelected : ''}`}
                onClick={() => { set({ propertyId: p.id, propertyAddress: '' }); setShowAddAddress(false); }}
              >
                <div className={styles.propertyIcon}>
                  <MapPin size={18} />
                </div>
                <div className={styles.propertyBody}>
                  <h4>{p.label}</h4>
                  <p>{[p.addressLine1, p.city].filter(Boolean).join(', ')}</p>
                  {p.isPrimary && <span className={styles.primaryTag}>Primary</span>}
                </div>
                {selected && (
                  <span className={styles.propertyCheck}><Check size={16} strokeWidth={3} /></span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className={styles.muted}>You have no saved properties — add a new address below.</p>
      )}

      <button
        type="button"
        className={styles.linkButton}
        onClick={() => {
          const next = !showAddAddress;
          setShowAddAddress(next);
          if (next) set({ propertyId: null });
          else set({ propertyAddress: '' });
        }}
      >
        <Plus size={14} /> {showAddAddress ? 'Cancel' : 'Add new address'}
      </button>

      {(showAddAddress || (propertyList.length === 0 && !state.propertyId)) && (
        <div className="input-group">
          <label htmlFor="address">Address</label>
          <textarea
            id="address"
            className="input textarea"
            placeholder="House / flat number, road, locality, city, PIN"
            value={state.propertyAddress}
            onChange={(e) => set({ propertyAddress: e.target.value })}
            maxLength={500}
          />
        </div>
      )}

      <SectionLabel right={<span className={styles.muted}>{state.rooms.length} room{state.rooms.length === 1 ? '' : 's'}</span>}>
        Room Details
      </SectionLabel>

      <div className={styles.roomList}>
        {state.rooms.map((room, i) => (
          <RoomCard
            key={i}
            index={i}
            room={room}
            canRemove={state.rooms.length > 1}
            onChange={(patch) => updateRoom(i, patch)}
            onRemove={() => removeRoom(i)}
            defaultAcType={state.acType}
          />
        ))}
        <button type="button" className={styles.addRoomBtn} onClick={() => addRoom(state.acType)}>
          <Plus size={16} /> Add another room
        </button>
      </div>

      <SectionLabel>Additional Notes</SectionLabel>
      <div className="input-group">
        <textarea
          className="input textarea"
          placeholder="Concealed wiring, specific unit placement, accessibility notes…"
          value={state.notes}
          onChange={(e) => set({ notes: e.target.value })}
          maxLength={1000}
        />
      </div>
    </>
  );
}

function RoomCard({ index, room, canRemove, onChange, onRemove, defaultAcType }) {
  return (
    <div className={styles.roomCard}>
      <div className={styles.roomHeader}>
        <span className={styles.roomBadge}>Room {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            className={styles.roomRemove}
            onClick={onRemove}
            aria-label={`Remove room ${index + 1}`}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="input-group">
        <label>Room type</label>
        <div className={styles.selectWrap}>
          <select
            className="input select"
            value={room.roomType}
            onChange={(e) => onChange({ roomType: e.target.value })}
          >
            {ROOM_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.roomGrid}>
        <div className="input-group">
          <label>Size (sq ft)</label>
          <input
            className="input"
            type="number"
            min="1"
            max="10000"
            placeholder="200"
            value={room.sizeSqft}
            onChange={(e) => onChange({ sizeSqft: e.target.value.replace(/\D/g, '') })}
          />
        </div>
        <div className="input-group">
          <label>AC type</label>
          <div className={styles.selectWrap}>
            <select
              className="input select"
              value={room.acType || defaultAcType || ''}
              onChange={(e) => onChange({ acType: e.target.value })}
            >
              <option value="" disabled>Select AC type…</option>
              {AC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 4 — Schedule + Confirm ─────────────────────── */
function Step4({ state, set, propertyList, onEdit }) {
  const property = propertyList.find((p) => p.id === state.propertyId);
  const equipment = [
    state.brand,
    state.tonnage ? `${state.tonnage}T` : null,
    acTypeLabel(state.acType),
    state.modelNumber,
  ].filter(Boolean).join(' · ');

  const scheduledLabel = state.scheduledDate
    ? new Date(state.scheduledDate).toLocaleDateString('en-IN', {
        weekday: 'short', day: '2-digit', month: 'short',
      })
    : 'Pick a date';

  return (
    <>
      <Heading title="When should we visit?" sub="Free site visit. We'll provide a detailed quote within 24 hours." />

      <div className={styles.infoBanner}>
        <CalendarDays size={16} />
        <p>Today is unavailable — earliest slot is tomorrow.</p>
      </div>

      <SectionLabel>Pick a day</SectionLabel>
      <DayPicker value={state.scheduledDate} onChange={(d) => set({ scheduledDate: d })} />

      <SectionLabel>Time slot</SectionLabel>
      <div className={styles.slotList}>
        {TIME_SLOTS.map(({ value, label, range, tag }) => {
          const Icon = SLOT_ICONS[value] || Sun;
          const selected = state.scheduledSlot === value;
          return (
            <button
              key={value}
              type="button"
              className={`${styles.slotCard} ${selected ? styles.slotCardSelected : ''}`}
              onClick={() => set({ scheduledSlot: value })}
            >
              <div className={styles.slotIcon}>
                <Icon size={20} />
              </div>
              <div className={styles.slotBody}>
                <h4>{label}</h4>
                <p>{range}</p>
              </div>
              {tag && <span className={styles.slotTag}>{tag}</span>}
              {selected && <span className={styles.slotCheck}><Check size={14} strokeWidth={3} /></span>}
            </button>
          );
        })}
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <Lightbulb size={16} />
          <h3>Installation Summary</h3>
        </div>
        <SummaryRow
          label="Equipment"
          value={equipment || 'Not specified'}
          onEdit={() => onEdit(2)}
        />
        <SummaryRow
          label="Location"
          value={
            property
              ? `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'} @ ${property.label}`
              : state.propertyAddress
                ? `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'} @ new address`
                : 'No address selected'
          }
          onEdit={() => onEdit(3)}
        />
        <SummaryRow
          label="Scheduled visit"
          value={`${scheduledLabel} · ${slotLabel(state.scheduledSlot)}`}
          onEdit={() => {/* same screen */}}
          hideEdit
        />
      </div>
    </>
  );
}

function SummaryRow({ label, value, onEdit, hideEdit = false }) {
  return (
    <div className={styles.summaryRow}>
      <div>
        <span className={styles.summaryLabel}>{label}</span>
        <p className={styles.summaryValue}>{value}</p>
      </div>
      {!hideEdit && (
        <button type="button" className={styles.editBtn} onClick={onEdit} aria-label={`Edit ${label}`}>
          <Pencil size={14} />
        </button>
      )}
    </div>
  );
}

/* ─── Success ─────────────────────────────────────────── */
function SuccessScreen({ request, onHome }) {
  const router = useRouter();
  const dateLabel = request.scheduledDate
    ? new Date(request.scheduledDate).toLocaleDateString('en-IN', {
        weekday: 'long', day: '2-digit', month: 'long',
      })
    : null;

  return (
    <div className={styles.successPage}>
      <AppTopBar title="Request Submitted" showBack={false} variant="transparent" />

      <motion.div
        className={styles.successInner}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className={styles.successCheckRing}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
        >
          <span className={styles.successCheck}>
            <Check size={36} strokeWidth={3} />
          </span>
          <span className={styles.successPulse} aria-hidden="true" />
        </motion.div>

        <h1 className={styles.successHeading}>Request Submitted!</h1>
        <p className={styles.successRef}>
          Request No: <strong>{request.requestNumber || 'PENDING'}</strong>
        </p>

        <div className={styles.successInfoBox}>
          <Sparkles size={18} className={styles.successInfoIcon} />
          <p>
            Our team will contact you within <strong>2 hours</strong> to confirm your site visit
            {dateLabel ? <> on <strong>{dateLabel}</strong></> : '.'}
            {request.scheduledSlot ? <> ({slotLabel(request.scheduledSlot)})</> : ''}
          </p>
        </div>

        <div className={styles.timeline}>
          <h4 className={styles.timelineTitle}>What happens next</h4>
          <ol className={styles.timelineList}>
            {[
              { state: 'done', label: 'Request received', sub: 'We have your details' },
              { state: 'active', label: 'Team reviews & confirms', sub: 'Within 2 hours' },
              { state: 'pending', label: 'Engineer visits your site', sub: 'On the scheduled day' },
              { state: 'pending', label: 'Quote shared within 24h', sub: 'You can accept and schedule installation' },
            ].map((step, i) => (
              <li key={i} className={`${styles.timelineItem} ${styles[`timeline_${step.state}`]}`}>
                <span className={styles.timelineDot}>
                  {step.state === 'done' && <Check size={12} strokeWidth={3} />}
                </span>
                <div>
                  <p className={styles.timelineLabel}>{step.label}</p>
                  <p className={styles.timelineSub}>{step.sub}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.successContactCard}>
          <h4>Need to change or cancel?</h4>
          <div className={styles.contactRow}>
            <a href="tel:+914023540000" className={`${styles.contactBtn} ${styles.contactBtnPrimary}`}>
              <Phone size={14} /> +91 40-2354-XXXX
            </a>
            <a href="https://wa.me/914023540000" className={`${styles.contactBtn} ${styles.contactBtnGhost}`}>
              <MessageCircle size={14} /> WhatsApp Us
            </a>
          </div>
        </div>

        <div className={styles.successActions}>
          <button className="btn btn-outline btn-full" onClick={() => router.push('/tickets')}>
            Track this request
          </button>
          <button className="btn btn-primary btn-full" onClick={onHome}>
            Back to home
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Tiny helpers ────────────────────────────────────── */
function Heading({ title, sub }) {
  return (
    <div className={styles.heading}>
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div className={styles.sectionLabel}>
      <span>{children}</span>
      {right}
    </div>
  );
}
