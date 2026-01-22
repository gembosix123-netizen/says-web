'use client';

import React, { useEffect, useState } from 'react';
import SalesWizard from '@/components/SalesWizard';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [role, setRole] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    // Client-side session check
    const user = localStorage.getItem('user');
    if (!user) {
        router.push('/');
        return;
    }

    try {
        const userData = JSON.parse(user);
        setRole(userData.role);
    } catch (e) {
        router.push('/');
    }
  }, [router]);

  if (!role) return null; // Or a loading spinner

  return <SalesWizard role={role} />;
}
