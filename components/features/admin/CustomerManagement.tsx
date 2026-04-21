'use client';
import React, { useState, useEffect } from 'react';
import { Store, Plus, Save, Trash2, Search, Edit, MapPin, UserCheck, UserX, ArrowRightLeft } from 'lucide-react';
import { useToast } from '../../ui/Toast';
import { useLanguage } from '@/context/LanguageContext';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  area?: string;
  branch?: string;
  town?: string;
  location?: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
}

interface Salesman {
  id: string;
  name: string;
  role: string;
}

interface OwnershipModalState {
  customer: Customer;
  action: 'assign' | 'handover' | 'release';
}

const ALL_BRANCH_OPTIONS = ['Kota Kinabalu', 'Kinabatangan', 'HQ'];

export default function CustomerManagement() {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [filter, setFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'owned' | 'unowned'>('all');
  const [isEditing, setIsEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [ownershipModal, setOwnershipModal] = useState<OwnershipModalState | null>(null);
  const [ownershipForm, setOwnershipForm] = useState({ to_salesman_id: '', to_salesman_name: '', reason: '' });
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [userBranch, setUserBranch] = useState('');
  const [userRole, setUserRole] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', address: '', area: '', branch: '' });
  const { addToast } = useToast();
  const { t } = useLanguage();

  const branchOptions = userRole === 'Main Admin' ? ALL_BRANCH_OPTIONS : userBranch ? [userBranch] : ALL_BRANCH_OPTIONS;

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setCustomers([]);
        addToast(typeof data?.error === 'string' ? data.error : 'Gagal muatkan senarai kedai', 'error');
        return;
      }
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      setCustomers([]);
      addToast('Gagal muatkan senarai kedai', 'error');
    }
  };

  const fetchSalesmen = async () => {
    try {
      const res = await fetch('/api/users?role=Sales');
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      setSalesmen(Array.isArray(data) ? data : []);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const payload = await res.json().catch(() => null);
        if (mounted && res.ok && payload) {
          const branch = payload.branch || '';
          const role = payload.role || '';
          setUserBranch(branch);
          setUserRole(role);
          setForm(prev => ({ ...prev, branch: role === 'Main Admin' ? (prev.branch || branch || ALL_BRANCH_OPTIONS[0]) : branch }));
          return;
        }
      } catch { /* ignore */ }
      try {
        const stored = localStorage.getItem('user');
        if (stored && mounted) {
          const u = JSON.parse(stored);
          const branch = u.branch || '';
          const role = u.role || '';
          setUserBranch(branch);
          setUserRole(role);
          setForm(prev => ({ ...prev, branch: role === 'Main Admin' ? (prev.branch || branch || ALL_BRANCH_OPTIONS[0]) : branch }));
        }
      } catch { /* ignore */ }
    };
    loadUser();
    fetchCustomers();
    fetchSalesmen();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = isEditing ? 'PUT' : 'POST';
    const body = isEditing ? { ...form, id: isEditing.id } : { ...form, id: `c${Date.now()}` };
    try {
      const res = await fetch('/api/customers', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        addToast(isEditing ? 'Kedai dikemaskini' : 'Kedai berjaya ditambah', 'success');
        setIsEditing(null);
        setForm({ name: '', phone: '', address: '', area: '', branch: userRole === 'Main Admin' ? ALL_BRANCH_OPTIONS[0] : userBranch });
        fetchCustomers();
      } else if (res.status === 409 && data?.duplicate) {
        const ownerMsg = data.owner ? ` (Pemilik: ${data.owner})` : ' (tiada pemilik)';
        addToast(`Pelanggan sudah wujud: ${data.existingName}${ownerMsg}`, 'error');
      } else {
        const details = Array.isArray(data?.details) ? data.details.join(', ') : data?.details;
        addToast(details || data?.error || 'Gagal simpan kedai', 'error');
      }
    } catch { addToast('Ralat simpan kedai', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/customers?id=${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) { addToast(data?.details || data?.error || 'Gagal padam kedai', 'error'); return; }
      addToast('Kedai dipadam', 'success');
      setDeleteTarget(null);
      fetchCustomers();
    } catch { addToast('Ralat padam kedai', 'error'); }
  };

  const handleEdit = (customer: Customer) => {
    setIsEditing(customer);
    setForm({ name: customer.name, phone: customer.phone, address: customer.address || '', area: customer.area || '', branch: customer.branch || customer.town || userBranch || ALL_BRANCH_OPTIONS[0] });
  };

  const openOwnershipModal = (customer: Customer, action: 'assign' | 'handover' | 'release') => {
    setOwnershipModal({ customer, action });
    setOwnershipForm({ to_salesman_id: '', to_salesman_name: '', reason: '' });
  };

  const handleOwnershipSubmit = async () => {
    if (!ownershipModal) return;
    const { customer, action } = ownershipModal;
    if (action !== 'release' && !ownershipForm.to_salesman_id) { addToast('Sila pilih salesman', 'error'); return; }
    setOwnershipLoading(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: customer.id, action,
          to_salesman_id: ownershipForm.to_salesman_id || undefined,
          to_salesman_name: ownershipForm.to_salesman_name || undefined,
          reason: ownershipForm.reason || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const msgs: Record<string, string> = { assign: 'Pelanggan berjaya ditetapkan', handover: 'Handover berjaya', release: 'Pelanggan dibebaskan ke company pool' };
        addToast(msgs[action] || 'Berjaya', 'success');
        setOwnershipModal(null);
        fetchCustomers();
      } else { addToast(data?.error || 'Gagal kemaskini pemilikan', 'error'); }
    } catch { addToast('Ralat kemaskini pemilikan', 'error'); }
    finally { setOwnershipLoading(false); }
  };

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const filteredCustomers = safeCustomers.filter(c => {
    if (!c.name.toLowerCase().includes(filter.toLowerCase())) return false;
    if (ownerFilter === 'owned') return !!c.assigned_to;
    if (ownerFilter === 'unowned') return !c.assigned_to;
    return true;
  });

  const actionLabel: Record<string, string> = { assign: 'Tetapkan Kepada', handover: 'Handover Kepada', release: 'Bebaskan ke Company Pool' };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Form Section */}
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <span className="bg-green-500/20 text-green-500 p-2 rounded-lg">
            {isEditing ? <Edit size={20} /> : <Plus size={20} />}
          </span>
          {isEditing ? t('edit_shop') : t('add_new_shop')}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input placeholder={t('shop_name')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg" required />
          <input placeholder={t('phone_number')} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg" required />
          <input placeholder={t('address')} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg" />
          <input placeholder="Area / Kawasan (cth: Inanam, Penampang)" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg" required />
          <select value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg" required disabled={userRole !== 'Main Admin' && !!userBranch}>
            {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
              <Save size={18} /> {isEditing ? t('update') : t('save')}
            </button>
            {isEditing && (
              <button type="button" onClick={() => { setIsEditing(null); setForm({ name: '', phone: '', address: '', area: '', branch: userRole === 'Main Admin' ? ALL_BRANCH_OPTIONS[0] : userBranch }); }} className="px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">{t('cancel')}</button>
            )}
          </div>
        </form>
      </div>

      {/* List Section */}
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Store className="text-green-500" /> {t('shop_list')}
            <span className="text-sm font-normal text-slate-400 ml-2">({filteredCustomers.length})</span>
          </h2>
          <div className="flex gap-2 flex-wrap">
            {/* Owner filter tabs */}
            <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
              {(['all', 'owned', 'unowned'] as const).map(f => (
                <button key={f} onClick={() => setOwnerFilter(f)} className={`px-3 py-2 font-medium transition-colors ${ownerFilter === f ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  {f === 'all' ? 'Semua' : f === 'owned' ? 'Ada Pemilik' : 'Company Pool'}
                </button>
              ))}
            </div>
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder={t('search_shops')} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-white text-sm" />
            </div>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/60 transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{customer.name}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><MapPin size={12} /> {customer.area ? `${customer.area} — ` : ''}{customer.address || t('no_address')}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('user_branch')}: {customer.branch || customer.town || 'N/A'}</p>
                    <p className="text-xs text-slate-500 mt-1">Tel: {customer.phone}</p>
                    {/* Ownership badge */}
                    {customer.assigned_to ? (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs bg-blue-900/40 text-blue-300 border border-blue-800/50 rounded-full px-2 py-0.5">
                        <UserCheck size={11} /> {customer.assigned_to_name || customer.assigned_to}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs bg-slate-700/50 text-slate-400 border border-slate-600/50 rounded-full px-2 py-0.5">
                        <Store size={11} /> Company Pool
                      </span>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div className="flex flex-col gap-1 ml-2 shrink-0">
                    <button onClick={() => handleEdit(customer)} className="p-1.5 text-blue-400 hover:bg-blue-900/20 rounded-lg" title="Edit"><Edit size={14} /></button>
                    {customer.assigned_to ? (
                      <>
                        <button onClick={() => openOwnershipModal(customer, 'handover')} className="p-1.5 text-amber-400 hover:bg-amber-900/20 rounded-lg" title="Handover"><ArrowRightLeft size={14} /></button>
                        <button onClick={() => openOwnershipModal(customer, 'release')} className="p-1.5 text-slate-400 hover:bg-slate-700/30 rounded-lg" title="Release"><UserX size={14} /></button>
                      </>
                    ) : (
                      <button onClick={() => openOwnershipModal(customer, 'assign')} className="p-1.5 text-green-400 hover:bg-green-900/20 rounded-lg" title="Assign"><UserCheck size={14} /></button>
                    )}
                    <button onClick={() => setDeleteTarget(customer)} className="p-1.5 text-red-400 hover:bg-red-900/20 rounded-lg" title="Padam"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
            {filteredCustomers.length === 0 && <div className="col-span-3 text-center py-12 text-slate-500">Tiada kedai dijumpai</div>}
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white">{t('delete_shop')}</h3>
            <p className="text-sm text-slate-300 mt-2">
              {t('delete_shop_confirm')} <span className="font-semibold text-white">{deleteTarget.name}</span>?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700">{t('cancel')}</button>
              <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">{t('clear')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ownership Modal (Assign / Handover / Release) */}
      {ownershipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">{actionLabel[ownershipModal.action]}</h3>
            <p className="text-sm text-slate-400 mb-4">Kedai: <span className="text-white font-semibold">{ownershipModal.customer.name}</span></p>

            {ownershipModal.customer.assigned_to && (
              <div className="mb-3 text-xs text-blue-300 bg-blue-900/20 border border-blue-800/40 rounded-lg px-3 py-2">
                Pemilik semasa: <span className="font-semibold">{ownershipModal.customer.assigned_to_name || ownershipModal.customer.assigned_to}</span>
              </div>
            )}

            {ownershipModal.action !== 'release' && (
              <div className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">Salesman baru</label>
                <select value={ownershipForm.to_salesman_id} onChange={e => {
                  const s = salesmen.find(sm => sm.id === e.target.value);
                  setOwnershipForm({ ...ownershipForm, to_salesman_id: e.target.value, to_salesman_name: s?.name || '' });
                }} className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm">
                  <option value="">-- Pilih salesman --</option>
                  {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">Sebab {ownershipModal.action !== 'assign' ? '(untuk audit)' : '(pilihan)'}</label>
              <input placeholder="Cth: salesman berhenti, tukar kawasan..." value={ownershipForm.reason} onChange={e => setOwnershipForm({ ...ownershipForm, reason: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm" />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOwnershipModal(null)} disabled={ownershipLoading} className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700">Batal</button>
              <button type="button" onClick={handleOwnershipSubmit} disabled={ownershipLoading} className={`px-4 py-2 text-white rounded-lg font-semibold disabled:opacity-50 ${ownershipModal.action === 'release' ? 'bg-slate-600 hover:bg-slate-500' : ownershipModal.action === 'handover' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-green-600 hover:bg-green-500'}`}>
                {ownershipLoading ? 'Memproses...' : actionLabel[ownershipModal.action]}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
