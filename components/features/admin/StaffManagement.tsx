'use client';

import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Plus, Search } from 'lucide-react';
import { useToast } from '../../ui/Toast';
import clsx from 'clsx';

interface StaffMember {
  id: string;
  username: string;
  name: string;
  role: string;
  branch: string;
  email?: string;
  salary?: number;
  status: 'active' | 'inactive';
}

interface StaffManagementProps {
  userRole?: string;
}

interface ApiUser {
  id: string;
  username: string;
  name: string;
  role: string;
  branch: string;
  email?: string;
  salary?: number;
  status?: 'active' | 'inactive';
}

const toStaffMember = (u: ApiUser): StaffMember => ({
  id: u.id,
  username: u.username,
  name: u.name,
  role: u.role,
  branch: u.branch,
  email: u.email || '',
  salary: u.salary || undefined,
  status: u.status || 'active',
});

export default function StaffManagement({ userRole = 'Admin' }: StaffManagementProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteReferenceNo, setDeleteReferenceNo] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: '', branch: '', salary: '' });
  const { addToast } = useToast();

  const isSuperAdmin = userRole === 'Main Admin';

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setIsLoading(true);
        // Fetch staff from API
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Failed to fetch staff');
        const users = (await res.json()) as ApiUser[];
        // Map API response to StaffMember[] shape
        const mapped = (users || []).map(toStaffMember);
        setStaff(mapped);
      } catch {
        addToast('Failed to load staff data', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStaff();
  }, [addToast]);

  const filteredStaff = staff.filter(
    (member) =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddStaff = async () => {
    if (!formData.name || !formData.email || !formData.role) {
      addToast('Please fill in all required fields', 'warning');
      return;
    }

    try {
      // Call API to create user
      const payload = {
        username: formData.name.toLowerCase().replace(/\s/g, '_'),
        password: formData.password || 'TempPass123!',
        name: formData.name,
        email: formData.email,
        role: formData.role,
        branch: formData.branch,
      };

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to add staff');

      // Refresh staff list
      const usersRes = await fetch('/api/users');
      const users = (await usersRes.json()) as ApiUser[];
      setStaff(users.map(toStaffMember));

      setFormData({ name: '', email: '', password: '', role: '', branch: '', salary: '' });
      setShowAddForm(false);
      addToast('Staff member added successfully', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add staff member';
      addToast(message, 'error');
    }
  };

  const handleDeleteStaff = (id: string) => {
    if (!isSuperAdmin) {
      addToast('Only Super Admin can delete staff', 'warning');
      return;
    }

    if (!deleteReason.trim()) {
      addToast('Reason is required to delete staff member', 'warning');
      return;
    }

    try {
      // Call API to delete
      const params = new URLSearchParams({
        id,
        reason: deleteReason.trim(),
      });
      if (deleteReferenceNo.trim()) {
        params.set('referenceNo', deleteReferenceNo.trim());
      }

      fetch(`/api/users?${params.toString()}`, { method: 'DELETE' })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json?.error || 'Failed to delete');
          // Refresh list
          const usersRes = await fetch('/api/users');
          const users = (await usersRes.json()) as ApiUser[];
          setStaff(users.map(toStaffMember));
          addToast('Staff member deleted successfully', 'success');
        })
        .catch((err) => {
          addToast(err?.message || 'Failed to delete staff member', 'error');
        });
    } catch {
      addToast('Failed to delete staff member', 'error');
    }
  };

  const handleEditSalary = (id: string, newSalary: number) => {
    if (!isSuperAdmin) {
      addToast('Only Super Admin can edit salary', 'warning');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, salary: newSalary }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to update salary');

        // Refresh users
        const usersRes = await fetch('/api/users');
        const users = (await usersRes.json()) as ApiUser[];
        setStaff(users.map(toStaffMember));

        addToast('Salary updated successfully', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update salary';
        addToast(message, 'error');
      }
    })();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Staff Management</h2>
          <p className="text-slate-400">Manage team members and their roles</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-says-accent hover:bg-red-500 text-white rounded-lg transition-colors duration-200 font-medium"
          >
            <Plus size={20} />
            Add Staff
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && isSuperAdmin && (
        <div className="p-6 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-glass">
          <h3 className="text-lg font-semibold text-white mb-4">Add New Staff Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="px-4 py-2 bg-says-card border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-says-accent focus:outline-none transition-colors"
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="px-4 py-2 bg-says-card border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-says-accent focus:outline-none transition-colors"
            />
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="px-4 py-2 bg-says-card border border-slate-700 rounded-lg text-white focus:border-says-accent focus:outline-none transition-colors"
            >
              <option value="">Select Role</option>
              <option value="Admin">Admin</option>
              <option value="Sales">Sales</option>
              <option value="Merchandiser">Merchandiser</option>
            </select>
            <select
              value={formData.branch}
              onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
              className="px-4 py-2 bg-says-card border border-slate-700 rounded-lg text-white focus:border-says-accent focus:outline-none transition-colors"
            >
              <option value="">Select Branch</option>
              <option value="Kota Kinabalu">Kota Kinabalu</option>
              <option value="Kinabatangan">Kinabatangan</option>
            </select>
            <input
              type="number"
              placeholder="Salary (optional)"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              className="px-4 py-2 bg-says-card border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-says-accent focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddStaff}
              className="px-4 py-2 bg-says-accent hover:bg-red-500 text-white rounded-lg transition-colors duration-200 font-medium"
            >
              Add Staff
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search size={20} className="absolute left-3 top-3 text-slate-500" />
        <input
          type="text"
          placeholder="Search staff by name or username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-says-card border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-says-accent focus:outline-none transition-colors"
        />
      </div>

      {isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-700/50 bg-slate-900/40">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Delete Reason (Required)</label>
            <input
              type="text"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Example: Resigned / duplicate account"
              className="w-full px-4 py-2 bg-says-card border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-says-accent focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">Reference No (Optional)</label>
            <input
              type="text"
              value={deleteReferenceNo}
              onChange={(e) => setDeleteReferenceNo(e.target.value)}
              placeholder="Example: HR-EXIT-2026-02"
              className="w-full px-4 py-2 bg-says-card border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-says-accent focus:outline-none transition-colors"
            />
          </div>
        </div>
      )}

      {/* Staff Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-glass">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading staff data...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No staff members found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Username</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Branch</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                  {isSuperAdmin && <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Salary</th>}
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-slate-700/30 hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="px-6 py-4 text-white font-medium">{member.name}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{member.username}</td>
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          member.role === 'Admin'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-green-500/20 text-green-300'
                        )}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{member.branch}</td>
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          member.status === 'active'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-red-500/20 text-red-300'
                        )}
                      >
                        {member.status}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-6 py-4 text-white font-medium">
                        {member.salary ? `RM ${member.salary.toLocaleString()}` : '—'}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {isSuperAdmin && (
                          <>
                            <button
                              onClick={() => handleEditSalary(member.id, (member.salary || 0) + 100)}
                              className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                              title="Edit Salary"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(member.id)}
                              className="p-2 rounded-lg bg-says-accent/20 text-says-accent hover:bg-says-accent/30 transition-colors"
                              title="Delete Staff"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
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
