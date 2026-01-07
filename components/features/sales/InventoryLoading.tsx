import React, { useState, useEffect } from 'react';
import { Product } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Truck, Save, Plus, Trash2, Package } from 'lucide-react';

interface Props {
  products: Product[];
  userId: string;
  onSuccess: () => void;
}

export default function InventoryLoading({ products, userId, onSuccess }: Props) {
  const { t } = useLanguage();
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) return;
    
    // Check master stock
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;
    
    if (quantity > product.stock) {
        alert(`Insufficient master stock for ${product.name}. Available: ${product.stock}`);
        return;
    }

    // Check if already in list
    const existing = items.find(i => i.productId === selectedProduct);
    if (existing) {
        // Update quantity
        if (existing.quantity + quantity > product.stock) {
            alert(`Insufficient master stock for ${product.name}. Available: ${product.stock}`);
            return;
        }
        setItems(items.map(i => i.productId === selectedProduct ? { ...i, quantity: i.quantity + quantity } : i));
    } else {
        setItems([...items, { productId: selectedProduct, quantity }]);
    }
    
    setSelectedProduct('');
    setQuantity(0);
  };

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    if (!confirm(t('confirm_loading') || 'Confirm loading these items?')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/inventory/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, items }),
      });

      if (res.ok) {
        alert(t('loading_success') || 'Inventory loaded successfully!');
        setItems([]);
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to load inventory');
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to server');
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
      <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
        <span className="bg-slate-800 p-1.5 rounded-lg text-slate-400">
            <Truck size={20} />
        </span>
        {t('inventory_loading') || 'Daily Loading'}
      </h2>

      {/* Add Item Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <select
            className="md:col-span-2 w-full p-3 border border-slate-800 rounded-lg text-slate-200 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-red-900/50"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
        >
            <option value="">{t('select_product') || 'Select Product'}</option>
            {products.map(p => (
                <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                    {p.name} (Stock: {p.stock})
                </option>
            ))}
        </select>
        <div className="flex gap-2">
            <Input 
                type="number" 
                placeholder="Qty" 
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                className="bg-slate-950 border-slate-800 text-slate-200 focus:border-red-900/50 focus:ring-red-900/50"
            />
            <Button onClick={handleAddItem} className="bg-green-600 hover:bg-green-700 text-white border-0">
                <Plus size={20} />
            </Button>
        </div>
      </div>

      {/* Staged Items List */}
      {items.length > 0 && (
          <div className="space-y-2 mb-6">
              {items.map((item, idx) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                          <span className="text-slate-200">{product?.name}</span>
                          <div className="flex items-center gap-4">
                              <span className="font-bold text-white">x{item.quantity}</span>
                              <button onClick={() => handleRemoveItem(item.productId)} className="text-red-400 hover:text-red-300">
                                  <Trash2 size={18} />
                              </button>
                          </div>
                      </div>
                  );
              })}
          </div>
      )}

      {items.length > 0 && (
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg shadow-blue-900/20"
          >
              <Save className="mr-2" size={18} />
              {loading ? 'Processing...' : (t('submit_loading') || 'Submit Loading')}
          </Button>
      )}
    </div>
  );
}
