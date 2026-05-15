'use client';

import { useEffect, useRef } from 'react';
import styles from './DayPicker.module.css';

const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Build the next N selectable days starting tomorrow (today is disabled). */
function buildDays(count) {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    out.push({
      iso: `${yyyy}-${mm}-${dd}`,
      weekday: WEEKDAY[d.getDay()],
      day: d.getDate(),
      month: d.toLocaleString('en-US', { month: 'short' }),
      isToday: i === 0,
    });
  }
  return out;
}

/**
 * Horizontal day-strip selector. Today is disabled (per spec line 1196 +
 * backend validation: scheduled date must be tomorrow or later).
 *
 * Props:
 *   value      — selected ISO date string (YYYY-MM-DD)
 *   onChange   — (iso) => void
 *   days       — how many days to show (default 14)
 */
export default function DayPicker({ value, onChange, days = 14 }) {
  const list = buildDays(days);
  const containerRef = useRef(null);

  // Auto-scroll the selected day into view on mount.
  useEffect(() => {
    if (!containerRef.current || !value) return;
    const node = containerRef.current.querySelector(`[data-iso="${value}"]`);
    node?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [value]);

  return (
    <div className={styles.scroller} ref={containerRef}>
      <div className={styles.row}>
        {list.map((d) => {
          const selected = value === d.iso;
          const disabled = d.isToday;
          return (
            <button
              key={d.iso}
              type="button"
              data-iso={d.iso}
              className={`${styles.day} ${selected ? styles.selected : ''} ${disabled ? styles.disabled : ''}`}
              onClick={() => !disabled && onChange(d.iso)}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${d.weekday} ${d.month} ${d.day}${disabled ? ' (not available)' : ''}`}
            >
              <span className={styles.weekday}>{d.weekday}</span>
              <span className={styles.dayNum}>{d.day}</span>
              <span className={styles.month}>{d.month}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
