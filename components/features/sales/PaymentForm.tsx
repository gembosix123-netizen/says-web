import React from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export default function PaymentForm() {
  const { calculateGrandTotal, payment, setPayment, setStep } = useSales();
  const { t } = useLanguage();

  const total = calculateGrandTotal();

  type PaymentKey = keyof typeof payment;

  return (
    <div className="space-y-6 pb-24">
      <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-lg">
        <p className="text-blue-100 mb-1">{t('amount_to_pay')}</p>
        <h1 className="text-4xl font-bold">{formatCurrency(total)}</h1>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-900 uppercase tracking-wide">{t('payment_method')}</label>
        <div className="grid grid-cols-3 gap-3">
          {(['cash', 'transfer', 'credit'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPayment({ ...payment, method: m })}
              className={`py-3 rounded-xl font-bold capitalize border-2 transition-all ${
                payment.method === m ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {m === 'cash' ? t('method_cash') : m === 'transfer' ? t('method_transfer') : t('method_credit')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide border-b pb-2">{t('others_optional')}</h3>

        {[
          { label: t('return_label'), key: 'returnAmount' },
          { label: t('exchange_label'), key: 'exchangeAmount' },
          { label: t('foc_label'), key: 'focAmount' },
        ].map((field) => (
          <div key={field.key} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
            <span className="font-medium text-slate-700">{field.label}</span>
            <div className="flex items-center">
            <span className="text-slate-600 mr-2">RM</span>
              <input
                type="number"
                className="w-24 text-right font-bold text-slate-800 outline-none border-b border-slate-300 focus:border-blue-500 p-1"
                value={payment[field.key as PaymentKey] || ''}
                placeholder="0.00"
                onChange={(e) => setPayment({ ...payment, [field.key as PaymentKey]: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => setStep(5)} className="bg-slate-100">
          {t('back')}
        </Button>
        <Button onClick={() => setStep(7)} variant="secondary" className="shadow-lg">
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
