'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  auth as authApi,
  user as userApi,
  clearAuthTokens,
  setAuthFailureHandler,
} from '@/lib/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'aes_token';
const REFRESH_KEY = 'aes_refresh_token';

function persistTokens(accessToken, refreshToken) {
  if (typeof window === 'undefined') return;
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return null;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await userApi.getMe();
      setUser(me);
      return me;
    } catch {
      clearAuthTokens();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Wire global auth-failure handler so 401s after refresh-fail force a redirect.
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      router.replace('/login');
    });
    return () => setAuthFailureHandler(null);
  }, [router]);

  const sendOtp = useCallback(async (phoneNumber) => {
    return authApi.sendOtp(phoneNumber);
  }, []);

  const loginWithOtp = useCallback(async (phoneNumber, otp) => {
    const data = await authApi.verifyOtp(phoneNumber, otp);
    persistTokens(data.accessToken, data.refreshToken);
    setUser(data.user || null);
    return data;
  }, []);

  const staffLogin = useCallback(async (phoneNumber, password) => {
    const data = await authApi.staffLogin(phoneNumber, password);
    persistTokens(data.accessToken, data.refreshToken);
    setUser(data.user || null);
    return data;
  }, []);

  const logout = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (refresh) await authApi.logout(refresh);
    } catch { /* ignore */ }
    clearAuthTokens();
    setUser(null);
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, fetchUser, sendOtp, loginWithOtp, staffLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Default route for a given role. */
export function defaultRouteForRole(role) {
  if (role === 'CRM_AGENT') return '/crm';
  if (role === 'SERVICE_MANAGER' || role === 'ADMIN') return '/admin';
  return '/dashboard';
}
