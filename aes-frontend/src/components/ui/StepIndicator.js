'use client';

import styles from './StepIndicator.module.css';

/** Pill showing "X of N" plus an underline progress bar that fills with completion. */
export default function StepIndicator({ current, total }) {
  const pct = Math.min(100, Math.max(0, (current / total) * 100));
  return (
    <div className={styles.wrap} aria-label={`Step ${current} of ${total}`}>
      <span className={styles.pill}>
        {current} <span className={styles.muted}>of {total}</span>
      </span>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
