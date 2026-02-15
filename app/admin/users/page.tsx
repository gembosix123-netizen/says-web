 'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Plus, Trash2, Key, AlertCircle } from 'lucide-react';

type User = { id: string; username: string; role: string; name: string; branch?: string; created_at?: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserBranch, setCurrentUserBranch] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    username: '', 
    password: '', 
    role: 'Sales', 
    name: '', 
    branch: 'Kota Kinabalu' 
  });
  const { addToast } = useToast();

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
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
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
    ? `Viewing users from: ${currentUserBranch}` 
    : 'You have limited access to user management';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        {canCreateUsers && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus size={20} /> Add User
          </button>
        )}
      </div>

      {/* Access Info */}
      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 flex items-start gap-3">
        <AlertCircle size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="text-blue-400 font-medium">{accessInfo}</p>
          {currentUserRole === 'Admin' && (
            <p className="text-slate-400 text-xs mt-1">Admin accounts can only manage users in their assigned branch</p>
          )}
        </div>
      </div>

      {/* Create User Form */}
      {showForm && canCreateUsers && (
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Register New User</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Full Name *</label>
              <input 
                placeholder="e.g., Ali bin Muhammad" 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})} 
                className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Username *</label>
              <input 
                placeholder="e.g., ali_kk" 
                value={form.username} 
                onChange={(e) => setForm({...form, username: e.target.value})} 
                className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password *</label>
              <input 
                type="password"
                placeholder="Min. 6 characters" 
                value={form.password} 
                onChange={(e) => setForm({...form, password: e.target.value})} 
                className="w-full p-2 bg-slate-800 text-white rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Role *</label>
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
              <label className="block text-sm font-medium text-slate-300 mb-2">Branch/Area *</label>
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
                Create User
              </button>
              <button 
                onClick={() => setShowForm(false)} 
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden">
        <h3 className="text-lg font-semibold text-white mb-4">Staff Directory</h3>
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No users found in your branch</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Username</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Role</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Branch</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Joined</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Actions</th>
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
    </div>
  );
}
