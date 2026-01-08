import React, { useState } from 'react';
import { Product } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Edit, Plus, Save, Trash2, Package } from '@/components/Icons';
import { formatCurrency } from '@/lib/utils';

interface Props {
  products: Product[];
  onSave: (product: Partial<Product>, isEdit: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function ProductManagement({ products, onSave, onDelete }: Props) {
  const { t } = useLanguage();
  const [form, setForm] = useState<Partial<Product>>({ name: '', price: 0, unit: 'unit' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...form, id: editingId || undefined }, !!editingId);
    setForm({ name: '', price: 0, unit: 'unit' });
    setEditingId(null);
  };

  const handleEdit = (p: Product) => {
    setForm(p);
    setEditingId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setForm({ name: '', price: 0, unit: 'unit' });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center text-white">
            <div className={`p-2 rounded-lg mr-3 ${editingId ? 'bg-orange-500/20 text-orange-500' : 'bg-green-500/20 text-green-500'}`}>
                {editingId ? <Edit size={20} /> : <Plus size={20} />}
            </div>
            {editingId ? t('edit_product') : t('add_product')}
          </h2>
          {editingId && (
            <button onClick={handleCancel} className="text-sm text-red-400 hover:text-red-300 underline transition-colors">
              {t('cancel')}
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            className="md:col-span-2 bg-slate-950 border-slate-800 text-slate-200 focus:border-red-900/50 focus:ring-red-900/50"
            placeholder={t('product_name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            className="bg-slate-950 border-slate-800 text-slate-200 focus:border-red-900/50 focus:ring-red-900/50"
            placeholder={t('unit_label')}
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            required
          />
          <Input
            type="number"
            className="bg-slate-950 border-slate-800 text-slate-200 focus:border-red-900/50 focus:ring-red-900/50"
            placeholder={t('price_label')}
            value={form.price || ''}
            onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })}
            required
          />
          <Input
            type="number"
            className="md:col-span-4 bg-slate-950 border-slate-800 text-slate-200 focus:border-red-900/50 focus:ring-red-900/50"
            placeholder="Initial Stock / Stok Awal"
            value={form.stock || ''}
            onChange={(e) => setForm({ ...form, stock: parseFloat(e.target.value) })}
            required
          />
          <Button type="submit" className={`md:col-span-4 text-white border-0 shadow-lg transition-all ${editingId ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-900/20' : 'bg-green-600 hover:bg-green-700 shadow-green-900/20'}`}>
            <Save className="mr-2" /> {editingId ? t('update') : t('save')}
          </Button>
        </form>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <span className="bg-slate-800 p-1.5 rounded-lg text-slate-400">
            <Package size={20} />
          </span>
          {t('product_list')} 
          <span className="text-slate-500 text-base font-normal ml-2">({products.length})</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {products.map((p) => (
            <div key={p.id} className="flex justify-between items-center p-4 bg-slate-800/30 hover:bg-slate-800/60 transition-all rounded-xl border border-slate-700/50 group">
              <div className="flex items-center">
                <div className="mr-4 p-3 bg-slate-900 rounded-lg text-slate-500 group-hover:text-slate-300 transition-colors">
                    <Package size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-200 text-lg">{p.name}</h3>
                  <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">{p.unit}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <span className="font-bold text-blue-400 mr-2 bg-blue-900/20 px-3 py-1 rounded-lg border border-blue-900/30">RM {p.price.toFixed(2)}</span>
                <button onClick={() => handleEdit(p)} className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors border border-transparent hover:border-blue-900/50">
                  <Edit size={18} />
                </button>
                <button onClick={() => onDelete(p.id)} className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors border border-transparent hover:border-red-900/50">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
