'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Users, Store } from 'lucide-react';

interface UserType {
  id: string;
  username: string;
  name: string;
  role: string;
  assignedShopId?: string;
}

interface Customer {
  id: string;
  name: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'Sales',
    assignedShopId: ''
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
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
          const data = await res.json();
          setCustomers(data);
      } catch (error) {
          console.error('Failed to fetch customers', error);
      }
  };

  useEffect(() => {
    fetchUsers();
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.name) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        alert('User created successfully');
        setForm({ username: '', password: '', name: '', role: 'Sales', assignedShopId: '' });
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user');
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Are you sure you want to delete this user?')) return;
      
      try {
          const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
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
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <span className="bg-blue-500/20 text-blue-500 p-2 rounded-lg">
            <Plus size={20} />
          </span>
          Add New User
        </h2>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            placeholder="Username (e.g., sales_ali)"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
          <input
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
          
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Sales">Sales</option>
            <option value="Admin">Admin</option>
          </select>

          {form.role === 'Sales' && (
              <select
                value={form.assignedShopId}
                onChange={(e) => setForm({ ...form, assignedShopId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
              >
                  <option value="">Select Assigned Shop (Optional)</option>
                  {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
          )}

          <button type="submit" className="md:col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all">
            <Save size={18} /> Create User
          </button>
        </form>
      </div>

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
