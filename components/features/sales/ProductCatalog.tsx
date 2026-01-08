import React, { useState } from 'react';
import { Product, CartItem } from '@/types';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { Search, Plus, Minus, ChevronLeft, ArrowRight } from '@/components/Icons';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export default function ProductCatalog() {
  const { products, cart, updateCart, setStep, activeOrderId, orders, selectedCustomer, calculateSubtotal, latestAudit } = useSales();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const isOrderMode = !!activeOrderId;
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
      <div className="space-y-4 h-full flex flex-col">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-300">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-bold text-slate-900 text-lg">{selectedCustomer?.name}</h2>
              <p className="text-sm text-slate-500">{t('add_sales_items')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">{t('current_total')}</p>
              <p className="font-bold text-blue-700 text-xl">{formatCurrency(calculateSubtotal())}</p>
            </div>
          </div>
          {!isOrderMode && (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder={t('search_product')}
                className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-base text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-900"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto pb-24 space-y-3">
          {isOrderMode
            ? (orders.find(o => o.id === activeOrderId)?.items ?? []).map((item) => {
                const qty = cart.find((i) => i.id === item.productId)?.quantity || 0;
                const maxQty = item.quantity;
                const canDecrement = qty > 0;
                const canIncrement = qty < maxQty;
                return (
                  <div key={item.productId} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900">{item.productName}</h3>
                      <p className="text-slate-500 text-sm">
                        {formatCurrency(item.price)} / {item.unit}
                      </p>
                      <p className="text-sm text-slate-600 font-semibold">Pesanan: {maxQty}</p>
                    </div>
                    <div className="flex items-center space-x-3 bg-slate-50 rounded-lg p-1">
                      <button
                        onClick={() => updateCart({ id: item.productId, name: item.productName, unit: item.unit, price: item.price } as any, -1)}
                        className={`p-3 rounded-lg ${canDecrement ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-400'}`}
                        disabled={!canDecrement}
                      >
                        <Minus size={20} />
                      </button>
                      <span className="w-12 text-center font-bold text-lg">{qty}</span>
                      <button
                        onClick={() => updateCart({ id: item.productId, name: item.productName, unit: item.unit, price: item.price } as any, 1)}
                        className={`p-3 rounded-lg ${canIncrement ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}
                        disabled={!canIncrement}
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                );
              })
            : filteredProducts.map((product) => {
                  const qty = cart.find((i) => i.id === product.id)?.quantity || 0;
                  const canDecrement = qty > 0;
                  const auditItem = latestAudit?.items.find(i => i.productId === product.id);
                  const showRestockSuggestion = auditItem && auditItem.physicalStock < 10;

                  return (
                    <div key={product.id} className={`bg-white p-4 rounded-xl shadow-sm border ${showRestockSuggestion ? 'border-orange-300 bg-orange-50' : 'border-slate-200'} flex justify-between items-center`}>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900">{product.name}</h3>
                        <p className="text-slate-500 text-sm">
                          {formatCurrency(product.price)} / {product.unit}
                        </p>
                        {showRestockSuggestion && (
                            <p className="text-xs text-orange-600 font-bold mt-1">
                                {t('suggestion_restock')} (+20)
                            </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 bg-slate-50 rounded-lg p-1">
                        <button
                          onClick={() => updateCart(product, -1)}
                          className={`p-3 rounded-lg ${canDecrement ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-400'}`}
                          disabled={!canDecrement}
                        >
                          <Minus size={20} />
                        </button>
                        <span className="w-10 text-center font-bold text-lg">{qty}</span>
                        <button
                          onClick={() => updateCart(product, 1)}
                          className="p-3 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>
                  );
                })}
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 grid grid-cols-4 gap-3">
          <Button variant="ghost" onClick={() => setStep(4)} className="col-span-1 bg-slate-100">
            <ChevronLeft />
          </Button>
          <Button
            onClick={() => setStep(6)}
            disabled={cart.length === 0}
            variant="secondary"
            className="col-span-3 py-4 text-lg shadow-lg"
          >
            {t('next_payment')} <ArrowRight className="ml-2" />
          </Button>
        </div>
      </div>
  );
}
