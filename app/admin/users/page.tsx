 'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useLanguage } from '@/context/LanguageContext';
import WorkflowControlPanel from '@/components/features/admin/WorkflowControlPanel';
import { Plus, Trash2, Key, AlertCircle, Users, ShieldCheck, UserPlus } from 'lucide-react';

type User = { id: string; username: string; role: string; name: string; branch?: string; created_at?: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserBranch, setCurrentUserBranch] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteReferenceNo, setDeleteReferenceNo] = useState('');
  const [form, setForm] = useState({ 
    username: '', 
    password: '', 
    role: 'Sales', 
    name: '', 
    branch: 'Kota Kinabalu' 
  });
  const { addToast } = useToast();
  const { t } = useLanguage();

  // Get current user from localStorage
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setCurrentUserBranch(userData.branch || '');
        setCurrentUserRole(userData.role || '');
        // Set default branch to user's branch if Admin
        if (userData.role === 'Admin') {
          setForm(prev => ({ ...prev, branch: userData.branch }));
        }
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(Array.isArray(data) ? data : []);
      } else {
        addToast(data?.error || 'Failed to load users', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('Error loading users', 'error');
    } finally { 
      setLoading(false); 
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const createUser = async () => {
    if (!form.username.trim() || !form.password.trim() || !form.name.trim()) {
      addToast('Please fill all fields', 'error');
      return;
    }

    try {
      const res = await fetch('/api/users', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(form) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      addToast('User created successfully', 'success');
      setForm({ username: '', password: '', role: 'Sales', name: '', branch: form.branch });
      setShowForm(false);
      load();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to create user';
      addToast(errorMessage, 'error'); 
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"?`)) return;
    if (!deleteReason.trim()) {
      addToast('Reason is required to delete user', 'warning');
      return;
    }
    try {
      const params = new URLSearchParams({
        id,
        reason: deleteReason.trim(),
      });
      if (deleteReferenceNo.trim()) {
        params.set('referenceNo', deleteReferenceNo.trim());
      }

      const res = await fetch(`/api/users?${params.toString()}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        addToast(data?.error || 'Failed to delete', 'error');
        return;
      }
      addToast('User deleted', 'success');
      load();
    } catch {
      addToast('Error deleting user', 'error');
    }
  };

  const updatePassword = async (id: string, name: string) => {
    const pw = prompt(`New password for "${name}":`);
    if (!pw) return;
    if (pw.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }
    try {
      const res = await fetch('/api/users', { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id, password: pw }) 
      });
      if (!res.ok) {
        const data = await res.json();
        addToast(data?.error || 'Failed', 'error');
        return;
      }
      addToast('Password updated', 'success');
    } catch {
      addToast('Error updating password', 'error');
    }
  };

  const canCreateUsers = currentUserRole === 'Main Admin' || currentUserRole === 'Admin';
  const accessInfo = currentUserRole === 'Admin' 
    ? `${t('viewing_users_from')} ${currentUserBranch}` 
    : t('access_limited');

  const staffStats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role === 'Admin' || u.role === 'Main Admin').length,
      sales: users.filter((u) => u.role === 'Sales').length,
    };
  }, [users]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">{t('user_management')}</h1>
        {canCreateUsers && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus size={20} /> {t('add_user')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard icon={<Users size={16} />} label="Jumlah Staf" value={String(staffStats.total)} />
        <StatCard icon={<ShieldCheck size={16} />} label="Admin / Main Admin" value={String(staffStats.admins)} />
        <StatCard icon={<UserPlus size={16} />} label="Sales Staff" value={String(staffStats.sales)} />
      </div>

      {/* Access Info */}
      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 flex items-start gap-3">
        <AlertCircle size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="text-blue-400 font-medium">{accessInfo}</p>
          {currentUserRole === 'Admin' && (
            <p className="text-slate-400 text-xs mt-1">{t('branch_admin_note')}</p>
          )}
        </div>
      </div>

      <div className="p-4 rounded-lg bg-slate-900 border border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">{t('delete_reason_required')}</label>
          <input
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Example: Left company"
            className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">{t('ref_no_optional')}</label>
          <input
            value={deleteReferenceNo}
            onChange={(e) => setDeleteReferenceNo(e.target.value)}
            placeholder="Example: HR-EXIT-2026-03"
            className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Create User Form */}
      {showForm && canCreateUsers && (
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">{t('register_user')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('full_name')} *</label>
              <input 
                placeholder="e.g., Ali bin Muhammad" 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})} 
                className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('username')} *</label>
              <input 
                placeholder="e.g., ali_kk" 
                value={form.username} 
                onChange={(e) => setForm({...form, username: e.target.value})} 
                className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('password')} *</label>
              <input 
                type="password"
                placeholder="Min. 6 characters" 
                value={form.password} 
                onChange={(e) => setForm({...form, password: e.target.value})} 
                className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('user_role')} *</label>
              <select 
                value={form.role} 
                onChange={(e) => setForm({...form, role: e.target.value})} 
                className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="Sales">Sales Staff</option>
                <option value="Admin">Branch Admin</option>
                {currentUserRole === 'Main Admin' && <option value="Main Admin">Main Admin</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('user_branch')} *</label>
              <select 
                value={form.branch} 
                onChange={(e) => setForm({...form, branch: e.target.value})} 
                disabled={currentUserRole === 'Admin'}
                className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="Kota Kinabalu">Kota Kinabalu</option>
                <option value="Kinabatangan">Kinabatangan</option>
                {currentUserRole === 'Main Admin' && <option value="HQ">HQ</option>}
              </select>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <button 
                onClick={createUser} 
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
              >
                {t('create_user_btn')}
              </button>
              <button 
                onClick={() => setShowForm(false)} 
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden">
        <h3 className="text-lg font-semibold text-white mb-4">{t('staff_directory')}</h3>
        {loading ? (
          <div className="text-center py-8 text-slate-400">{t('loading_users')}</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-slate-400">{t('no_users_found')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">{t('name_col')}</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">{t('username')}</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">{t('user_role')}</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">{t('user_branch')}</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">{t('joined_col')}</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">{t('actions_col')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-slate-300">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        u.role === 'Main Admin' ? 'bg-red-900 text-red-300' :
                        u.role === 'Admin' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-blue-900 text-blue-300'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{u.branch || '-'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button 
                        onClick={() => updatePassword(u.id, u.name)} 
                        title="Change Password"
                        className="p-1.5 bg-amber-900/50 hover:bg-amber-800 rounded text-amber-300 transition-colors"
                      >
                        <Key size={16} />
                      </button>
                      {canCreateUsers && (
                        <button 
                          onClick={() => deleteUser(u.id, u.name)} 
                          title="Delete User"
                          className="p-1.5 bg-red-900/50 hover:bg-red-800 rounded text-red-300 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {currentUserRole === 'Main Admin' && <WorkflowControlPanel />}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
