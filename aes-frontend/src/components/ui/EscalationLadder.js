'use client';

import { motion } from 'framer-motion';
import { Check, AlertCircle, Info, Clock } from 'lucide-react';
import { formatRemaining } from '@/hooks/useSlaCountdown';
import styles from './EscalationLadder.module.css';

const TIERS = [
  {
    level: 1,
    title: 'Level 1 — CRM Team',
    standbyDesc: 'Initial response & triage',
    activeDesc: 'Currently handling your ticket',
    pastDesc: 'Did not respond within 30 minutes',
  },
  {
    level: 2,
    title: 'Level 2 — Service Managers',
    standbyDesc: 'Auto-escalates if no CRM response in 30 min',
    activeDesc: 'Service managers handling your ticket',
    pastDesc: 'Service managers escalated to management',
  },
  {
    level: 3,
    title: 'Level 3 — Management',
    standbyDesc: 'Escalates if unresolved after Level 2',
    activeDesc: 'Management is handling your ticket',
    pastDesc: 'Resolved by management',
  },
];

/**
 * Escalation ladder — visual timeline of L1 → L2 → L3.
 *
 * Props:
 *   currentLevel        — 1 | 2 | 3
 *   slaRemainingSeconds — seconds remaining at the current level (optional)
 *   acknowledgedAtCurrentLevel — boolean, dims the live countdown if true
 */
export default function EscalationLadder({
  currentLevel = 1,
  slaRemainingSeconds = null,
  acknowledgedAtCurrentLevel = false,
}) {
  return (
    <div className={styles.wrap}>
      {TIERS.map((t, idx) => {
        let phase;
        if (t.level < currentLevel) phase = 'past';
        else if (t.level === currentLevel) phase = 'active';
        else phase = 'standby';

        return (
          <motion.div
            key={t.level}
            className={`${styles.tier} ${styles[phase]}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.06 }}
          >
            <div className={styles.indicatorCol}>
              <div className={styles.dot}>
                {phase === 'past'   && <Check size={12} strokeWidth={3} />}
                {phase === 'active' && <span className={styles.pulse} />}
                {phase === 'standby' && null}
              </div>
              {idx < TIERS.length - 1 && <div className={styles.connector} />}
            </div>

            <div className={styles.body}>
              <h4 className={styles.title}>{t.title}</h4>
              <p className={styles.desc}>
                {phase === 'active'  && t.activeDesc}
                {phase === 'past'    && t.pastDesc}
                {phase === 'standby' && t.standbyDesc}
              </p>

              {phase === 'active' && slaRemainingSeconds != null && !acknowledgedAtCurrentLevel && (
                <div className={styles.activeMeta}>
                  <Clock size={14} />
                  <span>Response expected in {formatRemaining(slaRemainingSeconds)}</span>
                </div>
              )}
              {phase === 'active' && acknowledgedAtCurrentLevel && (
                <div className={styles.activeMetaAck}>
                  <Check size={14} strokeWidth={3} /> Acknowledged
                </div>
              )}
              {phase === 'standby' && (
                <p className={styles.statusItalic}>Status: On standby</p>
              )}
              {phase === 'past' && (
                <p className={styles.statusItalic}>
                  <AlertCircle size={12} /> Auto-escalated
                </p>
              )}
            </div>
          </motion.div>
        );
      })}

      <div className={styles.infoBox}>
        <Info size={16} />
        <p>Escalation is automatic. You will be notified at each step.</p>
      </div>
    </div>
  );
}
