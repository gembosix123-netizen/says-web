import React, { useState } from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RefreshCw, Trash2, Plus } from '@/components/Icons';

export default function ProductExchange() {
  const { products, exchangeItems, setExchangeItems, setStep } = useSales();
  const { t } = useLanguage();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('Expired');

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) return;
    
    setExchangeItems([...exchangeItems, { 
        productId: selectedProduct, 
        quantity, 
        reason 
    }]);
    
    setSelectedProduct('');
    setQuantity(0);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...exchangeItems];
    newItems.splice(index, 1);
    setExchangeItems(newItems);
  };

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <RefreshCw className="text-orange-500" />
          {t('product_exchange') || 'Product Exchange (Expired)'}
      </h2>

      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-6 rounded-xl shadow-xl space-y-4">
        <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Product</label>
            <select
                className="w-full p-3 border border-slate-700 rounded-lg bg-black text-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
            >
                <option value="" className="text-slate-500">Select Product</option>
                {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
        </div>
        <div className="flex gap-4">
            <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-2">Qty</label>
                <Input 
                    type="number" 
                    value={quantity || ''} 
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                    className="bg-slate-900/50 border-slate-700 text-white placeholder-slate-600 focus:border-blue-500"
                />
            </div>
            <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-2">Reason</label>
                <select 
                    className="w-full p-3 border border-slate-700 rounded-lg bg-slate-900/50 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                >
                    <option value="Expired">Expired</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Return">Return</option>
                </select>
            </div>
        </div>
        <Button onClick={handleAddItem} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-orange-900/20">
            <Plus size={18} className="mr-2" /> Add Exchange Item
        </Button>
      </div>

      {exchangeItems.length > 0 && (
          <div className="space-y-3">
              <h3 className="font-bold text-slate-300">Exchange List</h3>
              {exchangeItems.map((item, idx) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                      <div key={idx} className="flex justify-between items-center bg-slate-900/50 backdrop-blur-sm p-4 rounded-xl border border-slate-800">
                          <div>
                              <p className="font-bold text-white">{product?.name}</p>
                              <p className="text-xs text-slate-400">{item.reason}</p>
                          </div>
                          <div className="flex items-center gap-4">
                              <span className="font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">x{item.quantity}</span>
                              <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-900/20 rounded-lg">
                                  <Trash2 size={18} />
                              </button>
                          </div>
                      </div>
                  );
              })}
          </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-slate-800 grid grid-cols-2 gap-3 z-50">
        <Button variant="ghost" onClick={() => setStep(3)} className="bg-slate-800 text-white hover:bg-slate-700 border border-slate-700">
          {t('back')}
        </Button>
        <Button onClick={() => setStep(5)} variant="secondary" className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-900/20">
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
