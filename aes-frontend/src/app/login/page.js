'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { auth as authApi } from '@/lib/api';
import styles from './login.module.css';

export default function LoginPage() {
  const [mode, setMode] = useState('customer'); // 'customer' | 'staff'
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const { loginWithOtp, staffLogin } = useAuth();
  const router = useRouter();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formattedPhone = phone.length === 10 ? `+91${phone}` : phone;
      const res = await authApi.sendOtp(formattedPhone);
      // Removed dev autofill
      setOtpSent(true);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formattedPhone = phone.length === 10 ? `+91${phone}` : phone;
      await loginWithOtp(formattedPhone, otp);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formattedPhone = staffPhone.length === 10 ? `+91${staffPhone}` : staffPhone;
      const data = await staffLogin(formattedPhone, password);
      // Route based on role
      if (data.role === 'CRM_AGENT') router.push('/crm');
      else if (data.role === 'SERVICE_MANAGER' || data.role === 'ADMIN') router.push('/admin');
      else router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.logoSection}>
          <div className={styles.logo}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0099CC" strokeWidth="1.5">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
          <h1 className={styles.title}>Arial Engineering</h1>
          <p className={styles.subtitle}>HVAC Customer Portal</p>
        </div>

        <div className={styles.tabSwitch}>
          <button
            className={`${styles.tab} ${mode === 'customer' ? styles.tabActive : ''}`}
            onClick={() => { setMode('customer'); setStep('phone'); setError(''); }}
          >
            Customer Login
          </button>
          <button
            className={`${styles.tab} ${mode === 'staff' ? styles.tabActive : ''}`}
            onClick={() => { setMode('staff'); setError(''); }}
          >
            Staff Login
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {mode === 'customer' ? (
          step === 'phone' ? (
            <form onSubmit={handleSendOtp} className={styles.form}>
              <div className="input-group">
                <label>Phone Number</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <button className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? 'Sending...' : 'Send OTP →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className={styles.form}>
              <p className={styles.otpInfo}>
                OTP sent to <strong>{phone}</strong>
              </p>
              <div className="input-group">
                <label>Enter OTP</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              <button className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Login →'}
              </button>
              <button type="button" className="btn btn-ghost btn-full" onClick={() => { setStep('phone'); setOtp(''); }}>
                ← Change phone number
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleStaffLogin} className={styles.form}>
            <div className="input-group">
              <label>Phone Number</label>
              <input
                className="input"
                type="tel"
                placeholder="9876543210"
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input
                className="input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-secondary btn-full btn-lg" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>
        )}

        <p className={styles.footer}>
          Need help? Call us at <a href="tel:+914023540000" className={styles.link}>+91 40-2354-XXXX</a>
        </p>
      </div>
    </div>
  );
}
