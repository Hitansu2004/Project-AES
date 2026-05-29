'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, ShieldCheck, Award, Wrench, Snowflake,
  Volume2, Droplet, PowerOff, Wind, Settings, MoreHorizontal, Camera, X,
  Pencil, MapPin, AlertTriangle, Plus, ChevronDown, CalendarDays, Sun,
  CloudSun, Moon, Phone, MessageCircle, Sparkles, Info, Tag, IndianRupee,
  CreditCard, Loader2, MapPinned, Clock, Flame, History,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useService, PRIORITY_INFO, priorityFromServiceStatus } from '@/store/serviceStore';
import { useToast } from '@/components/ui/Toast';
import PaymentModal from '@/components/ui/PaymentModal';
import LocationPicker from '@/components/ui/LocationPicker';
import {
  properties as propertiesApi,
  acUnits as acUnitsApi,
  tickets as ticketsApi,
  pricing as pricingApi,
  slots as slotsApi,
} from '@/lib/api';

// AES head office — used to detect "placeholder coords" so we can
// nudge the customer to pick a real address.
const AES_OFFICE_LAT = 17.4156;
const AES_OFFICE_LNG = 78.4347;

/**
 * Returns true when the property hasn't been pinned to a real
 * location yet — either it has no lat/lng, the lat/lng equal the
 * default AES office fallback inserted by V12, or the address line
 * is the placeholder text we've seen in the demo data.
 */
function isPlaceholderAddress(p) {
  if (!p) return true;
  const lat = p.latitude;
  const lng = p.longitude;
  if (lat == null || lng == null) return true;
  const isOfficeDefault =
    Math.abs(lat - AES_OFFICE_LAT) < 0.0001 &&
    Math.abs(lng - AES_OFFICE_LNG) < 0.0001;
  const addr = (p.formattedAddress || p.addressLine1 || '').trim().toLowerCase();
  const looksPlaceholder = !addr || addr === 'address' || addr.startsWith('address,');
  return isOfficeDefault || looksPlaceholder;
}
import { TIME_SLOTS, PROBLEM_CATEGORIES, slotLabel } from '@/lib/constants';
import { lookupErrorCode } from '@/lib/errorCodes';
import AppTopBar from '@/components/ui/AppTopBar';
import StepIndicator from '@/components/ui/StepIndicator';
import DayPicker from '@/components/ui/DayPicker';
import PriorityBadge from '@/components/ui/PriorityBadge';
import styles from './ticket.module.css';

const TOTAL_STEPS = 4;
const SLOT_ICONS = { EARLY: Clock, MORNING: Sun, AFTERNOON: CloudSun, EVENING: Moon };

