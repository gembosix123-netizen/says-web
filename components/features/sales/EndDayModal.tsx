import React, { useState, useEffect } from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { Lock, CheckCircle, AlertTriangle, Truck } from '@/components/Icons';
import { VanInventory } from '@/types';

export default function EndDayModal({ isOpen, onClose, userId, userName }: { isOpen: boolean; onClose: () => void; userId: string; userName: string }) {
  const { transactions, products } = useSales();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [vanStock, setVanStock] = useState<VanInventory | null>(null);

  // Filter today's transactions for this user
  const today = new Date().toISOString().split('T')[0];
  const userTransactions = transactions.filter(t => 
      t.salesmanId === userId && 
      (t.createdAt?.startsWith(today) || t.updatedAt?.startsWith(today))
  );

  const totalSales = userTransactions.reduce((acc, t) => acc + t.total, 0);
  const totalCash = userTransactions.filter(t => t.payment.method === 'cash').reduce((acc, t) => acc + t.total, 0);
  const totalCredit = userTransactions.filter(t => t.payment.method === 'credit' || t.payment.method === 'transfer').reduce((acc, t) => acc + t.total, 0);

  useEffect(() => {
      if (isOpen && userId) {
          fetch(`/api/inventory/van?userId=${userId}`)
              .then(res => res.json())
              .then(setVanStock)
              .catch(console.error);
      }
  }, [isOpen, userId]);

  const handleSettlement = async () => {
      if (!confirm(t('confirm_end_day') || 'Are you sure you want to end your shift? This will submit your report for verification.')) return;

      setLoading(true);
      try {
          const res = await fetch('/api/settlements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  userId,
                  userName,
                  totalCash,
                  totalCredit,
                  totalSales,
                  vanStock: vanStock ? Object.entries(vanStock.items).map(([id, qty]) => ({ productId: id, quantity: qty })) : []
              })
          });

          if (res.ok) {
              alert(t('settlement_submitted') || 'End Day report submitted successfully!');
              onClose();
              // Optional: Redirect to logout or locked screen
              window.location.href = '/login';
          } else {
              const err = await res.json();
              alert(err.error || 'Failed to submit settlement');
          }
      } catch (e) {
          console.error(e);
          alert('Error connecting to server');
      }
      setLoading(false);
  };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="bg-slate-900 p-6 text-center">
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-red-500/30">
                      <Lock className="text-white" size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-white">{t('end_day_report')}</h2>
                  <p className="text-slate-400 text-sm">{today}</p>
              </div>

              <div className="p-6 space-y-6">
                  <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                          <span className="text-slate-600 font-medium">{t('total_cash')}</span>
                          <span className="text-2xl font-bold text-green-700">{formatCurrency(totalCash)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <span className="text-slate-600 font-medium">{t('total_credit')}</span>
                          <span className="text-xl font-bold text-blue-700">{formatCurrency(totalCredit)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                          <span className="text-slate-900 font-bold">{t('total_sales')}</span>
                          <span className="text-xl font-bold text-slate-900">{formatCurrency(totalSales)}</span>
                      </div>
                  </div>

                  {vanStock && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                              <Truck size={16} /> {t('van_stock_balance')}
                          </h4>
                          <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
                              {Object.entries(vanStock.items).map(([productId, quantity]) => {
                                  const p = products.find(prod => prod.id === productId);
                                  return (
                                      <div key={productId} className="flex justify-between">
                                          <span className="text-slate-600">{p?.name || productId}</span>
                                          <span className="font-mono font-bold">{quantity}</span>
                                      </div>
                                  );
                              })}
                              {Object.keys(vanStock.items).length === 0 && <p className="text-slate-400 italic">Empty van</p>}
                          </div>
                      </div>
                  )}

                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 flex gap-3 items-start">
                      <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
                      <p className="text-xs text-yellow-800">
                          {t('settlement_warning') || 'By ending your day, you confirm that all cash collected matches the total above. This action cannot be undone.'}
                      </p>
                  </div>

                  <div className="flex gap-3">
                      <Button variant="ghost" onClick={onClose} className="flex-1">
                          {t('cancel')}
                      </Button>
                      <Button 
                          onClick={handleSettlement} 
                          disabled={loading}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20"
                      >
                          {loading ? 'Submitting...' : t('confirm_end_day')}
                      </Button>
                  </div>
              </div>
          </div>
      </div>
  );
}
