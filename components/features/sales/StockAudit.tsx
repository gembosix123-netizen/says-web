import React, { useState } from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock } from '@/components/Icons';

export default function StockAudit() {
  const { products, saveStockAudit, setStep, userRole } = useSales();
  const { t } = useLanguage();
  const [auditData, setAuditData] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(false);

  const isAdmin = userRole === 'Admin';

  const handleStockChange = (productId: string, value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setAuditData(prev => ({ ...prev, [productId]: numValue }));
    } else {
        const newState = { ...auditData };
        delete newState[productId];
        setAuditData(newState);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    const items = Object.entries(auditData).map(([productId, physicalStock]) => {
      const product = products.find(p => p.id === productId);
      return {
        productId,
        productName: product?.name || 'Unknown',
        physicalStock
      };
    });

    await saveStockAudit(items);
    setLoading(false);
    setStep(4);
  };

  const handleSkip = () => {
      setStep(4);
  }
  
  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{t('stock_audit')}</h2>
            <p className="text-slate-400 text-sm mt-1">{t('stock_audit_desc')}</p>
          </div>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Lock size={20} />
          </div>
      </div>
      
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex justify-between text-sm font-bold text-slate-400 uppercase tracking-wider">
            <span>Product</span>
            <span>Physical Count</span>
        </div>
        <div className="divide-y divide-slate-800 max-h-[60vh] overflow-y-auto">
            {products.map(product => (
            <div key={product.id} className="flex justify-between items-center p-4 hover:bg-slate-800/50 transition-colors">
                <div>
                <p className="font-bold text-white text-lg">{product.name}</p>
                <p className="text-sm text-slate-500 font-mono">{product.unit}</p>
                </div>
                <div className="flex items-center gap-3">
                <Input 
                    type="number" 
                    className="w-24 h-12 text-center text-lg font-bold bg-slate-800 border-slate-700 text-white focus:border-blue-500 rounded-lg" 
                    placeholder="0"
                    onChange={(e) => handleStockChange(product.id, e.target.value)}
                />
                </div>
            </div>
            ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-slate-800 grid grid-cols-2 gap-3 z-50">
         <Button variant="ghost" className="bg-slate-800 text-white hover:bg-slate-700 border border-slate-700" onClick={handleSkip}>
            {t('skip')}
         </Button>
         <Button className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-900/20" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : t('submit_audit')}
         </Button>
      </div>
    </div>
  );
}
