'use client';

import { useState } from 'react';
import { Power } from 'lucide-react';
import { staff } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

/**
 * Shift toggle for CRM agents and site engineers.
 *
 * End-shift is ALWAYS a soft pause: the user stops receiving new offers
 * and ticket pings, but every active ticket / install assignment stays
 * with them so the moment they come back on shift their inbox is intact.
 *
 * If a true work hand-off is ever needed (vacation, leave, role change),
 * that's an Ops Manager re-assignment task — never a single button click
 * on the agent's own toolbar.
 *
 * Props:
 *   onShift     — current value (boolean)
 *   onChange    — callback(newValue) after a successful toggle
 *   compact     — render as a small pill (top-bar version)
 *   activeWork  — { tickets, offers } counts shown next to the status text
 */
export default function ShiftToggle({ onShift, onChange, compact = false, activeWork }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(!!onShift);

  const toggle = async () => {
    const next = !value;
    setBusy(true);
    try {
      await staff.toggleShift({ onShift: next, handoffWork: false });
      setValue(next);
      toast.success(
        next
          ? 'You are now on shift.'
          : 'You are off shift. Your tickets are paused, not reassigned.'
      );
      onChange?.(next);
    } catch (err) {
      toast.error(err?.message || 'Could not toggle shift.');
    } finally {
      setBusy(false);
    }
  };

  const ticketCount = activeWork?.tickets ?? 0;
  const offerCount = activeWork?.offers ?? 0;
  const hasWork = ticketCount + offerCount > 0;

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={
          value
            ? 'You are on shift — click to pause (your tickets stay yours)'
            : 'You are off shift — click to come back on'
        }
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>
          {value ? 'You are on shift' : 'You are off shift'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2, lineHeight: 1.4 }}>
          {value ? (
            <>
              You will receive new offers and ticket pings.
              {hasWork && (
                <>
                  {' '}Currently holding <strong>{ticketCount}</strong>{' '}
                  ticket{ticketCount === 1 ? '' : 's'} ·{' '}
                  <strong>{offerCount}</strong> pending offer{offerCount === 1 ? '' : 's'}.
                </>
              )}
            </>
          ) : (
            <>
              No new offers will be routed to you. Existing tickets are{' '}
              <strong>still yours</strong> — toggle on to resume.
            </>
          )}
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
          background: value ? 'var(--on-surface-variant)' : 'var(--success)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
          minWidth: 110,
        }}
      >
        {value ? 'Pause shift' : 'Start shift'}
      </button>
    </div>
  );
}
