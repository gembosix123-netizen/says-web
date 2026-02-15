'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, X } from 'lucide-react';

interface User {
  id: string;
  username: string;
  password: string;
  role: string;
  name: string;
  branch: string;
  commissionRate?: number;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    password: '',
    role: 'Admin',
    branch: 'HQ'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        await fetchUsers();
        setNewUser({ name: '', username: '', password: '', role: 'Admin', branch: 'HQ' });
        setShowAddForm(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData?.error || 'Failed to add user');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Error adding user');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBranch = async (userId: string, newBranch: string) => {
    setLoading(true);

    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, branch: newBranch })
      });

      if (response.ok) {
        await fetchUsers();
        setEditingUser(null);
      } else {
        alert('Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error updating user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Staff Management</h1>
          <p className="text-slate-400">Manage system users and permissions</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          Add User
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Add New User</h2>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="Admin">Admin</option>
                <option value="Sales">Sales</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Branch</label>
              <select
                value={newUser.branch}
                onChange={(e) => setNewUser({ ...newUser, branch: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="HQ">HQ</option>
                <option value="Kota Kinabalu">Kota Kinabalu</option>
                <option value="Kinabatangan">Kinabatangan</option>
              </select>
            </div>

            <div className="md:col-span-2 flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add User'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left p-4 text-slate-300 font-medium">Name</th>
                <th className="text-left p-4 text-slate-300 font-medium">Username</th>
                <th className="text-left p-4 text-slate-300 font-medium">Role</th>
                <th className="text-left p-4 text-slate-300 font-medium">Branch</th>
                <th className="text-left p-4 text-slate-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-800">
                  <td className="p-4 text-white">{user.name}</td>
                  <td className="p-4 text-slate-300">{user.username}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === 'Main Admin' ? 'bg-purple-900 text-purple-300' :
                      user.role === 'Admin' ? 'bg-blue-900 text-blue-300' :
                      'bg-green-900 text-green-300'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300">
                    {editingUser === user.id ? (
                      <select
                        defaultValue={user.branch}
                        onChange={(e) => handleUpdateBranch(user.id, e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-sm"
                      >
                        <option value="HQ">HQ</option>
                        <option value="Kota Kinabalu">Kota Kinabalu</option>
                        <option value="Kinabatangan">Kinabatangan</option>
                      </select>
                    ) : (
                      user.branch
                    )}
                  </td>
                  <td className="p-4">
                    {user.role !== 'Main Admin' && (
                      <button
                        onClick={() => setEditingUser(editingUser === user.id ? null : user.id)}
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                      >
                        <Edit size={16} />
                        Edit Branch
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}