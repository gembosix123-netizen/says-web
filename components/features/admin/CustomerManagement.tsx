import React, { useState } from 'react';
import { Customer, User } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Edit, Plus, Save, Trash2, User as UserIcon, MapPin, Map } from '@/components/Icons';
import { formatCurrency } from '@/lib/utils';

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
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center text-white">
            <div className={`p-2 rounded-lg mr-3 ${editingId ? 'bg-orange-500/20 text-orange-500' : 'bg-green-500/20 text-green-500'}`}>
                {editingId ? <Edit size={20} /> : <Plus size={20} />}
            </div>
            {editingId ? t('edit_customer') : t('add_customer')}
          </h2>
          {editingId && (
            <button onClick={handleCancel} className="text-sm text-red-400 hover:text-red-300 underline transition-colors">
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
            className="bg-slate-950 border-slate-800 text-slate-200 focus:border-red-900/50 focus:ring-red-900/50"
          />
          <Input
            placeholder={t('address')}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
            className="bg-slate-950 border-slate-800 text-slate-200 focus:border-red-900/50 focus:ring-red-900/50"
          />
          <div className="flex gap-2">
             <Input
                placeholder={t('lat')}
                type="number"
                step="any"
                value={form.lat || ''}
                onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) })}
                className="bg-slate-950 border-slate-800 text-slate-200 focus:border-red-900/50 focus:ring-red-900/50"
             />
             <Input
                placeholder={t('lon')}
                type="number"
                step="any"
                value={form.lon || ''}
                onChange={(e) => setForm({ ...form, lon: parseFloat(e.target.value) })}
                className="bg-slate-950 border-slate-800 text-slate-200 focus:border-red-900/50 focus:ring-red-900/50"
             />
          </div>
          <div className="flex items-center">
             <Button 
                type="button" 
                variant="outline" 
                onClick={getCurrentLocation}
                disabled={loadingLoc}
                className="w-full h-full border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white"
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
            className="bg-slate-950 border-slate-800 text-slate-200 focus:border-red-900/50 focus:ring-red-900/50"
          />
          <div className="w-full">
            <select
              className="w-full p-3 border border-slate-800 rounded-lg text-slate-200 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-red-900/50"
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
          <Button type="submit" className={`md:col-span-2 text-white border-0 shadow-lg transition-all ${editingId ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-900/20' : 'bg-green-600 hover:bg-green-700 shadow-green-900/20'}`}>
            <Save className="mr-2" size={18} /> {editingId ? t('update') : t('save')}
          </Button>
        </form>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <span className="bg-slate-800 p-1.5 rounded-lg text-slate-400">
            <UserIcon size={20} />
          </span>
          {t('customer_list')} 
          <span className="text-slate-500 text-base font-normal ml-2">({customers.length})</span>
        </h2>
        <div className="space-y-3">
          {customers.map((c) => (
            <div key={c.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-slate-800/30 hover:bg-slate-800/60 transition-all rounded-xl border border-slate-700/50 group">
              <div className="mb-3 md:mb-0">
                <h3 className="font-bold text-slate-200 text-lg">{c.name}</h3>
                <p className="text-sm text-slate-500">{c.address}</p>
                <div className="flex gap-3 mt-2">
                    {c.lat && c.lon && (
                        <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center bg-blue-900/20 px-2 py-1 rounded-md border border-blue-900/30 transition-colors"
                        >
                            <Map size={12} className="mr-1" /> {t('map')}
                        </a>
                    )}
                    {c.sales_id && (
                    <span className="inline-flex items-center text-xs bg-purple-900/20 text-purple-400 px-2 py-1 rounded-md border border-purple-900/30">
                        <UserIcon size={12} className="mr-1" /> {salesUsers.find((u) => u.id === c.sales_id)?.name || c.sales_id}
                    </span>
                    )}
                </div>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-700/50 pt-3 md:pt-0">
                <span className="font-mono font-bold text-red-400 text-lg bg-red-900/10 px-3 py-1 rounded-lg border border-red-900/20">RM {c.outstandingBalance}</span>
                <div className="flex gap-2">
                    <button onClick={() => handleEdit(c)} className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors border border-transparent hover:border-blue-900/50">
                    <Edit size={18} />
                    </button>
                    <button onClick={() => onDelete(c.id)} className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors border border-transparent hover:border-red-900/50">
                    <Trash2 size={18} />
                    </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
