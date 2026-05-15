'use client';

import { useEffect, useState, useMemo } from 'react';

/**
 * Live countdown hook driven by a deadline ISO string.
 * Returns { remainingSeconds, isBreached, displayText, tone }.
 *
 *   tone: 'safe' (>20m), 'warning' (10–20m), 'critical' (<10m), 'breached'
 */
export default function useSlaCountdown(deadlineISO, { initialOffsetSeconds } = {}) {
  // We base the countdown on the absolute deadline timestamp so it never drifts
  // even if the device sleeps. If the backend gave us "secondsRemaining" instead,
  // initialOffsetSeconds is supported as a fallback.
  const targetMs = useMemo(() => {
    if (deadlineISO) return new Date(deadlineISO).getTime();
    if (initialOffsetSeconds != null) return Date.now() + initialOffsetSeconds * 1000;
    return null;
  }, [deadlineISO, initialOffsetSeconds]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs == null) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs == null) {
    return { remainingSeconds: null, isBreached: false, displayText: '—', tone: 'safe' };
  }

  const remainingSeconds = Math.floor((targetMs - now) / 1000);
  const isBreached = remainingSeconds <= 0;
  const tone = isBreached
    ? 'breached'
    : remainingSeconds < 600
      ? 'critical'
      : remainingSeconds < 1200
        ? 'warning'
        : 'safe';

  return { remainingSeconds, isBreached, displayText: formatRemaining(remainingSeconds), tone };
}

export function formatRemaining(seconds) {
  if (seconds <= 0) return 'BREACHED';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m >= 10) return `${m} min`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
