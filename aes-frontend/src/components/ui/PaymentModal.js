'use client';

/**
 * Razorpay-style mock payment modal.
 *
 * Lifecycle:
 *   1. We call POST /payments/intent  → returns paymentId + orderId
 *   2. Modal opens, lets the user pick a method (UPI / Card / NB)
 *      and type the demo OTP `0000`.
 *   3. We call POST /payments/{id}/confirm → spinner → SUCCESS or FAILED
 *   4. On SUCCESS we resolve the promise with the paymentId so the
 *      caller can attach it to the ticket / draft.
 *
 * Designed so that swapping to a real Razorpay checkout is a single
 * file change — the props and the success contract stay the same.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Smartphone, CreditCard, Building2, ShieldCheck, Loader2,
  CheckCircle2, AlertCircle, Lock, IndianRupee,
} from 'lucide-react';
import { payments as paymentsApi } from '@/lib/api';
import { useToast } from './Toast';

const METHODS = [
  { id: 'MOCK_UPI',   label: 'UPI',         hint: 'Pay via GPay / PhonePe / Paytm', Icon: Smartphone, color: '#5f6cea' },
  { id: 'MOCK_CARD',  label: 'Credit / Debit Card', hint: 'Visa, Mastercard, RuPay', Icon: CreditCard, color: '#0ea5e9' },
  { id: 'MOCK_NB',    label: 'NetBanking',  hint: 'All major banks',          Icon: Building2,  color: '#14b8a6' },
];

export default function PaymentModal({
  open,
  amount,
  description,
  customerName,
  customerPhone,
  draftId,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const [phase, setPhase]       = useState('idle');         // idle / method / otp / processing / success / failed
  const [method, setMethod]     = useState(METHODS[0].id);
  const [otp, setOtp]           = useState('');
  const [intent, setIntent]     = useState(null);
  const [error, setError]       = useState('');

  // Boot the intent when modal opens
  useEffect(() => {
    if (!open) return;
    setPhase('idle');
    setOtp('');
    setError('');
    let cancelled = false;
    (async () => {
      try {
        const data = await paymentsApi.createIntent({ amount, draftId });
        if (!cancelled) {
          setIntent(data);
          setPhase('method');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Could not start payment');
          setPhase('failed');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, amount, draftId]);

  const handleConfirm = useCallback(async () => {
    if (!intent?.paymentId) return;
    setPhase('processing');
    setError('');
    // visible "buffering" delay to feel like a real gateway
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await paymentsApi.confirm(intent.paymentId, { otp, method });
      if (res.status === 'SUCCESS') {
        setPhase('success');
        toast.success('Payment successful');
        // brief celebration before resolving
        setTimeout(() => onSuccess?.({ paymentId: intent.paymentId, amount }), 1200);
      } else {
        setPhase('failed');
        setError(res.failureReason || 'Payment failed — try again');
      }
    } catch (e) {
      setPhase('failed');
      setError(e?.message || 'Payment failed');
    }
  }, [intent, otp, method, amount, onSuccess, toast]);

  if (!open) return null;

  const inr = '₹' + Number(amount || 0).toLocaleString('en-IN');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={overlay}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          style={card}
        >
          {/* Header — mimicking Razorpay */}
          <div style={header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={brandDot}>
                <ShieldCheck size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>AES Payments</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Secure · Demo gateway · {intent?.gateway || 'MOCK'}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={closeBtn} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Amount */}
          <div style={amountBox}>
            <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase' }}>Amount</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <IndianRupee size={20} />
              <span style={{ fontSize: 28, fontWeight: 800 }}>{Number(amount).toLocaleString('en-IN')}</span>
            </div>
            {description && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{description}</div>}
            {customerName && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                Paying as {customerName}{customerPhone ? ` · ${customerPhone}` : ''}
              </div>
            )}
          </div>

          {/* Body */}
          <div style={{ padding: 16 }}>
            {phase === 'idle' && (
              <Centered><Loader2 className="spin" size={26} /> <p>Setting up secure session…</p></Centered>
            )}

            {phase === 'method' && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 10 }}>
                  Select payment method
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {METHODS.map(({ id, label, hint, Icon, color }) => (
                    <button
                      key={id}
                      onClick={() => setMethod(id)}
                      style={{
                        ...methodBtn,
                        borderColor: method === id ? color : 'var(--border-light, #e2e8f0)',
                        background: method === id ? `${color}10` : 'var(--surface-container-low, #f8fafc)',
                      }}
                    >
                      <span style={{ ...methodIcon, background: color }}>
                        <Icon size={16} color="#fff" />
                      </span>
                      <span style={{ flex: 1, textAlign: 'left' }}>
                        <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{label}</span>
                        <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>{hint}</span>
                      </span>
                      {method === id && <CheckCircle2 size={18} color={color} />}
                    </button>
                  ))}
                </div>

                {/* OTP input */}
                <div style={{ marginTop: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                    Enter OTP from your bank
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    style={otpInput}
                  />
                  {intent?.mockMode && (
                    <div style={demoHint}>
                      <Lock size={12} /> Demo mode — use OTP <b>{intent.demoSuccessOtp}</b> to succeed.
                    </div>
                  )}
                </div>

                <button onClick={handleConfirm} disabled={!otp} style={payBtn(!otp)}>
                  Pay {inr}
                </button>
                <p style={tos}>By continuing you agree to our terms & refund policy.</p>
              </>
            )}

            {phase === 'processing' && (
              <Centered>
                <Loader2 className="spin" size={42} color="#0ea5e9" />
                <p style={{ fontWeight: 600, marginTop: 14 }}>Processing your payment…</p>
                <p style={{ fontSize: 12, color: '#64748b' }}>Please don't close this window.</p>
              </Centered>
            )}

            {phase === 'success' && (
              <Centered>
                <div style={successCircle}><CheckCircle2 size={36} color="#fff" /></div>
                <p style={{ fontWeight: 700, marginTop: 14, fontSize: 16 }}>Payment successful</p>
                <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', maxWidth: 280 }}>
                  Your ticket is being created. You'll see it in <b>My Tickets</b> shortly.
                </p>
              </Centered>
            )}

            {phase === 'failed' && (
              <Centered>
                <div style={failCircle}><AlertCircle size={36} color="#fff" /></div>
                <p style={{ fontWeight: 700, marginTop: 14, fontSize: 15 }}>Payment failed</p>
                <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', maxWidth: 280 }}>{error}</p>
                <button onClick={() => { setPhase('method'); setOtp(''); }} style={retryBtn}>Try again</button>
              </Centered>
            )}
          </div>

          {/* Footer */}
          <div style={footer}>
            <Lock size={12} color="#64748b" />
            <span>256-bit secure connection</span>
            <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>RBI compliant gateway · {intent?.gateway || 'MOCK'}</span>
          </div>
        </motion.div>

        <style jsx>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}

