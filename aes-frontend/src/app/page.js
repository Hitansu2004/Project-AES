'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role === 'CRM_AGENT') router.replace('/crm');
    else if (user.role === 'SERVICE_MANAGER' || user.role === 'ADMIN') router.replace('/admin');
    else router.replace('/dashboard');
  }, [user, loading, router]);

  return (
    <div className="loading-page">
      <div className="spinner"></div>
      <p className="body-md" style={{ color: 'var(--outline)' }}>Loading...</p>
    </div>
  );
}