const PROBLEM_ICON = {
  NOT_COOLING:    Snowflake,
  NOISE:          Volume2,
  LEAKING:        Droplet,
  NOT_TURNING_ON: PowerOff,
  NO_AIRFLOW:     Wind,
  SMELL_BURNING:  Flame,
  REMOTE_WIFI:    Settings,
  OTHER:          MoreHorizontal,
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

  // V12: dynamic pricing + payment
  const [priceQuote, setPriceQuote] = useState(null);   // { baseCharge, distanceCharge, total, distanceKm, couponMessage, ... }
  const [pricingLoading, setPricingLoading] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [pendingTicketPayload, setPendingTicketPayload] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  // V13 — BookMyShow-style slot availability fetched from the backend.
  // Keyed by ISO date so DayPicker can look up each card in O(1).
  const [slotAvailability, setSlotAvailability] = useState({});
  const [dayCapacity, setDayCapacity] = useState(30);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login?next=/services/ticket'); return; }
    if (user.role !== 'CUSTOMER') router.replace(defaultRouteForRole(user.role));
  }, [user, authLoading, router]);

  // Pre-fetch properties + AC units once
  const reloadProperties = async ({ silent = false } = {}) => {
    if (!user || user.role !== 'CUSTOMER') return [];
    if (!silent) setPropertiesLoading(true);
    try {
      const list = await propertiesApi.list();
      const arr = Array.isArray(list) ? list : [];
      setPropertiesList(arr);
      return arr;
    } catch (e) {
      toast.error(e?.message || 'Could not load your properties.');
      return [];
    } finally {
      setPropertiesLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;
    let cancelled = false;
    (async () => {
      const arr = await reloadProperties();
      if (cancelled) return;
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
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Create an AC unit inline (from the ticket-flow sheet) and select it.
  const handleAddAcUnitInline = async ({ propertyId, payload, autoSelect }) => {
    try {
      const created = await acUnitsApi.create(propertyId, payload);
      const arr = await reloadProperties({ silent: true });
      const prop = arr.find((p) => p.id === propertyId);
      const unit = (prop?.acUnits || []).find((u) => u.id === created.id) || created;
      setActivePropertyId(propertyId);
      if (autoSelect) {
        set({
          acUnitId: unit.id,
          acUnitMeta: {
            roomLabel: unit.roomLabel,
            brand: unit.brand,
            modelNumber: unit.modelNumber,
            acType: unit.acType,
            tonnage: unit.tonnage,
            serviceStatus: unit.serviceStatus,
            propertyId,
            propertyLabel: prop?.label,
          },
          priorityHint: priorityFromServiceStatus(unit.serviceStatus) || state.priorityHint,
        });
      }
      toast.success(`AC "${unit.roomLabel}" added.`);
      return true;
    } catch (e) {
      toast.error(e?.message || 'Could not add AC unit.');
      return false;
    }
  };

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

  // Shared "I picked an AC unit" helper — used by Step 2's tile grid AND
  // the Step 4 dropdown so both paths set the wizard state identically.
  const selectAcUnit = useCallback((unit) => {
    if (!unit) return;
    set({
      acUnitId: unit.id,
      acUnitMeta: {
        brand: unit.brand,
        modelNumber: unit.modelNumber,
        tonnage: unit.tonnage,
        acType: unit.acType,
        roomLabel: unit.roomLabel,
        propertyLabel: unit.propertyLabel,
        propertyId: unit.propertyId,
        serviceStatus: unit.serviceStatus,
      },
    });
    setActivePropertyId(unit.propertyId);
  }, [set]);

  const acUnitsForActiveProperty = useMemo(() => {
    if (!activePropertyId) return [];
    return allACs.filter((u) => u.propertyId === activePropertyId);
  }, [allACs, activePropertyId]);

  const activeProperty = useMemo(
    () => propertiesList.find((p) => p.id === activePropertyId) || null,
    [propertiesList, activePropertyId]
  );

  // Property the chosen AC unit actually belongs to (might differ from activeProperty)
  const ticketProperty = useMemo(() => {
    if (!state.acUnitMeta?.propertyId) return activeProperty;
    return propertiesList.find((p) => p.id === state.acUnitMeta.propertyId) || activeProperty;
  }, [propertiesList, state.acUnitMeta, activeProperty]);

  // V13 — fetch BookMyShow-style slot availability for the next 14 days
  // whenever the customer arrives on the schedule step.  We re-fetch on
  // step entry rather than every render so the picker stays in sync if
  // someone else just booked while this wizard was open.
  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    slotsApi.availability({ from: `${yyyy}-${mm}-${dd}`, days: 14 })
      .then((resp) => {
        if (cancelled) return;
        const lookup = {};
        (resp?.days || []).forEach((d) => { lookup[d.date] = d; });
        setSlotAvailability(lookup);
        if (resp?.dayCapacity) setDayCapacity(resp.dayCapacity);
      })
      .catch(() => { /* silent — picker degrades to unrestricted mode */ });
    return () => { cancelled = true; };
  }, [step]);

  // Re-quote whenever we have the inputs needed for a P3 paid ticket.
  //
  // We deliberately bail out when the property still has placeholder /
  // office-default coordinates — otherwise the API would happily return
  // "0.0 km · Free" which is exactly the confusing UX the customer
  // reported.  The wizard shows a "Set your visit address" CTA instead.
  useEffect(() => {
    if (effectivePriority !== 'P3') { setPriceQuote(null); return; }
    if (!state.acUnitMeta?.acType) return;
    if (!ticketProperty || isPlaceholderAddress(ticketProperty)) { setPriceQuote(null); return; }
    let cancelled = false;
    setPricingLoading(true);
    pricingApi.quote({
      acType: state.acUnitMeta.acType,
      lat: ticketProperty.latitude,
      lng: ticketProperty.longitude,
      couponCode: couponInput?.trim() ? couponInput.trim() : undefined,
    })
      .then((q) => { if (!cancelled) setPriceQuote(q); })
      .catch(() => { if (!cancelled) setPriceQuote(null); })
      .finally(() => { if (!cancelled) setPricingLoading(false); });
    return () => { cancelled = true; };
  }, [effectivePriority, state.acUnitMeta, ticketProperty, couponInput]);

  // Build the payload that the backend expects.  Same shape for both
  // free (AMC / In Warranty) and paid (P3) tickets — the wizard just
  // attaches the pricing + paymentId fields when a payment was made.
  const buildPayload = (paymentId = null) => {
    const description = [
      state.duration ? `Duration: ${state.duration}` : null,
      state.description?.trim() ? state.description.trim() : null,
    ].filter(Boolean).join('\n');
    return {
      acUnitId: state.acUnitId,
      problemCategory: state.problemCategory,
      errorCode: state.errorCode?.trim() ? state.errorCode.trim().toUpperCase() : null,
      problemDescription: description || null,
      photoUrls: state.photoUrls?.length ? state.photoUrls : [],
      scheduledDate: state.scheduledDate,
      scheduledSlot: state.scheduledSlot,
      // V12 — location captured from the chosen property
      serviceLat:     ticketProperty?.latitude  ?? null,
      serviceLng:     ticketProperty?.longitude ?? null,
      serviceAddress: ticketProperty?.formattedAddress
                   ?? [ticketProperty?.addressLine1, ticketProperty?.city].filter(Boolean).join(', '),
      landmark:       ticketProperty?.landmark  ?? null,
      secondaryPhone: ticketProperty?.secondaryPhone ?? null,
      // V12 — pricing + payment
      discountCode:   priceQuote?.couponCode ?? (couponInput?.trim() || null),
      paymentId,
    };
  };

  const createTicketWithPayload = async (payload) => {
    setSubmitting(true);
    try {
      const res = await ticketsApi.create(payload);
      setSubmittedTicket(res);
      reset();
      setShowPayment(false);
      setPriceQuote(null);
      setCouponInput('');
      toast.success('Service ticket raised.');
    } catch (err) {
      toast.error(err.message || 'Could not raise ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit — pops the payment modal for P3, raises directly otherwise.
  const handleSubmit = async () => {
    if (!step4Valid || !state.acUnitId) return;
    if (effectivePriority === 'P3') {
      if (isPlaceholderAddress(ticketProperty)) {
        toast.error('Please set your visit address first — distance affects the price.');
        setShowLocationPicker(true);
        return;
      }
      if (!priceQuote || pricingLoading) {
        toast.error('We are still calculating the price — try again in a moment.');
        return;
      }
      setPendingTicketPayload(buildPayload(null));
      setShowPayment(true);
      return;
    }
    await createTicketWithPayload(buildPayload(null));
  };

  // Callback fired from PaymentModal after a successful demo payment.
  const handlePaymentSuccess = async ({ paymentId }) => {
    if (!pendingTicketPayload) return;
    await createTicketWithPayload({ ...pendingTicketPayload, paymentId });
    setPendingTicketPayload(null);
  };

  // Persist the picked address back to the property so the price card
  // re-calculates AND the customer's account page shows the same pin
  // next time they raise a ticket.
  const handleLocationSave = async (loc) => {
    if (!ticketProperty?.id) return;
    setSavingLocation(true);
    try {
      const updated = await propertiesApi.update(ticketProperty.id, {
        latitude:         loc.lat,
        longitude:        loc.lng,
        formattedAddress: loc.formattedAddress,
        googlePlaceId:    loc.googlePlaceId,
        landmark:         loc.landmark,
        secondaryPhone:   loc.secondaryPhone,
        // Also overwrite the legacy text address line with the real one
        // so /account stops showing "address, city".  When Google gave
        // us a proper locality / postal code, persist those too so the
        // record stays in sync with whatever was just confirmed.
        addressLine1:     loc.formattedAddress,
        ...(loc.city    ? { city:    loc.city }    : {}),
        ...(loc.pincode ? { pincode: loc.pincode } : {}),
      });
      // Replace the property in our local list so the UI re-renders +
      // the price effect re-runs against the new lat/lng.
      setPropertiesList((prev) => prev.map((p) =>
        p.id === ticketProperty.id ? { ...p, ...updated } : p
      ));
      setShowLocationPicker(false);
      toast.success('Address saved — recalculating price…');
    } catch (e) {
      toast.error(e?.message || 'Could not save address');
    } finally {
      setSavingLocation(false);
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
                onAddAcUnit={handleAddAcUnitInline}
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
                priceQuote={priceQuote}
                pricingLoading={pricingLoading}
                couponInput={couponInput}
                onCouponChange={setCouponInput}
                ticketProperty={ticketProperty}
                addressMissing={isPlaceholderAddress(ticketProperty)}
                onPickAddress={() => setShowLocationPicker(true)}
                // V12 — inline editors instead of bouncing back to step 2/3
                propertiesList={propertiesList}
                acUnitsForActiveProperty={acUnitsForActiveProperty}
                activePropertyId={activePropertyId}
                // V13 — slot availability + day capacity for the picker
                slotAvailability={slotAvailability}
                dayCapacity={dayCapacity}
                onChangeProperty={(propertyId) => {
                  setActivePropertyId(propertyId);
                  // If the unit we'd been carrying belongs to a different
                  // property, swap it for the first AC of the new one — or
                  // clear it if the new property is empty so the AC dropdown
                  // forces the customer to pick one.
                  const acsInNewProp = allACs.filter((u) => u.propertyId === propertyId);
                  const currentStillValid = state.acUnitMeta?.propertyId === propertyId;
                  if (!currentStillValid) {
                    if (acsInNewProp.length > 0) selectAcUnit(acsInNewProp[0]);
                    else set({ acUnitId: null, acUnitMeta: null });
                  }
                }}
                onChangeAcUnit={(acUnitId) => {
                  const unit = allACs.find((u) => u.id === acUnitId);
                  if (unit) selectAcUnit(unit);
                }}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <PaymentModal
        open={showPayment}
        amount={priceQuote?.total ?? 0}
        description={state.acUnitMeta ? `${labelForAcType(state.acUnitMeta.acType)} service · ${state.acUnitMeta.roomLabel}` : 'AES service charge'}
        customerName={user?.name}
        customerPhone={user?.phoneNumber}
        onClose={() => { if (!submitting) setShowPayment(false); }}
        onSuccess={handlePaymentSuccess}
      />

      <LocationPicker
        open={showLocationPicker}
        initial={ticketProperty ? {
          lat: isPlaceholderAddress(ticketProperty) ? null : ticketProperty.latitude,
          lng: isPlaceholderAddress(ticketProperty) ? null : ticketProperty.longitude,
          formattedAddress: isPlaceholderAddress(ticketProperty) ? '' : (ticketProperty.formattedAddress || ''),
          landmark: ticketProperty.landmark || '',
          secondaryPhone: ticketProperty.secondaryPhone || user?.phoneNumber || '',
        } : null}
        onClose={() => setShowLocationPicker(false)}
        onSave={handleLocationSave}
        saving={savingLocation}
      />

      <div className={styles.actionBar}>
        <div className={styles.actionInner}>
          {step === 4 ? (
            <button
              className="btn btn-primary btn-full btn-lg"
              disabled={
                !step4Valid || submitting ||
                (effectivePriority === 'P3' && (pricingLoading || isPlaceholderAddress(ticketProperty)))
              }
              onClick={handleSubmit}
            >
              {submitting ? <span className="spinner spinner-sm" /> : (
                effectivePriority === 'P3'
                  ? (isPlaceholderAddress(ticketProperty)
                      ? <>Add your address to continue <ArrowRight size={18} /></>
                      : <>Continue to Payment {priceQuote ? `· ₹${priceQuote.total.toLocaleString('en-IN')}` : ''} <ArrowRight size={18} /></>)
                  : <>Raise Service Ticket <ArrowRight size={18} /></>
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
  loading, properties, activeProperty, acUnits, onPickProperty, onAddAcUnit, selectedId, onSelect,
}) {
  const [showPropertySheet, setShowPropertySheet] = useState(false);
  const [showAddAcSheet, setShowAddAcSheet]       = useState(false);
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
        <p>You need a property and at least one AC unit before raising a service ticket. It takes 30 seconds.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/account?tab=properties&new=1" className="btn btn-primary">
            ＋ Add a property
          </Link>
          <Link href="/dashboard" className="btn btn-outline">Back to Home</Link>
        </div>
      </div>
    );
  }

  const noAcUnits = properties.every((p) => (p.acUnits?.length ?? 0) === 0);
  if (noAcUnits) {
    return (
      <>
        <div className={styles.emptyState}>
          <Snowflake size={36} color="var(--secondary)" />
          <h3>No AC units yet</h3>
          <p>
            Add an AC unit to {properties.length === 1 ? `"${properties[0].label}"` : 'one of your properties'} so we know what needs servicing.
            It takes 20 seconds and we&apos;ll select it for you automatically.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowAddAcSheet(true)}>
              <Plus size={16} /> Add AC unit
            </button>
            <Link href="/account?tab=properties" className="btn btn-outline">
              Manage in account
            </Link>
          </div>
        </div>
        <AnimatePresence>
          {showAddAcSheet && (
            <AddAcUnitSheet
              properties={properties}
              defaultPropertyId={activeProperty?.id || properties[0]?.id}
              onClose={() => setShowAddAcSheet(false)}
              onSubmit={async (payload) => {
                const ok = await onAddAcUnit({
                  propertyId: payload.propertyId,
                  payload: payload.unit,
                  autoSelect: true,
                });
                if (ok) setShowAddAcSheet(false);
              }}
            />
          )}
        </AnimatePresence>
      </>
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

      <button type="button" className={styles.outlineBtn} onClick={() => setShowAddAcSheet(true)}>
        <Plus size={16} /> Add a new AC unit
      </button>

      <AnimatePresence>
        {showPropertySheet && (
          <PropertySheet
            properties={properties}
            activeId={activeProperty?.id}
            onPick={(id) => { onPickProperty(id); setShowPropertySheet(false); }}
            onClose={() => setShowPropertySheet(false)}
          />
        )}
        {showAddAcSheet && (
          <AddAcUnitSheet
            properties={properties}
            defaultPropertyId={activeProperty?.id || properties[0]?.id}
            onClose={() => setShowAddAcSheet(false)}
            onSubmit={async (payload) => {
              const ok = await onAddAcUnit({
                propertyId: payload.propertyId,
                payload: payload.unit,
                autoSelect: true,
              });
              if (ok) setShowAddAcSheet(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function AddAcUnitSheet({ properties, defaultPropertyId, onClose, onSubmit }) {
  const [propertyId, setPropertyId] = useState(defaultPropertyId || properties[0]?.id || '');
  const [roomLabel,  setRoomLabel]  = useState('');
  const [acType,     setAcType]     = useState('SPLIT');
  const [brand,      setBrand]      = useState('');
  const [modelNumber,setModelNumber]= useState('');
  const [tonnage,    setTonnage]    = useState('1.5');
  const [starRating, setStarRating] = useState(3);
  const [saving,     setSaving]     = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!propertyId) { toast.warning('Pick a property.'); return; }
    if (!roomLabel.trim()) { toast.warning('Room label is required.'); return; }
    if (!brand.trim())     { toast.warning('Brand is required.'); return; }
    const tonNum = Number(tonnage);
    if (!Number.isFinite(tonNum) || tonNum < 0.5 || tonNum > 20) {
      toast.warning('Tonnage must be between 0.5 and 20.'); return;
    }
    setSaving(true);
    try {
      await onSubmit({
        propertyId,
        unit: {
          roomLabel: roomLabel.trim(),
          acType,
          brand: brand.trim(),
          modelNumber: modelNumber.trim() || undefined,
          tonnage: tonNum,
          energyStarRating: Number(starRating) || undefined,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedProp = properties.find((p) => p.id === propertyId);

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
        style={{ maxHeight: '92dvh', overflowY: 'auto' }}
      >
        <div className={styles.sheetHandle} />
        <h3 className={styles.sheetTitle}>Add AC unit</h3>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: 13, margin: '0 0 14px' }}>
          We&apos;ll add this unit to your property and pre-select it for this service request.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {properties.length > 1 && (
            <div className="input-group">
              <label>Property</label>
              <select className="input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          )}
          {properties.length === 1 && selectedProp && (
            <div style={{
              padding: '10px 12px', background: 'var(--surface-container-low)',
              borderRadius: 10, fontSize: 13, color: 'var(--on-surface-variant)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <MapPin size={14} /> Adding to <strong style={{ color: 'var(--on-surface)' }}>{selectedProp.label}</strong>
            </div>
          )}

          <div className="input-group">
            <label>Room label*</label>
            <input className="input" placeholder="Living Room / Master Bedroom" value={roomLabel}
                   onChange={(e) => setRoomLabel(e.target.value)} autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group">
              <label>AC type</label>
              <select className="input" value={acType} onChange={(e) => setAcType(e.target.value)}>
                <option value="SPLIT">Split</option>
                <option value="WINDOW">Window</option>
                <option value="CASSETTE">Cassette</option>
                <option value="CENTRAL">Central</option>
                <option value="VRF_VRV">VRF / VRV</option>
              </select>
            </div>
            <div className="input-group">
              <label>Tonnage*</label>
              <input className="input" type="number" min="0.5" max="20" step="0.5"
                     value={tonnage} onChange={(e) => setTonnage(e.target.value)} />
            </div>
          </div>

          <div className="input-group">
            <label>Brand*</label>
            <input className="input" placeholder="Daikin / LG / Voltas / Blue Star…" value={brand}
                   onChange={(e) => setBrand(e.target.value)} />
          </div>

          <div className="input-group">
            <label>Model number</label>
            <input className="input" placeholder="FTKM50UV (optional)" value={modelNumber}
                   onChange={(e) => setModelNumber(e.target.value)} />
          </div>

          <div className="input-group">
            <label>Energy star rating</label>
            <select className="input" value={starRating} onChange={(e) => setStarRating(Number(e.target.value))}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} star</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Adding…' : 'Add & continue'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
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
function Step4Schedule({
  priority, acMeta, state, set,
  priceQuote, pricingLoading, couponInput, onCouponChange, ticketProperty,
  addressMissing, onPickAddress,
  // V12 — inline edit support
  propertiesList = [], acUnitsForActiveProperty = [],
  activePropertyId, onChangeProperty, onChangeAcUnit,
  // V13 — slot availability
  slotAvailability = {}, dayCapacity = 30,
}) {
  const info = priority ? PRIORITY_INFO[priority] : null;
  const todaysSlots = state.scheduledDate ? slotAvailability[state.scheduledDate]?.slots : null;

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

      {priority === 'P3' && (
        <PriceCard
          quote={priceQuote}
          loading={pricingLoading}
          couponInput={couponInput}
          onCouponChange={onCouponChange}
          property={ticketProperty}
          acMeta={acMeta}
          addressMissing={addressMissing}
          onPickAddress={onPickAddress}
        />
      )}

      <section className={styles.summaryCard}>
        <div className={styles.summaryHead}>
          <h3>Service Summary</h3>
        </div>

        <SummarySelect
          icon={<MapPin size={18} />}
          label="Property"
          value={activePropertyId || acMeta?.propertyId || ''}
          onChange={onChangeProperty}
          options={propertiesList.map((p) => ({
            value: p.id,
            label: p.label,
          }))}
          placeholder="Select a property"
        />

        <SummarySelect
          icon={<Snowflake size={18} />}
          label="AC Unit"
          value={state.acUnitId || ''}
          onChange={onChangeAcUnit}
          options={acUnitsForActiveProperty.map((u) => ({
            value: u.id,
            label: `${u.brand} ${u.modelNumber || ''} · ${u.roomLabel} · ${labelForAcType(u.acType)}`
              .replace(/\s+/g, ' ').trim(),
          }))}
          placeholder="Select an AC unit"
          hint={acUnitsForActiveProperty.length === 0
            ? 'No AC units on this property — add one from the Account page first.'
            : null}
        />

        <SummarySelect
          icon={<AlertTriangle size={18} />}
          label="Problem"
          value={state.problemCategory || ''}
          onChange={(v) => set({ problemCategory: v })}
          options={PROBLEM_CATEGORIES.map((p) => ({ value: p.value, label: p.label }))}
          placeholder="Select a problem"
          hint={state.errorCode ? `Reported error code · ${state.errorCode}` : null}
        />
      </section>

      <section className={styles.scheduleSection}>
        <h3 className={styles.sectionHeading}>
          Select Date &amp; Time
          <span className={styles.capacityHint}>
            <History size={12} /> Booked like BookMyShow — {dayCapacity} slots / day
          </span>
        </h3>
        <DayPicker
          value={state.scheduledDate}
          onChange={(iso) => {
            // If the customer switches to a different date and the
            // slot they had picked is already full there, clear it
            // so the slot grid forces them to choose again.
            const newSlotsForDay = slotAvailability[iso]?.slots;
            const stillOk = state.scheduledSlot && newSlotsForDay
              ? !newSlotsForDay[state.scheduledSlot]?.full
              : true;
            set({ scheduledDate: iso, scheduledSlot: stillOk ? state.scheduledSlot : '' });
          }}
          days={14}
          availability={slotAvailability}
          dayCapacity={dayCapacity}
        />
        {state.scheduledDate && slotAvailability[state.scheduledDate]?.busyReason && (
          <p className={styles.busyBanner}>
            <AlertTriangle size={13} /> {slotAvailability[state.scheduledDate].busyReason}
          </p>
        )}
        <div className={styles.slotGrid}>
          {TIME_SLOTS.map(({ value: v, label, range, tag }) => {
            const Icon = SLOT_ICONS[v];
            const selected = state.scheduledSlot === v;
            const slotInfo = todaysSlots?.[v];
            const slotFull = !!slotInfo?.full;
            const slotLeft = slotInfo?.available;
            const disabled = !state.scheduledDate || slotFull;
            return (
              <motion.button
                key={v}
                type="button"
                whileTap={{ scale: disabled ? 1 : 0.97 }}
                onClick={() => !disabled && set({ scheduledSlot: v })}
                disabled={disabled}
                className={[
                  styles.slotCard,
                  selected && styles.slotCardSelected,
                  slotFull && styles.slotCardFull,
                  disabled && styles.slotCardDisabled,
                ].filter(Boolean).join(' ')}
                title={!state.scheduledDate
                  ? 'Pick a date first'
                  : (slotFull ? 'This slot is full' : `${slotLeft ?? '—'} slots left`)}
              >
                <Icon size={18} />
                <span className={styles.slotLabel}>{label}</span>
                <span className={styles.slotRange}>{range}</span>
                {slotInfo
                  ? <span className={styles.slotTag}>{slotFull ? 'Full' : `${slotLeft} left`}</span>
                  : (tag && <span className={styles.slotTag}>{tag}</span>)}
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

/* ─── Dynamic Pricing card for P3 ───────────────────────── */
function PriceCard({ quote, loading, couponInput, onCouponChange, property, acMeta, addressMissing, onPickAddress }) {
  const distance = quote?.distanceKm != null ? Number(quote.distanceKm).toFixed(1) : null;
  const total    = quote?.total ?? 0;
  const inr      = (n) => '₹' + Number(n).toLocaleString('en-IN');
  const couponApplied = quote?.couponCode && quote?.discountAmount > 0;
  const couponError   = quote?.couponMessage && !couponApplied;

  return (
    <section style={{
      borderRadius: 16, padding: '16px 18px',
      background: 'linear-gradient(135deg, var(--surface-container-low, #f8fafc), var(--surface, #fff))',
      border: '1px solid var(--border-light, #e2e8f0)',
      display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12,
    }}>
      {/* Address — either picker CTA (missing) or saved-card with Edit */}
      {addressMissing ? (
        <button
          type="button"
          onClick={onPickAddress}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', textAlign: 'left', cursor: 'pointer',
            padding: '12px 14px', borderRadius: 12,
            background: 'linear-gradient(135deg, #fef3c7, #fde68a40)',
            border: '1px dashed #f59e0b',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#f59e0b', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <MapPin size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>
              Set your visit address
            </div>
            <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
              We&rsquo;ll calculate the exact service charge based on the distance from our office.
            </div>
          </div>
          <ArrowRight size={16} color="#92400e" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onPickAddress}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            width: '100%', textAlign: 'left', cursor: 'pointer',
            padding: '10px 12px', borderRadius: 10,
            background: 'var(--surface-container-low, #f8fafc)',
            border: '1px solid var(--border-light, #e2e8f0)',
          }}
        >
          <MapPinned size={16} color="var(--secondary, #0ea5e9)" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              Visit address
            </div>
            <div style={{ fontSize: 13, color: 'var(--on-surface)', marginTop: 2, lineHeight: 1.4 }}>
              {property?.formattedAddress || [property?.addressLine1, property?.city].filter(Boolean).join(', ')}
            </div>
            {property?.landmark && (
              <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                Landmark: {property.landmark}
              </div>
            )}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--secondary, #0ea5e9)' }}>Change</span>
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IndianRupee size={16} color="var(--secondary)" />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>
          Service charge breakdown
        </h3>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--on-surface-variant)' }}>
          <Loader2 size={14} className="spin" /> Calculating based on AC type and distance…
        </div>
      )}

      {!loading && quote && !addressMissing && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <Row label={`Base — ${labelForAcType(acMeta?.acType)}`} value={inr(quote.baseCharge)} />
            <Row label={`Distance — ${distance} km from AES office`} value={quote.distanceCharge ? `+${inr(quote.distanceCharge)}` : 'Free'} />
            {couponApplied && (
              <Row
                label={`Coupon ${quote.couponCode} (${quote.discountPct}% off)`}
                value={`− ${inr(quote.discountAmount)}`}
                tone="positive"
              />
            )}
            <div style={{ height: 1, background: 'var(--border-light, #e2e8f0)', margin: '4px 0' }} />
            <Row label="You pay now" value={inr(total)} bold />
          </div>

          {/* Coupon input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Tag size={14} color="var(--on-surface-variant)" style={{ position: 'absolute', top: 12, left: 10 }} />
              <input
                placeholder="Apply discount code"
                value={couponInput}
                onChange={(e) => onCouponChange(e.target.value.toUpperCase())}
                className="input"
                style={{ paddingLeft: 30, textTransform: 'uppercase' }}
              />
            </div>
            {couponInput && (
              <button type="button" className="btn btn-ghost" onClick={() => onCouponChange('')}>
                Clear
              </button>
            )}
          </div>
          {couponError && (
            <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{quote.couponMessage}</p>
          )}
          {couponApplied && (
            <p style={{ margin: 0, fontSize: 12, color: '#16a34a' }}>{quote.couponMessage}</p>
          )}
        </>
      )}

      {!loading && addressMissing && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--on-surface-variant)' }}>
          Once you set your address, we&rsquo;ll show the final amount (base + distance band).
        </p>
      )}

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}

function Row({ label, value, bold = false, tone = '' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--on-surface-variant)', flex: 1 }}>{label}</span>
      <span style={{
        fontWeight: bold ? 800 : 600,
        color: tone === 'positive' ? '#16a34a' : 'var(--on-surface)',
        fontSize: bold ? 16 : 13,
      }}>{value}</span>
    </div>
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

/**
 * Editable summary row — same anatomy as SummaryRow but renders a
 * native <select> in place of the value + pencil.  Used on Step 4 so
 * the customer can swap Property / AC Unit / Problem without bouncing
 * back through the wizard.
 */
function SummarySelect({ icon, label, value, onChange, options, placeholder, hint }) {
  const disabled = !options || options.length === 0;
  return (
    <div className={styles.summaryRowEditable}>
      <span className={styles.summaryIcon}>{icon}</span>
      <div>
        <span className={styles.summaryLabel}>{label}</span>
        <select
          className={`${styles.summarySelect} ${!value ? styles.summarySelectEmpty : ''}`}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          aria-label={label}
        >
          <option value="" disabled>{placeholder || `Select ${label.toLowerCase()}`}</option>
          {(options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {hint && <span className={styles.summarySelectHint}>{hint}</span>}
      </div>
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
