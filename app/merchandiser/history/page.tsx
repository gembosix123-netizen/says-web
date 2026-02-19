'use client';

import React from 'react';
import { MerchandiserProvider } from '@/context/MerchandiserContext';
import { VisitHistory } from '@/components/features/merchandiser/VisitHistory';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HistoryPage() {
  const [sessionData, setSessionData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();

  React.useEffect(() => {
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
          <div className="mb-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/merchandiser')}
              className="gap-2"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </Button>
          </div>
          <VisitHistory />
        </div>
      </div>
    </MerchandiserProvider>
  );
}
