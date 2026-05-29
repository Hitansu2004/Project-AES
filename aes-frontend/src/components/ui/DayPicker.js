'use client';

import { useEffect, useRef } from 'react';
import styles from './DayPicker.module.css';

const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Build the next N selectable days starting today. */
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
 * Horizontal day-strip selector (BookMyShow-style).
 *
 * <p>Today is always disabled (spec line 1196 + backend validation:
 * scheduled_date must be tomorrow or later).  Any day flagged
 * {@code full: true} in {@code availability} is also disabled and
 * styled to show why.</p>
 *
 * Props:
 *   value           — selected ISO date string (YYYY-MM-DD)
 *   onChange        — (iso) => void
 *   days            — how many days to show (default 14)
 *   availability    — { [iso]: { used, capacity, available, full, busyReason } }
 *                     If undefined, behaves like the original picker.
 *   dayCapacity     — total slots per day (used for the capacity bar baseline)
 */
export default function DayPicker({ value, onChange, days = 14, availability, dayCapacity = 30 }) {
  const list = buildDays(days);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !value) return;
    const node = containerRef.current.querySelector(`[data-iso="${value}"]`);
    node?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [value]);

  return (
    <div className={styles.scroller} ref={containerRef}>
      <div className={styles.row}>
        {list.map((d) => {
          const a = availability?.[d.iso];
          const fullCapacity = a?.full === true;
          const fewLeft      = a && !fullCapacity && a.available <= Math.ceil(dayCapacity * 0.2);
          const selected = value === d.iso;
          const disabled = d.isToday || fullCapacity;

          // Show available/used in a small footer chip
          const remainingLabel = a
            ? (fullCapacity ? 'Full' : `${a.available} left`)
            : null;

          const tooltip = (() => {
            if (d.isToday) return 'Bookings start from tomorrow';
            if (fullCapacity) return a?.busyReason || `All ${dayCapacity} slots booked`;
            if (fewLeft) return a?.busyReason || `Only ${a.available} slots left`;
            if (a) return `${a.available} of ${a.capacity} slots available`;
            return null;
          })();

          return (
            <button
              key={d.iso}
              type="button"
              data-iso={d.iso}
              className={[
                styles.day,
                selected   && styles.selected,
                disabled   && styles.disabled,
                fullCapacity && styles.full,
                fewLeft    && styles.fewLeft,
              ].filter(Boolean).join(' ')}
              onClick={() => !disabled && onChange(d.iso)}
              disabled={disabled}
              aria-pressed={selected}
              title={tooltip || undefined}
              aria-label={`${d.weekday} ${d.month} ${d.day}${disabled ? ' (not available)' : ''}`}
            >
              <span className={styles.weekday}>{d.weekday}</span>
              <span className={styles.dayNum}>{d.day}</span>
              <span className={styles.month}>{d.month}</span>
              {a && (
                <>
                  <span
                    className={styles.capacityBar}
                    style={{ '--fill': `${Math.min(100, (a.used / a.capacity) * 100)}%` }}
                    aria-hidden
                  />
                  <span className={styles.remaining}>{remainingLabel}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
