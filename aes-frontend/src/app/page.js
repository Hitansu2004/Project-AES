'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, defaultRouteForRole } from '@/context/AuthContext';

export default function HomeRedirector() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    router.replace(defaultRouteForRole(user.role));
  }, [user, loading, router]);

  return (
    <div className="loading-page">
      <div className="spinner" />
    </div>
  );
}
