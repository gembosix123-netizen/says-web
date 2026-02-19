'use client';

import React from 'react';
import { MerchandiserProvider } from '@/context/MerchandiserContext';
import { useMerchandiser } from '@/context/MerchandiserContext';
import { StoreSelector } from '@/components/features/merchandiser/StoreSelector';
import { VisitCheckIn } from '@/components/features/merchandiser/VisitCheckIn';
import { AuditChecklist } from '@/components/features/merchandiser/AuditChecklist';
import { PhotoCapture } from '@/components/features/merchandiser/PhotoCapture';
import { VisitSummary } from '@/components/features/merchandiser/VisitSummary';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

function VisitWizard() {
  const { step, setStep } = useMerchandiser();
  const router = useRouter();

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.push('/merchandiser');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return <StoreSelector />;
      case 2:
        return <VisitCheckIn />;
      case 3:
        return <AuditChecklist />;
      case 4:
        return <PhotoCapture />;
      case 5:
        return <VisitSummary />;
      default:
        return <StoreSelector />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Step Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            <div className="text-sm text-white/60">
              Step {step} of 5
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Current Step Content */}
        {renderStep()}
      </div>
    </div>
  );
}

export default function VisitPage() {
  const [sessionData, setSessionData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

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
      <VisitWizard />
    </MerchandiserProvider>
  );
}
