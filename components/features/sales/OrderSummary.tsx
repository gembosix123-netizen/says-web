import React, { useRef } from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { FileText, Camera, Save } from 'lucide-react';
import SignaturePad from 'react-signature-canvas';
import Image from 'next/image';

export default function OrderSummary() {
  const { 
    selectedCustomer, cart, payment, calculateGrandTotal, 
    signatureUrl, setSignatureUrl, photoUrl, setPhotoUrl, 
    checkInTime, gpsLocation, setVisitedCustomers, setStep
  } = useSales();
  const { t } = useLanguage();
  const sigRef = useRef<SignaturePad | null>(null);
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
      subtotal: calculateGrandTotal(), // Using same as total for now
      payment,
      total: calculateGrandTotal(),
      signatureUrl,
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

      <div className={`p-3 rounded-xl border-2 ${signatureUrl ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50'}`}>
        {!signatureUrl && <div className="text-slate-700 text-sm mb-2 flex items-center"><FileText className="mr-2" /> {t('signature_title')}</div>}
        <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
          <SignaturePad ref={sigRef} canvasProps={{ width: 350, height: 160, className: 'w-full h-40' }} />
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={() => { sigRef.current?.clear(); setSignatureUrl(null); }}
            className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold"
          >
            {t('clear')}
          </button>
          <button
            onClick={() => { if (sigRef.current && !sigRef.current.isEmpty()) { const url = sigRef.current.getTrimmedCanvas().toDataURL('image/png'); setSignatureUrl(url); } }}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold"
          >
            {t('save')}
          </button>
        </div>
        {signatureUrl && <Image src={signatureUrl} alt="Signature" width={280} height={80} className="mt-2 h-20 object-contain" />}
      </div>

      <div className={`p-3 rounded-xl border-2 ${photoUrl ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50'}`}>
        <div className="text-slate-700 text-sm mb-2 flex items-center"><Camera className="mr-2" /> {t('proof_delivery')}</div>
        <input
          type="file"
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
          className="w-full"
        />
        {photoUrl && <Image src={photoUrl} alt="Proof" width={400} height={300} className="mt-2 rounded-lg max-h-52 object-contain" />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
        <Button 
            onClick={handleSubmit} 
            disabled={!signatureUrl || !selectedCustomer || cart.length === 0 || isSubmitting} 
            className="w-full py-4 text-lg shadow-lg bg-green-600 hover:bg-green-700 disabled:bg-slate-300"
        >
          {isSubmitting ? (
             <>
               <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
               Processing...
             </>
          ) : (
             <>
               <Save className="mr-2" /> {t('confirm_submit')}
             </>
          )}
        </Button>
      </div>
    </div>
  );
}
