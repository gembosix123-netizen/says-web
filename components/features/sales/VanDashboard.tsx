import React, { useEffect, useState } from 'react';
import { Product, VanInventory } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { Package, RefreshCw } from '@/components/Icons';

interface Props {
  userId: string;
  products: Product[];
  refreshTrigger?: number; // Prop to trigger refresh
}

export default function VanDashboard({ userId, products, refreshTrigger }: Props) {
  const { t } = useLanguage();
  const [inventory, setInventory] = useState<VanInventory | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/van?userId=${userId}`);
      if (res.ok) {
        setInventory(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchInventory();
  }, [userId, refreshTrigger]);

  if (!inventory || Object.keys(inventory.items).length === 0) {
    return (
        <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800 text-center py-8">
            <Package className="mx-auto text-slate-600 mb-2" size={32} />
            <p className="text-slate-400">{t('no_stock_in_van') || 'No stock in van'}</p>
        </div>
    );
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="bg-slate-800 p-1.5 rounded-lg text-slate-400">
                <Package size={20} />
            </span>
            {t('van_inventory') || 'Van Inventory'}
        </h2>
        <button onClick={fetchInventory} className="text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-3">
        {Object.entries(inventory.items).map(([productId, quantity]) => {
            const product = products.find(p => p.id === productId);
            return (
                <div key={productId} className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                    <div>
                        <p className="font-bold text-slate-200">{product?.name || 'Unknown Product'}</p>
                        <p className="text-xs text-slate-500">{product?.unit}</p>
                    </div>
                    <span className="font-mono font-bold text-blue-400 bg-blue-900/20 px-3 py-1 rounded-lg border border-blue-900/30">
                        {quantity}
                    </span>
                </div>
            );
        })}
      </div>
    </div>
  );
}
