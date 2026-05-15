'use client';

import { Timer } from 'lucide-react';
import useSlaCountdown from '@/hooks/useSlaCountdown';
import styles from './SlaCountdown.module.css';

const TONE_LABEL = {
  safe: 'Response time',
  warning: 'Response Deadline',
  critical: 'RESPOND NOW',
  breached: 'SLA Breached',
};

/**
 * SLA chip / banner used by the customer ticket detail and the CRM dashboard.
 *
 * Variants:
 *   chip   — tiny inline pill (default)
 *   banner — full-width banner with progress bar
 */
export default function SlaCountdown({
  deadlineISO,
  initialOffsetSeconds,
  variant = 'chip',
  totalSeconds,        // optional — used only by banner to draw progress
  label,               // optional — overrides default label
}) {
  const { displayText, tone, remainingSeconds } = useSlaCountdown(deadlineISO, { initialOffsetSeconds });

  if (variant === 'banner') {
    const safeTotal = totalSeconds && totalSeconds > 0 ? totalSeconds : 1800; // 30m default
    const pct = remainingSeconds == null
      ? 0
      : Math.max(0, Math.min(100, (remainingSeconds / safeTotal) * 100));
    return (
      <div className={`${styles.banner} ${styles[`banner_${tone}`]}`}>
        <div className={styles.bannerHead}>
          <Timer size={18} />
          <p>
            <strong>{label || TONE_LABEL[tone]}:</strong> {displayText}
            {tone !== 'breached' && ' remaining'}
          </p>
        </div>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <span className={`${styles.chip} ${styles[`chip_${tone}`]}`}>
      <Timer size={14} strokeWidth={2.4} />
      {displayText}
      {tone === 'critical' && ' · RESPOND NOW'}
    </span>
  );
}
