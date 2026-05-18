'use client';

import { useState } from 'react';
import { Power } from 'lucide-react';
import { staff } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

/**
 * Single-button shift toggle for CRM agents and site engineers.
 *
 * When the user goes OFF shift, the backend automatically hands off
 * any open tickets / pending offers (see StaffShiftService). The button
 * is purposely chunky and red-when-off so it never gets clicked twice
 * by accident.
 *
 * Props:
 *   onShift      — current value (boolean, from /users/me .staff?.onShift)
 *   onChange     — callback(newValue)
 *   compact      — render as a small pill (top-bar version)
 */
export default function ShiftToggle({ onShift, onChange, compact = false }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(!!onShift);

  const toggle = async () => {
    const next = !value;
    if (!next && !confirm('End your shift?\n\nOpen tickets and offers will be handed back to the Ops Manager.')) return;
    setBusy(true);
    try {
      await staff.toggleShift({ onShift: next });
      setValue(next);
      toast.success(next ? 'You are now on shift.' : 'Shift ended. Handoff complete.');
      onChange?.(next);
    } catch (err) {
      toast.error(err?.message || 'Could not toggle shift.');
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={value ? 'You are on shift — click to end shift' : 'You are off shift — click to start shift'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 999,
          border: '1px solid',
          borderColor: value ? 'var(--success)' : 'var(--outline-variant)',
          background: value ? 'var(--success-light)' : 'var(--surface-container)',
          color: value ? 'var(--success)' : 'var(--on-surface-variant)',
          fontSize: 12,
          fontWeight: 700,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
          transition: 'all .15s ease',
        }}
      >
        <Power size={13} />
        {value ? 'ON SHIFT' : 'OFF SHIFT'}
      </button>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--surface-container-lowest)',
        border: `1px solid ${value ? 'var(--success)' : 'var(--outline-variant)'}`,
        borderRadius: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>
          {value ? 'You are on shift' : 'You are off shift'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>
          {value
            ? 'You will receive new offers and ticket pings.'
            : 'No new offers will be routed to you.'}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        style={{
          padding: '10px 18px',
          borderRadius: 999,
          border: 'none',
          background: value ? 'var(--error)' : 'var(--success)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
          minWidth: 110,
        }}
      >
        {value ? 'End shift' : 'Start shift'}
      </button>
    </div>
  );
}
