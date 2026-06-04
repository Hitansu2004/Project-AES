'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RoseSplash from '@/components/rose/RoseSplash';

export default function SelectRequestTypeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/services');
  }, [router]);
  return <RoseSplash message="Opening services hub…" />;
}
