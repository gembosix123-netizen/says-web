import React, { useState } from 'react';
import { Product } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Edit, Plus, Save, Trash2, Package } from 'lucide-react';
import { Card } from '@/components/ui/Card';

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
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center text-slate-900">
            {editingId ? <Edit className="mr-2" size={20} /> : <Plus className="mr-2" size={20} />}
            {editingId ? t('edit_product') : t('add_product')}
          </h2>
          {editingId && (
            <button onClick={handleCancel} className="text-sm text-red-600 underline">
              {t('cancel')}
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            className="md:col-span-2"
            placeholder={t('product_name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            placeholder={t('unit_label')}
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            required
          />
          <Input
            type="number"
            placeholder={t('price_label')}
            value={form.price || ''}
            onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })}
            required
          />
          <Button type="submit" className={`md:col-span-3 ${editingId ? 'bg-orange-600' : 'bg-green-600'}`}>
            <Save className="mr-2" /> {editingId ? t('update') : t('save')}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-bold mb-4 text-slate-900">
          {t('product_list')} ({products.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {products.map((p) => (
            <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center">
                <Package className="mr-3 text-slate-500" size={20} />
                <div>
                  <h3 className="font-bold text-slate-900">{p.name}</h3>
                  <p className="text-sm text-slate-600 font-semibold">{p.unit}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <span className="font-bold text-blue-600 mr-2">RM {p.price.toFixed(2)}</span>
                <button onClick={() => handleEdit(p)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full">
                  <Edit size={18} />
                </button>
                <button onClick={() => onDelete(p.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
