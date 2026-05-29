'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'aes_service_draft_v1';

/** Steps in the service-ticket wizard. */
export const SERVICE_STEPS = [
  { key: 'priority', label: 'Priority' },
  { key: 'select-ac', label: 'AC Unit' },
  { key: 'problem',  label: 'Problem' },
  { key: 'schedule', label: 'Schedule' },
];

const DEFAULT_STATE = {
  // Step 1 — informational priority hint (P1/P2/P3)
  priorityHint: '',
  // Step 2 — selected AC unit (UUID string) + cached metadata for display
  acUnitId: '',
  acUnitMeta: null,        // { roomLabel, brand, modelNumber, acType, tonnage, serviceStatus, propertyId, propertyLabel }
  // Step 3 — problem details
  problemCategory: '',
  errorCode: '',
  duration: '',            // 'Today' | '2-3 Days' | 'This Week' | 'Over a Week'
  description: '',
  photoUrls: [],           // string[] (data URLs in demo, max 4)
  // Step 4 — schedule
  scheduledDate: '',
  scheduledSlot: 'MORNING',
};

const ServiceContext = createContext(null);

export function ServiceProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state, hydrated]);

  const set = useCallback((patch) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({
    state, hydrated, set, reset,
  }), [state, hydrated, set, reset]);

  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>;
}

export function useService() {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error('useService must be used within ServiceProvider');
  return ctx;
}

/** Map an AC unit's serviceStatus → priority hint. */
export function priorityFromServiceStatus(serviceStatus) {
  switch (serviceStatus) {
    case 'P1_AMC':      return 'P1';
    case 'P2_WARRANTY': return 'P2';
    case 'P3_PAID':     return 'P3';
    default:            return '';
  }
}

/** Display-friendly priority metadata used across screens. */
export const PRIORITY_INFO = {
  P1: {
    code: 'P1',
    badge: 'P1 — AMC',
    headline: 'AMC — Annual Maintenance Contract',
    desc: 'You have an active AMC on your registered equipment. This guarantees priority response times and covered routine maintenance.',
    chips: ['4hr Response', 'Zero Callout Fee', 'Parts Covered'],
    cta: 'Check AMC Status',
    sla: '4h SLA',
    chargeNote: '✓ No charges for this service (AMC Covered)',
    chargeTone: 'success',
    accent: 'amc',
  },
  P2: {
    code: 'P2',
    badge: 'P2 — In Warranty',
    headline: 'In Warranty',
    desc: 'Your AC is within its AES manufacturer warranty. Repairs for manufacturing defects are covered free of charge; external damage may not be.',
    chips: ['8hr Response', 'Free Labour', 'Defect Covered'],
    cta: 'Check Warranty',
    sla: '8h SLA',
    chargeNote: '✓ No charges for this service (In Warranty)',
    chargeTone: 'success',
    accent: 'warranty',
  },
  P3: {
    code: 'P3',
    badge: 'P3 — Paid Service',
    headline: 'Paid Service · Warranty Expired',
    desc: 'Service charges apply. The exact amount depends on your AC type and how far you are from our office — calculated on the next step before payment.',
    chips: ['Starts at ₹750', '+ distance band', 'Pay now, ticket opens after'],
    cta: 'View Service Charges',
    sla: '24h SLA',
    chargeNote: 'Final amount is shown at checkout — base charge by AC type + distance band. Coupons can be applied.',
    chargeTone: 'paid',
    accent: 'paid',
  },
};
