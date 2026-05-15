'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { notifications as notifApi } from '@/lib/api';
import { subscribeTopic } from '@/lib/websocket/stompClient';
import { useAuth } from '@/context/AuthContext';

/**
 * Live notifications store — feeds the global bell + the dedicated
 * /notifications page from a single source of truth.
 *
 * The provider:
 *   - fetches the recent feed once when the user signs in
 *   - subscribes to /topic/users/{userId}/notifications for live pushes
 *   - polls every 60 s as a fallback when the socket is napping
 */
const NotificationContext = createContext(null);

const POLL_INTERVAL_MS = 60_000;
const TOAST_EVENT = 'aes:notification';

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const lastFetchedAt = useRef(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    if (loading) return;
    if (Date.now() - lastFetchedAt.current < 300) return;
    lastFetchedAt.current = Date.now();
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        notifApi.list(50),
        notifApi.unreadCount(),
      ]);
      setItems(Array.isArray(list) ? list : []);
      setUnread(count?.count ?? 0);
    } catch {
      /* network errors are non-fatal here */
    } finally {
      setLoading(false);
    }
  }, [user, loading]);

  // Initial fetch + polling
  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return undefined;
    }
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Live socket
  useEffect(() => {
    if (!user?.id) return undefined;
    const dest = `/topic/users/${user.id}/notifications`;
    const unsubscribe = subscribeTopic(dest, (payload) => {
      if (!payload || typeof payload !== 'object') return;
      setItems((prev) => {
        // de-dup by id
        if (prev.some((n) => n.id === payload.id)) return prev;
        return [payload, ...prev].slice(0, 80);
      });
      if (!payload.read) setUnread((u) => u + 1);
      // Let consumers (e.g. ToastListener) decide whether to surface a toast.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
      }
    });
    return unsubscribe;
  }, [user?.id]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await notifApi.markRead(id); }
    catch { /* leave optimistic state — refresh later */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await notifApi.markAllRead(); }
    catch { /* ignore */ }
  }, []);

  const value = {
    items,
    unread,
    loading,
    refresh,
    markRead,
    markAllRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Safe fallback — components can still render without a provider in tests.
    return {
      items: [],
      unread: 0,
      loading: false,
      refresh: () => {},
      markRead: () => {},
      markAllRead: () => {},
    };
  }
  return ctx;
}

export const NOTIFICATION_TOAST_EVENT = TOAST_EVENT;
