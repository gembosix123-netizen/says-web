import React, { useState } from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock } from 'lucide-react';

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
        // Remove if empty or invalid
        const newState = { ...auditData };
        delete newState[productId];
        setAuditData(newState);
    }
  };

  const handleSubmit = async () => {
    // If not admin, just proceed? Or maybe allow sales to audit too?
    // Requirement said: "Audit Freezer: Input untuk rekod baki stok produk kita yang masih ada di dalam freezer kedai."
    // This implies Sales staff SHOULD do this. Removing Admin restriction for now based on Fasa 3 requirements.
    
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
    setStep(4); // Move to ProductExchange
  };

  const handleSkip = () => {
      setStep(4);
  }

  // Removed Admin check to allow Sales staff to audit
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{t('stock_audit')}</h2>
      <p className="text-gray-500 text-sm">{t('stock_audit_desc')}</p>
      
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        {products.map(product => (
          <div key={product.id} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0">
            <div>
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-gray-500">{product.unit}</p>
            </div>
            <div className="flex items-center gap-2">
               <label className="text-xs text-gray-400">Qty:</label>
               <Input 
                 type="number" 
                 className="w-20 p-2 text-right" 
                 placeholder="0"
                 onChange={(e) => handleStockChange(product.id, e.target.value)}
               />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
         <Button variant="outline" className="flex-1" onClick={handleSkip}>
            {t('skip')}
         </Button>
         <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : t('submit_audit')}
         </Button>
      </div>
    </div>
  );
}
