'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function UserHeader() {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [branch, setBranch] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const userData = await response.json().catch(() => null);

        if (!response.ok || !userData) return;

        setUsername(userData.name || userData.username || 'User');
        setRole(userData.role || '');
        setBranch(userData.branch || '');
      } catch (e) {
        console.error('Failed to fetch user:', e);
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout failed:', e);
    }
    localStorage.removeItem('user');
    router.push('/');
  };

  return (
    <div className="flex items-center justify-between bg-slate-900/50 border-b border-slate-700 px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">{username.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{username}</p>
          <div className="flex gap-2 mt-1">
            <span className="px-2 py-0.5 text-xs rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">{role}</span>
            <span className="px-2 py-0.5 text-xs rounded bg-slate-800/50 text-slate-300 border border-slate-600/50">{branch}</span>
          </div>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
        title="Logout"
      >
        <LogOut size={18} />
        <span className="text-sm">Logout</span>
      </button>
    </div>
  );
}