function Centered({ children }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: '24px 12px',
    }}>
      {children}
    </div>
  );
}

// ── inline styles (kept self-contained so we don't add CSS files) ──
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  backdropFilter: 'blur(2px)',
};
const card = {
  background: 'var(--surface, #fff)', color: 'var(--on-surface, #0f172a)',
  borderRadius: 16, width: 'min(420px, 100%)', overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};
const header = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px', borderBottom: '1px solid var(--border-light, #e2e8f0)',
};
const brandDot = {
  width: 32, height: 32, borderRadius: 8,
  background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const closeBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b',
  width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const amountBox = {
  background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#fff',
  padding: '14px 16px',
};
const methodBtn = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 12px', borderRadius: 10, border: '1px solid', cursor: 'pointer',
  transition: 'all 150ms', textAlign: 'left',
};
const methodIcon = {
  width: 30, height: 30, borderRadius: 8, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
};
const otpInput = {
  marginTop: 8, width: '100%', padding: '12px 14px',
  fontSize: 22, letterSpacing: 8, textAlign: 'center', fontWeight: 700,
  border: '1px solid var(--border-light, #cbd5e1)', borderRadius: 10,
  background: 'var(--surface-container-low, #fff)', color: 'var(--on-surface, #0f172a)',
};
const demoHint = {
  marginTop: 8, fontSize: 11, color: '#475569',
  display: 'flex', alignItems: 'center', gap: 6,
  background: 'var(--surface-container-low, #f1f5f9)', padding: '6px 10px', borderRadius: 8,
};
const payBtn = (disabled) => ({
  marginTop: 16, width: '100%', padding: '12px',
  background: disabled ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
  color: '#fff', border: 'none', borderRadius: 10,
  fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
});
const tos = {
  fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 8,
};
const successCircle = {
  width: 64, height: 64, borderRadius: '50%',
  background: 'linear-gradient(135deg, #10b981, #22c55e)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const failCircle = {
  width: 64, height: 64, borderRadius: '50%',
  background: 'linear-gradient(135deg, #ef4444, #f97316)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const retryBtn = {
  marginTop: 12, padding: '8px 18px',
  background: 'var(--surface-container, #e2e8f0)', color: 'var(--on-surface, #0f172a)',
  border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
};
const footer = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '10px 16px', borderTop: '1px solid var(--border-light, #e2e8f0)',
  fontSize: 11, color: '#475569',
};
