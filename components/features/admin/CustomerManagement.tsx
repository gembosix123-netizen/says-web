import React, { useState } from 'react';
import { Customer, User } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Edit, Plus, Save, Trash2, User as UserIcon, MapPin, Map } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface Props {
  customers: Customer[];
  salesUsers: User[];
  onSave: (customer: Partial<Customer>, isEdit: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function CustomerManagement({ customers, salesUsers, onSave, onDelete }: Props) {
  const { t } = useLanguage();
  const [form, setForm] = useState<Partial<Customer>>({ name: '', address: '', outstandingBalance: 0, sales_id: '', lat: undefined, lon: undefined });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...form, id: editingId || undefined }, !!editingId);
    setForm({ name: '', address: '', outstandingBalance: 0, sales_id: '', lat: undefined, lon: undefined });
    setEditingId(null);
  };

  const handleEdit = (c: Customer) => {
    setForm(c);
    setEditingId(c.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setForm({ name: '', address: '', outstandingBalance: 0, sales_id: '', lat: undefined, lon: undefined });
    setEditingId(null);
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(t('gps_unavailable'));
      return;
    }
    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({
          ...prev,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        }));
        alert(t('location_found'));
        setLoadingLoc(false);
      },
      (err) => {
        console.error(err);
        alert(t('location_error'));
        setLoadingLoc(false);
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center text-slate-900">
            {editingId ? <Edit className="mr-2" size={20} /> : <Plus className="mr-2" size={20} />}
            {editingId ? t('edit_customer') : t('add_customer')}
          </h2>
          {editingId && (
            <button onClick={handleCancel} className="text-sm text-red-600 underline">
              {t('cancel')}
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            placeholder={t('shop_name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            placeholder={t('address')}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
          />
          <div className="flex gap-2">
             <Input
                placeholder={t('lat')}
                type="number"
                step="any"
                value={form.lat || ''}
                onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) })}
             />
             <Input
                placeholder={t('lon')}
                type="number"
                step="any"
                value={form.lon || ''}
                onChange={(e) => setForm({ ...form, lon: parseFloat(e.target.value) })}
             />
          </div>
          <div className="flex items-center">
             <Button 
                type="button" 
                variant="outline" 
                onClick={getCurrentLocation}
                disabled={loadingLoc}
                className="w-full h-full"
             >
                <MapPin className="mr-2" size={18} />
                {loadingLoc ? t('loading') : t('get_location')}
             </Button>
          </div>

          <Input
            type="number"
            placeholder={t('debt_balance')}
            value={form.outstandingBalance || ''}
            onChange={(e) => setForm({ ...form, outstandingBalance: parseFloat(e.target.value) })}
          />
          <div className="w-full">
            <select
              className="w-full p-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              value={form.sales_id || ''}
              onChange={(e) => setForm({ ...form, sales_id: e.target.value })}
            >
              <option value="">{t('select_sales')}</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className={`md:col-span-2 ${editingId ? 'bg-orange-600' : 'bg-green-600'}`}>
            <Save className="mr-2" /> {editingId ? t('update') : t('save')}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-bold mb-4 text-slate-900">
          {t('customer_list')} ({customers.length})
        </h2>
        <div className="space-y-2">
          {customers.map((c) => (
            <div key={c.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900">{c.name}</h3>
                <p className="text-sm text-slate-600">{c.address}</p>
                {c.lat && c.lon && (
                    <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center mt-1"
                    >
                        <Map size={12} className="mr-1" /> {t('map')} ({c.lat.toFixed(4)}, {c.lon.toFixed(4)})
                    </a>
                )}
                {c.sales_id && (
                  <span className="inline-flex items-center text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full mt-1">
                    <UserIcon size={12} className="mr-1" /> {t('admin_sales_label')} {salesUsers.find((u) => u.id === c.sales_id)?.name || c.sales_id}
                  </span>
                )}
              </div>
              <div className="text-right flex items-center gap-3">
                <span className="font-mono font-bold text-red-600 mr-2">RM {c.outstandingBalance}</span>
                <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full">
                  <Edit size={18} />
                </button>
                <button onClick={() => onDelete(c.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full">
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
