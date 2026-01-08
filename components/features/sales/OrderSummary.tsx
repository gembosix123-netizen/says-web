import React from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Camera, Save, Upload } from '@/components/Icons';
import Image from 'next/image';

export default function OrderSummary() {
  const { 
    selectedCustomer, cart, payment, calculateGrandTotal, 
    photoUrl, setPhotoUrl, 
    checkInTime, gpsLocation, setVisitedCustomers, setStep,
    exchangeItems
  } = useSales();
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!navigator.onLine) {
        alert(t('error_offline') || "Tiada sambungan internet. Sila periksa sambungan anda dan cuba lagi.");
        return;
    }

    setIsSubmitting(true);
    const payload = {
      checkInTime: checkInTime?.toISOString() || null,
      gps: gpsLocation,
      customer: selectedCustomer,
      items: cart.map((i) => ({ id: i.id, name: i.name, unit: i.unit, qty: i.quantity, price: i.price })),
      exchangeItems: exchangeItems || [], // Add this
      subtotal: calculateGrandTotal(), // Using same as total for now
      payment,
      total: calculateGrandTotal(),
      signatureUrl: null, // Removed signature
      photoUrl,
    };

    try {
        const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error(await res.text());
        }

        if (selectedCustomer) {
            setVisitedCustomers(prev => [...prev, selectedCustomer.id]);
        }
        setStep(7); // Success Screen
    } catch (error) {
        console.error("Submit error:", error);
        alert(t('error_submit_failed') || "Gagal menyimpan pesanan. Sila cuba lagi.");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">{t('confirm_submit')}</h2>
        <p className="text-slate-700">{t('welcome_subtitle')}</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-700">{t('customer_label')}</span>
          <span className="font-bold text-slate-900">{selectedCustomer?.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-700">{t('total_items')}</span>
          <span className="font-bold text-slate-900">{cart.reduce((acc, i) => acc + i.quantity, 0)} unit</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-700">{t('payment_method')}</span>
          <span className="font-bold text-slate-900 capitalize">{payment.method}</span>
        </div>
        <div className="flex justify-between text-lg pt-2 border-t border-slate-200">
          <span className="font-bold text-slate-900">{t('total')}</span>
          <span className="font-bold text-blue-700">{formatCurrency(calculateGrandTotal())}</span>
        </div>
      </div>

      <div className={`p-4 rounded-xl border-2 border-dashed ${photoUrl ? 'border-green-500 bg-green-50' : 'border-blue-300 bg-blue-50'} transition-all`}>
        <div className="text-center mb-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Camera size={24} />
            </div>
            <h3 className="font-bold text-slate-900">{t('proof_delivery') || "Bukti Penghantaran"}</h3>
            <p className="text-xs text-slate-500">{t('upload_photo_desc') || "Ambil gambar stok atau premis pelanggan"}</p>
        </div>
        
        <input
          type="file"
          id="proof-upload"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => {
                setPhotoUrl(reader.result as string);
              };
              reader.readAsDataURL(file);
            }
          }}
          className="hidden"
        />
        
        {!photoUrl ? (
            <label htmlFor="proof-upload" className="block w-full py-3 bg-white border border-blue-200 text-blue-700 font-bold rounded-lg text-center cursor-pointer hover:bg-blue-50 transition-colors shadow-sm">
                <Upload className="inline-block mr-2 w-4 h-4" />
                {t('take_photo') || "Ambil Gambar"}
            </label>
        ) : (
            <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                    <Image src={photoUrl} alt="Proof" width={400} height={300} className="w-full h-48 object-cover" />
                </div>
                <label htmlFor="proof-upload" className="block w-full py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg text-center cursor-pointer hover:bg-slate-50 text-sm">
                    {t('retake_photo') || "Ambil Semula"}
                </label>
            </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
        <Button 
            onClick={handleSubmit} 
            disabled={!photoUrl || !selectedCustomer || cart.length === 0 || isSubmitting} 
            className="w-full py-4 text-lg shadow-lg bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? (
             <div className="flex items-center justify-center">
               <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
               Processing...
             </div>
          ) : (
             <div className="flex items-center justify-center">
               <Save className="mr-2" /> {t('confirm_submit')}
             </div>
          )}
        </Button>
      </div>
    </div>
  );
}
