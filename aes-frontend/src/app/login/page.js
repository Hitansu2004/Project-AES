'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Snowflake,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import OtpInput from '@/components/ui/OtpInput';
import styles from './login.module.css';

const PHONE_REGEX = /^[6-9]\d{9}$/;
const OTP_TTL_SECONDS = 600;
const RESEND_COOLDOWN = 60;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="loading-page"><div className="spinner" /></div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, loading: authLoading, sendOtp, loginWithOtp } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    const next = search.get('next') || defaultRouteForRole(user.role);
    router.replace(next);
  }, [user, authLoading, router, search]);

  useEffect(() => {
    if (otpExpiresIn <= 0) return;
    const t = setInterval(() => setOtpExpiresIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [otpExpiresIn]);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const otpExpiryLabel = useMemo(() => {
    if (otpExpiresIn <= 0) return 'expired';
    const m = Math.floor(otpExpiresIn / 60);
    const s = otpExpiresIn % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [otpExpiresIn]);

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError('');
    if (!PHONE_REGEX.test(phone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    try {
      const res = await sendOtp(`+91${phone}`);
      setOtp('');
      setDemoOtp(res?.otpForDemo || '');
      setOtpExpiresIn(res?.expiresInSeconds || OTP_TTL_SECONDS);
      setResendCooldown(RESEND_COOLDOWN);
      setStep('otp');
      toast.info('OTP sent. Check your phone.');
    } catch (err) {
      setError(err.message || 'Could not send OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (otpValue) => {
    const code = (otpValue || otp).trim();
    if (code.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await loginWithOtp(`+91${phone}`, code);
      const next = search.get('next') || defaultRouteForRole(data.user?.role);
      const firstName = data.user?.name ? data.user.name.split(' ')[0] : '';
      toast.success(`Welcome back${firstName ? ', ' + firstName : ''}.`);
      router.replace(next);
    } catch (err) {
      setError(err.message || 'OTP verification failed.');
      setOtp('');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || user) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <main className={styles.shell}>
        <motion.section
          className={styles.card}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className={styles.brand}>
            <div className={styles.brandChip} aria-hidden="true">
              <Snowflake size={30} strokeWidth={2.4} />
            </div>
            <h1 className={styles.wordmark}>Arial Engineering</h1>
            <span className={styles.brandTag}>HVAC Services Portal</span>
          </header>

          <AnimatePresence mode="wait">
            {step === 'phone' && (
              <motion.form
                key="phone"
                onSubmit={handleSendOtp}
                className={styles.form}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <div className={styles.heading}>
                  <h2 className={styles.h2}>Sign in</h2>
                  <p className={styles.h2sub}>
                    Customers and Arial staff sign in the same way. Enter your phone number to continue.
                  </p>
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="phone">Phone Number</label>
                  <div className={styles.phoneRow}>
                    <button
                      type="button"
                      className={styles.flagPill}
                      aria-label="Country code"
                      tabIndex={-1}
                    >
                      <span className={styles.flagCode}>+91</span>
                      <ChevronDown size={14} strokeWidth={2.4} />
                    </button>
                    <input
                      id="phone"
                      className={styles.phoneInput}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="000 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      required
                    />
                  </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <button
                  className={styles.cta}
                  disabled={busy || phone.length !== 10}
                  type="submit"
                >
                  {busy ? (
                    <span className="spinner spinner-sm" />
                  ) : (
                    <>
                      <span>Send OTP</span>
                      <ArrowRight size={18} className={styles.ctaIcon} />
                    </>
                  )}
                </button>

                <div className={styles.secureNote}>
                  <ShieldCheck size={14} strokeWidth={2.2} />
                  <span>Secure, password-free login. We send a one-time code to your phone.</span>
                </div>
              </motion.form>
            )}

            {step === 'otp' && (
              <motion.form
                key="otp"
                onSubmit={(e) => { e.preventDefault(); handleVerify(); }}
                className={styles.form}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  type="button"
                  className={styles.backLink}
                  onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                >
                  <ChevronLeft size={16} /> Change number
                </button>

                <div className={styles.heading}>
                  <h2 className={styles.h2}>Enter the OTP</h2>
                  <p className={styles.h2sub}>
                    We sent a 6-digit code to <strong>+91&nbsp;{phone}</strong>
                  </p>
                </div>

                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleVerify}
                  error={!!error}
                />

                {demoOtp && (
                  <motion.div
                    className={styles.demoBanner}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Sparkles size={14} /> Demo OTP: <strong>{demoOtp}</strong>
                  </motion.div>
                )}

                <div className={styles.timerRow}>
                  <span className={styles.timerLabel}>
                    {otpExpiresIn > 0 ? `Expires in ${otpExpiryLabel}` : 'OTP expired'}
                  </span>
                  <button
                    type="button"
                    className={styles.resend}
                    disabled={resendCooldown > 0 || busy}
                    onClick={() => handleSendOtp()}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <button
                  className={styles.cta}
                  disabled={busy || otp.length !== 6}
                  type="submit"
                >
                  {busy ? (
                    <span className="spinner spinner-sm" />
                  ) : (
                    <>
                      <span>Verify &amp; Sign In</span>
                      <ArrowRight size={18} className={styles.ctaIcon} />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <footer className={styles.legal}>
            <p>
              By signing in, you agree to our{' '}
              <a href="#" className={styles.legalLink}>Terms of Service</a>{' '}
              and{' '}
              <a href="#" className={styles.legalLink}>Privacy Policy</a>.
            </p>
          </footer>
        </motion.section>

        <p className={styles.support}>
          Need help? Call us at{' '}
          <a href="tel:+914023540000" className={styles.supportLink}>+91&nbsp;40-2354-XXXX</a>
        </p>
      </main>
    </div>
  );
}
