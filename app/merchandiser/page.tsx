'use client';

import React from 'react';
import { MerchandiserProvider } from '@/context/MerchandiserContext';
import { MerchandiserDashboard } from '@/components/features/merchandiser/MerchandiserDashboard';

// This would normally get session from server component
// For now, using client-side approach
export default function MerchandiserPage() {
  const [sessionData, setSessionData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const payload = await response.json().catch(() => null);

        if (mounted && response.ok && payload) {
          setSessionData({
            id: payload.id,
            role: payload.role,
            branch: payload.branch,
            name: payload.name || payload.username
          });
          return;
        }
      } catch (e) {
        console.error('Failed to fetch authenticated session:', e);
      }

      const localUser = localStorage.getItem('user');
      if (!mounted || !localUser) {
        setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(localUser);
        setSessionData(parsed);
      } catch (e) {
        console.error('Failed to parse local user data:', e);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchSession().finally(() => {
      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <MerchandiserProvider
      initialRole={sessionData?.role}
      initialBranch={sessionData?.branch}
      initialUserId={sessionData?.id}
    >
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <MerchandiserDashboard />
        </div>
      </div>
    </MerchandiserProvider>
  );
}
