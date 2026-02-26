'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, LogOut, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface NavigationHeaderProps {
  title: string;
  backHref?: string;
  showBack?: boolean;
}

export default function NavigationHeader({ 
  title, 
  backHref = '/sales-dashboard',
  showBack = true 
}: NavigationHeaderProps) {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<{ name: string; role: string; branch: string } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const payload = await response.json().catch(() => null);

        if (!mounted || !response.ok || !payload) {
          return;
        }

        setUserInfo({
          name: payload.name || payload.username || 'User',
          role: payload.role || '',
          branch: payload.branch || ''
        });
      } catch (e) {
        console.error('Failed to fetch user info:', e);
      }
    };

    fetchUserInfo();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout failed:', e);
    }
    localStorage.removeItem('user');
    document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    router.push('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserMenu]);

  return (
    <div className="bg-slate-900/80 border-b border-slate-700 px-4 py-3 sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          {showBack && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(backHref)}
                className="text-white/60 hover:text-white hover:bg-slate-800"
              >
                <Home size={18} />
              </Button>
              <div className="h-6 w-px bg-slate-700" />
            </>
          )}
          <h1 className="text-lg font-semibold text-white">{title}</h1>
        </div>

        {/* Right: User Info & Logout */}
        <div className="relative user-menu-container">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {userInfo?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-white">{userInfo?.name || 'User'}</p>
              <p className="text-xs text-white/50">{userInfo?.branch || 'Branch'}</p>
            </div>
            <ChevronDown size={16} className={`text-white/50 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
              {/* User Info Section */}
              <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center">
                    <User size={28} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-lg truncate">{userInfo?.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {userInfo?.role}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                        {userInfo?.branch}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-2">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push('/sales-dashboard');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Home size={20} />
                  <span className="font-medium">Main Dashboard</span>
                </button>
                
                <div className="border-t border-slate-700 my-2" />
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut size={20} />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
