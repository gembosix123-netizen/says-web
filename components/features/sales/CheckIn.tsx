import React, { useState } from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function CheckIn() {
  const { selectedCustomer, setCheckInTime, setGpsLocation, setStep } = useSales();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleCheckIn = () => {
    if (!navigator.onLine) {
        alert(t('error_offline') || "No internet connection. Please check your connection.");
        // Note: We might allow check-in offline in future but for now warn user
    }

    setLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCheckInTime(new Date());
          setGpsLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLoading(false);
          setStep(3);
        },
        () => {
          setLoading(false);
          alert(t('gps_required'));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLoading(false);
      alert(t('gps_required'));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
        {/* Background Decoration - Removed negative z-index so it sits on top of bg-white */}
        <div className="absolute top-0 left-0 right-0 h-[40%] bg-slate-900 rounded-b-[3rem]" />

        {/* Content - Added relative and z-10 to ensure it sits on top of the decoration */}
        <div className="flex-1 flex flex-col items-center pt-10 px-6 relative z-10">
            <div className="text-center space-y-2 text-white mb-8">
                <p className="opacity-80 uppercase tracking-widest text-sm font-medium">{t('check_in_at')}</p>
                <h2 className="text-3xl font-bold px-4">{selectedCustomer?.name}</h2>
                <p className="text-slate-300 max-w-xs mx-auto text-sm">{selectedCustomer?.address}</p>
            </div>

            {/* Visual Indicator */}
            <div className="relative mb-auto">
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20 duration-1000"></div>
                <div className="w-40 h-40 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-blue-50 relative z-10">
                    <MapPin size={56} className="text-blue-600" />
                </div>
                {/* Small indicator badge */}
                <div className="absolute bottom-2 right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-white z-20"></div>
            </div>

            <div className="w-full flex flex-col gap-3 pb-6 max-w-sm">
                <Button 
                    variant="secondary"
                    onClick={handleCheckIn}
                    disabled={loading}
                    className="w-full py-6 text-lg font-bold shadow-xl transform transition-all active:scale-95 rounded-2xl flex items-center justify-center gap-3"
                >
                    {loading ? <Loader2 className="animate-spin" size={24} /> : <MapPin size={24} />}
                    {loading ? t('loading') : t('confirm_checkin')}
                </Button>

                 <a
                    href={selectedCustomer?.lat && selectedCustomer?.lon ? `https://www.google.com/maps/search/?api=1&query=${selectedCustomer.lat},${selectedCustomer.lon}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedCustomer?.name + ' ' + selectedCustomer?.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 text-slate-600 font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                    <Navigation size={20} /> {t('open_maps')}
                </a>
                
                <Button variant="ghost" onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-600 hover:bg-transparent">
                    {t('back')}
                </Button>
            </div>
        </div>
    </div>
  );
}
