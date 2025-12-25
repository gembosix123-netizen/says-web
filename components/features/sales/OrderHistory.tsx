import React from 'react';
import { useSales } from '@/context/SalesContext';
import { formatCurrency } from '@/lib/utils';
import { OrderStatus } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { Skeleton } from '@/components/ui/Skeleton';

const statusColors: Record<OrderStatus, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  Processing: 'bg-purple-100 text-purple-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

export default function OrderHistory() {
  const { transactions, loading } = useSales();
  const { t } = useLanguage();

  if (loading) {
      return (
          <div className="space-y-4 pb-20">
              <h2 className="text-xl font-bold text-slate-900">{t('order_history')}</h2>
              <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                          <div className="flex justify-between">
                              <Skeleton className="h-5 w-32" />
                              <Skeleton className="h-5 w-16 rounded-full" />
                          </div>
                          <div className="flex justify-between items-end">
                              <Skeleton className="h-4 w-20" />
                              <Skeleton className="h-6 w-24" />
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-4 pb-20">
      <h2 className="text-xl font-bold text-slate-900">{t('order_history')}</h2>
      {transactions.length === 0 ? (
        <div className="text-center text-slate-500 py-8 bg-white rounded-xl border border-slate-200">
            {t('no_orders')}
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((trans) => (
            <div key={trans.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-slate-900">{trans.customer?.name}</h3>
                  <p className="text-xs text-slate-500">
                    {new Date(trans.createdAt || trans.checkInTime || Date.now()).toLocaleString()}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[trans.status || 'Pending']}`}>
                  {trans.status || 'Pending'}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-sm text-slate-600">
                  {trans.items?.length || 0} {t('items_count')}
                </div>
                <div className="font-bold text-slate-900 text-lg">
                  {formatCurrency(trans.total)}
                </div>
              </div>
              {trans.assignedShopId && (
                  <div className="mt-2 text-xs text-slate-500 border-t pt-2">
                      {t('assigned_to')} {trans.assignedShopId} {/*Ideally lookup name, but keeping simple*/}
                  </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
