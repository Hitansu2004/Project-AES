'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi, user as userApi } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('aes_token');
      if (!token) { setLoading(false); return; }
      const userData = await userApi.getMe();
      setUser(userData);
    } catch {
      localStorage.removeItem('aes_token');
      localStorage.removeItem('aes_refresh_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const loginWithOtp = async (phoneNumber, otp) => {
    const data = await authApi.verifyOtp(phoneNumber, otp);
    localStorage.setItem('aes_token', data.accessToken);
    localStorage.setItem('aes_refresh_token', data.refreshToken);
    await fetchUser();
    return data;
  };

  const staffLogin = async (phoneNumber, password) => {
    const data = await authApi.staffLogin(phoneNumber, password);
    localStorage.setItem('aes_token', data.accessToken);
    localStorage.setItem('aes_refresh_token', data.refreshToken);
    await fetchUser();
    return data;
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('aes_refresh_token');
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* ignore */ }
    localStorage.removeItem('aes_token');
    localStorage.removeItem('aes_refresh_token');
    setUser(null);
  };

  const value = { user, loading, loginWithOtp, staffLogin, logout, fetchUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
