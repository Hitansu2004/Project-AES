'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { NOTIFICATION_TOAST_EVENT } from '@/context/NotificationContext';

const TYPE_TONE = {
  TICKET_ESCALATED: 'info',
  TICKET_RESOLVED: 'success',
  TICKET_ASSIGNED: 'success',
  TICKET_RAISED: 'info',
  AMC_REMINDER: 'info',
  INSTALLATION_UPDATE: 'success',
};

/**
 * Listens for live notifications dispatched by {@link NotificationContext} and
 * shows them as toasts on every page — except when the user is already
 * looking at the notifications page (we'd be doubling up).
 */
export default function NotificationToastBridge() {
  const toast = useToast();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (e) => {
      const n = e.detail;
      if (!n || n.read) return;
      if (pathname?.startsWith('/notifications')) return;
      const tone = TYPE_TONE[n.type] || 'info';
      const fn = toast[tone] || toast.info;
      fn?.(n.title);
    };
    window.addEventListener(NOTIFICATION_TOAST_EVENT, handler);
    return () => window.removeEventListener(NOTIFICATION_TOAST_EVENT, handler);
  }, [toast, pathname]);

  return null;
}
