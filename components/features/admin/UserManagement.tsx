'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Users, Store } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, type CreateUserInput } from '@/lib/validations';
import { normalizeRole } from '@/lib/roles';
import SalesDailyGateAdminControls from '@/components/features/admin/SalesDailyGateAdminControls';

interface UserType {
  id: string;
  username: string;
  name: string;
  role: string;
  assignedShopId?: string;
  branch: string;
}

interface Customer {
  id: string;
  name: string;
}

interface UserManagementProps {
  enableCreation?: boolean;
}

export default function UserManagement({ enableCreation = true }: UserManagementProps) {
  const [users, setUsers] = useState<UserType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorRole, setActorRole] = useState<string>('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteReferenceNo, setDeleteReferenceNo] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: 'Sales',
      branch: 'Kota Kinabalu'
    }
  });

  const watchRole = watch('role');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { credentials: 'same-origin' });
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
      try {
          const res = await fetch('/api/customers');
          const data = await res.json().catch(() => []);
          setCustomers(Array.isArray(data) ? data : []);
      } catch (error) {
          console.error('Failed to fetch customers', error);
          setCustomers([]);
      }
  };

  useEffect(() => {
    fetchUsers();
    fetchCustomers();
    void fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setActorRole(String(d?.role || '')))
      .catch(() => setActorRole(''));
  }, []);

  const onSubmit = async (data: CreateUserInput) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        alert('User created successfully');
        reset();
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || err.details?.join(', ') || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user');
    }
  };

  const isMainAdmin = normalizeRole(actorRole) === 'Main Admin';

  const handleDelete = async (id: string) => {
      if (!confirm('Are you sure you want to delete this user?')) return;
      if (!deleteReason.trim()) {
        alert('Reason is required to delete user');
        return;
      }
      
      try {
        const params = new URLSearchParams({ id, reason: deleteReason.trim() });
        if (deleteReferenceNo.trim()) {
        params.set('referenceNo', deleteReferenceNo.trim());
        }
        const res = await fetch(`/api/users?${params.toString()}`, { method: 'DELETE' });
          if (res.ok) {
              fetchUsers();
          } else {
              alert('Failed to delete user');
          }
      } catch (error) {
          console.error('Error deleting user:', error);
      }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {enableCreation && (
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <span className="bg-blue-500/20 text-blue-500 p-2 rounded-lg">
            <Plus size={20} />
          </span>
          Add New User
        </h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              placeholder="Username (e.g., sales_ali)"
              {...register('username')}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {errors.username && (
              <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>
            )}
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              {...register('password')}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {errors.password && (
              <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>
          <div>
            <input
              placeholder="Full Name"
              {...register('name')}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>
          
          <div>
            <select
              {...register('branch')}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Branch (Required)</option>
              <option value="Kota Kinabalu">Kota Kinabalu</option>
              <option value="Kinabatangan">Kinabatangan</option>
              <option value="HQ">HQ</option>
            </select>
            {errors.branch && (
              <p className="text-red-400 text-xs mt-1">{errors.branch.message}</p>
            )}
          </div>

          <div>
            <select
              {...register('role')}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Sales">Sales</option>
              <option value="Admin">Admin</option>
              <option value="Main Admin">Main Admin</option>
            </select>
            {errors.role && (
              <p className="text-red-400 text-xs mt-1">{errors.role.message}</p>
            )}
          </div>

          {watchRole === 'Sales' && (
            <div>
              <input
                type="number"
                step="0.01"
                placeholder="Commission Rate (e.g., 0.04 for 4%)"
                {...register('commissionRate', { valueAsNumber: true })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.commissionRate && (
                <p className="text-red-400 text-xs mt-1">{errors.commissionRate.message}</p>
              )}
            </div>
          )}

          <button type="submit" className="md:col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all">
            <Save size={18} /> Create User
          </button>
        </form>
      </div>
      )}

      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <span className="bg-slate-800 p-1.5 rounded-lg text-slate-400">
            <Users size={20} />
          </span>
          System Users
          <span className="text-slate-500 text-base font-normal ml-2">({users.length})</span>
        </h2>

        {loading ? (
             <div className="text-center text-slate-500 py-8">Loading users...</div>
        ) : (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Delete Reason (Required)</label>
                <input
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  placeholder="Example: Duplicate/invalid account"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Reference No (Optional)</label>
                <input
                  value={deleteReferenceNo}
                  onChange={(event) => setDeleteReferenceNo(event.target.value)}
                  placeholder="Example: HR-2026-004"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
        )}

        {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => (
                <div key={user.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/60 transition-all group">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${user.role === 'Admin' ? 'bg-red-600' : 'bg-blue-600'}`}>
                        {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-bold text-white">{user.name}</h3>
                        <p className="text-xs text-slate-400">@{user.username}</p>
                    </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'Admin' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
                    {user.role}
                    </div>
                </div>
                
                {user.assignedShopId && (
                    <div className="mb-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-900/50 p-2 rounded-lg">
                        <Store size={14} />
                        Assigned: {customers.find(c => c.id === user.assignedShopId)?.name || 'Unknown Shop'}
                    </div>
                )}

                <SalesDailyGateAdminControls
                  user={{ id: user.id, name: user.name, role: user.role }}
                  isMainAdmin={isMainAdmin}
                  onUpdated={fetchUsers}
                />

                <div className="flex justify-end pt-2 border-t border-slate-700/50">
                    <button 
                        onClick={() => handleDelete(user.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                        title="Delete User"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
}
