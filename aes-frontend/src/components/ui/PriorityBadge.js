/**
 * Priority badge — P1 (AMC purple), P2 (Warranty teal), P3 (Paid red).
 * Used on the customer ticket cards, ticket detail, and CRM/Admin dashboards.
 */
import styles from './PriorityBadge.module.css';

const META = {
  P1: { tone: 'amc',      label: 'P1 AMC' },
  P2: { tone: 'warranty', label: 'P2 Warranty' },
  P3: { tone: 'paid',     label: 'P3 Paid' },
};

export default function PriorityBadge({ priority, dense = false, label }) {
  const meta = META[priority] || { tone: 'neutral', label: priority || '—' };
  return (
    <span
      className={`${styles.badge} ${styles[meta.tone]} ${dense ? styles.dense : ''}`}
    >
      {label || meta.label}
    </span>
  );
}

/** A tiny dot rendered alongside priority labels (used in CRM filter row). */
export function PriorityDot({ priority }) {
  const meta = META[priority] || { tone: 'neutral' };
  return <span className={`${styles.dot} ${styles[meta.tone]}`} aria-hidden="true" />;
}
