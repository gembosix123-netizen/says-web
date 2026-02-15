import React from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

export default function PaymentForm() {
  const { calculateGrandTotal, payment, setPayment, setStep, selectedCustomer } = useSales();
  const { t } = useLanguage();

  const total = calculateGrandTotal();
  const isCredit = payment.method === 'credit';
  const currentOutstanding = selectedCustomer?.outstandingBalance || 0;
  const newOutstanding = currentOutstanding + total;

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

        {/* Credit/Bill-to-Bill Warning */}
        {isCredit && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-bold text-amber-800">{t('credit_warning_title') || 'Pembayaran Kredit (Hutang)'}</p>
                <p className="text-sm text-amber-700 mt-1">
                  {t('credit_warning_desc') || 'Jumlah ini akan ditambah ke baki hutang pelanggan.'}
                </p>
                <div className="mt-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-amber-700">{t('current_outstanding') || 'Baki Semasa'}:</span>
                    <span className="font-bold text-amber-800">{formatCurrency(currentOutstanding)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700">{t('this_sale') || 'Jualan Ini'}:</span>
                    <span className="font-bold text-amber-800">+ {formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-amber-200">
                    <span className="text-amber-700 font-bold">{t('new_outstanding') || 'Baki Baru'}:</span>
                    <span className="font-bold text-red-600">{formatCurrency(newOutstanding)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
                className="w-24 text-right font-bold text-white bg-slate-700 outline-none border-b border-slate-500 focus:border-blue-400 p-1 rounded"
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
