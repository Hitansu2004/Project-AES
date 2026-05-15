'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'aes_install_draft_v1';

/** Steps in the install wizard. */
export const INSTALL_STEPS = [
  { key: 'ac-type',  label: 'AC Type' },
  { key: 'brand',    label: 'Brand & Model' },
  { key: 'property', label: 'Property & Rooms' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'success',  label: 'Done' },
];

const EMPTY_ROOM = { roomType: 'Master Bedroom', sizeSqft: '', acType: '' };

const DEFAULT_STATE = {
  acType: '',
  brand: '',
  modelNumber: '',
  tonnage: '1.5',
  energyRating: 5,
  propertyId: null,
  propertyAddress: '',
  rooms: [EMPTY_ROOM],
  notes: '',
  scheduledDate: '',
  scheduledSlot: 'MORNING',
};

const InstallContext = createContext(null);

export function InstallationProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage so accidental refresh does not lose draft.
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

  const addRoom = useCallback((acType) => {
    setState((prev) => ({
      ...prev,
      rooms: [
        ...prev.rooms,
        { roomType: 'Bedroom', sizeSqft: '', acType: acType || prev.acType || '' },
      ],
    }));
  }, []);

  const updateRoom = useCallback((index, patch) => {
    setState((prev) => {
      const rooms = prev.rooms.map((r, i) => (i === index ? { ...r, ...patch } : r));
      return { ...prev, rooms };
    });
  }, []);

  const removeRoom = useCallback((index) => {
    setState((prev) => {
      if (prev.rooms.length <= 1) return prev;
      const rooms = prev.rooms.filter((_, i) => i !== index);
      return { ...prev, rooms };
    });
  }, []);

  const value = useMemo(() => ({
    state,
    hydrated,
    set,
    reset,
    addRoom,
    updateRoom,
    removeRoom,
  }), [state, hydrated, set, reset, addRoom, updateRoom, removeRoom]);

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}

export function useInstall() {
  const ctx = useContext(InstallContext);
  if (!ctx) throw new Error('useInstall must be used within InstallationProvider');
  return ctx;
}
