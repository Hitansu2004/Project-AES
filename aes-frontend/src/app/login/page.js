'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Lock, ArrowRight, Sparkles, ChevronLeft } from 'lucide-react';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import OtpInput from '@/components/ui/OtpInput';
import Logo from '@/components/ui/Logo';
import styles from './login.module.css';

const PHONE_REGEX = /^[6-9]\d{9}$/;
const OTP_TTL_SECONDS = 600; // 10-minute validity per spec
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
  const { user, loading: authLoading, sendOtp, loginWithOtp, staffLogin } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState('customer');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Already signed in? Bounce to the right home.
  useEffect(() => {
    if (authLoading || !user) return;
    const next = search.get('next') || defaultRouteForRole(user.role);
    router.replace(next);
  }, [user, authLoading, router, search]);

  // Tick OTP and resend countdowns
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
      toast.success(`Welcome back${data.user?.name ? ', ' + data.user.name.split(' ')[0] : ''}.`);
      router.replace(next);
    } catch (err) {
      setError(err.message || 'OTP verification failed.');
      setOtp('');
    } finally {
      setBusy(false);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!PHONE_REGEX.test(staffPhone)) {
      setError('Enter a valid 10-digit phone number.');
      return;
    }
    if (!password) { setError('Enter your password.'); return; }
    setBusy(true);
    try {
      const data = await staffLogin(`+91${staffPhone}`, password);
      const next = search.get('next') || defaultRouteForRole(data.user?.role);
      toast.success(`Welcome, ${data.user?.name || 'Agent'}.`);
      router.replace(next);
    } catch (err) {
      setError(err.message || 'Login failed.');
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
      {/* decorative gradient blob */}
      <div className={styles.blob} aria-hidden="true" />

      <div className={styles.shell}>
        <motion.div
          className={styles.brand}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Logo size="lg" showWordmark={false} />
          <h1 className={styles.title}>Arial Engineering</h1>
          <p className={styles.subtitle}>Your HVAC service portal</p>
        </motion.div>

        <motion.section
          className={styles.card}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className={styles.tabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'customer'}
              className={`${styles.tab} ${mode === 'customer' ? styles.tabActive : ''}`}
              onClick={() => { setMode('customer'); setStep('phone'); setError(''); }}
            >
              Customer
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'staff'}
              className={`${styles.tab} ${mode === 'staff' ? styles.tabActive : ''}`}
              onClick={() => { setMode('staff'); setError(''); }}
            >
              Staff
            </button>
            <span
              className={styles.tabIndicator}
              style={{ transform: `translateX(${mode === 'staff' ? '100%' : '0%'})` }}
              aria-hidden="true"
            />
          </div>

          <AnimatePresence mode="wait">
            {mode === 'customer' && step === 'phone' && (
              <motion.form
                key="phone"
                onSubmit={handleSendOtp}
                className={styles.form}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
              >
                <div className={styles.heading}>
                  <h2 className={styles.h2}>Welcome back</h2>
                  <p className={styles.h2sub}>Sign in with your mobile number.</p>
                </div>

                <div className="input-group">
                  <label htmlFor="phone">Mobile number</label>
                  <div className={styles.phoneRow}>
                    <span className={styles.flag} aria-hidden="true">
                      <span className={styles.flagDot} /> +91
                    </span>
                    <input
                      id="phone"
                      className={`input ${styles.phoneInput}`}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      required
                    />
                  </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <button
                  className="btn btn-primary btn-full btn-lg"
                  disabled={busy || phone.length !== 10}
                  type="submit"
                >
                  {busy ? <span className="spinner spinner-sm" /> : <>Send OTP <ArrowRight size={18} /></>}
                </button>

                <p className={styles.helper}>
                  By continuing you agree to our service terms. SMS rates may apply.
                </p>
              </motion.form>
            )}

            {mode === 'customer' && step === 'otp' && (
              <motion.form
                key="otp"
                onSubmit={(e) => { e.preventDefault(); handleVerify(); }}
                className={styles.form}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
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
                    We sent a 6-digit code to <strong>+91 {phone}</strong>
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
                  <span className="label-md">
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
                  className="btn btn-primary btn-full btn-lg"
                  disabled={busy || otp.length !== 6}
                  type="submit"
                >
                  {busy ? <span className="spinner spinner-sm" /> : <>Verify &amp; Sign In <ArrowRight size={18} /></>}
                </button>
              </motion.form>
            )}

            {mode === 'staff' && (
              <motion.form
                key="staff"
                onSubmit={handleStaffLogin}
                className={styles.form}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
              >
                <div className={styles.heading}>
                  <h2 className={styles.h2}>Staff sign in</h2>
                  <p className={styles.h2sub}>For CRM agents, managers and admins.</p>
                </div>

                <div className="input-group">
                  <label htmlFor="staff-phone">Phone</label>
                  <div className={styles.phoneRow}>
                    <span className={styles.flag} aria-hidden="true">
                      <Phone size={14} /> +91
                    </span>
                    <input
                      id="staff-phone"
                      className={`input ${styles.phoneInput}`}
                      type="tel"
                      inputMode="numeric"
                      placeholder="98000 00001"
                      value={staffPhone}
                      onChange={(e) => setStaffPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="staff-password">Password</label>
                  <div className={styles.passwordRow}>
                    <Lock size={14} className={styles.passwordIcon} />
                    <input
                      id="staff-password"
                      className={`input ${styles.passwordInput}`}
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <button
                  className="btn btn-secondary btn-full btn-lg"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? <span className="spinner spinner-sm" /> : <>Sign in <ArrowRight size={18} /></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.section>

        <p className={styles.support}>
          Need help? Call us at <a href="tel:+914023540000">+91 40-2354-XXXX</a>
        </p>
      </div>
    </div>
  );
}
