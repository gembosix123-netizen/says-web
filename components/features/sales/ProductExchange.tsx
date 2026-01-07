import React, { useState } from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RefreshCw, Trash2, Plus } from 'lucide-react';

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
      <h2 className="text-xl font-bold flex items-center gap-2">
          <RefreshCw className="text-orange-500" />
          {t('product_exchange') || 'Product Exchange (Expired)'}
      </h2>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
            <select
                className="w-full p-3 border border-slate-300 rounded-lg bg-white"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
            >
                <option value="">Select Product</option>
                {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
        </div>
        <div className="flex gap-4">
            <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Qty</label>
                <Input 
                    type="number" 
                    value={quantity || ''} 
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                />
            </div>
            <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <select 
                    className="w-full p-3 border border-slate-300 rounded-lg bg-white"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                >
                    <option value="Expired">Expired</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Return">Return</option>
                </select>
            </div>
        </div>
        <Button onClick={handleAddItem} className="w-full bg-orange-500 hover:bg-orange-600 border-0 text-white">
            <Plus size={18} className="mr-2" /> Add Exchange Item
        </Button>
      </div>

      {exchangeItems.length > 0 && (
          <div className="space-y-3">
              <h3 className="font-bold text-slate-700">Exchange List</h3>
              {exchangeItems.map((item, idx) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                      <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                          <div>
                              <p className="font-bold text-slate-800">{product?.name}</p>
                              <p className="text-xs text-slate-500">{item.reason}</p>
                          </div>
                          <div className="flex items-center gap-3">
                              <span className="font-bold text-orange-600">x{item.quantity}</span>
                              <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600">
                                  <Trash2 size={18} />
                              </button>
                          </div>
                      </div>
                  );
              })}
          </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => setStep(3)} className="bg-slate-100">
          {t('back')}
        </Button>
        <Button onClick={() => setStep(5)} variant="secondary" className="shadow-lg">
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
