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
    // Get session from cookie
    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(c => c.trim().startsWith('session='));
    
    if (sessionCookie) {
      try {
        const sessionValue = sessionCookie.split('=')[1];
        const decoded = decodeURIComponent(sessionValue);
        const data = JSON.parse(decoded);
        setSessionData(data);
      } catch (e) {
        console.error('Failed to parse session:', e);
      }
    }
    setLoading(false);
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
