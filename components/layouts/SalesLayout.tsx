'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, LogOut, Menu, X, Globe } from 'lucide-react';
import clsx from 'clsx';
import SidebarHeader from '@/components/SidebarHeader';

// User Info Component
function UserHeaderInfo() {
  const [userInfo, setUserInfo] = useState({ username: '', role: '', branch: '' });
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        // Batch state update to prevent cascading renders
        setUserInfo({
          username: userData.name || userData.username || 'User',
          role: userData.role || '',
          branch: userData.branch || ''
        });
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    }
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
    <div className="flex items-center gap-3">
      {userInfo.username && (
        <>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{userInfo.username}</p>
            <p className="text-xs text-slate-400">{userInfo.branch || 'Branch N/A'}</p>
          </div>
          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
            {userInfo.role}
          </span>
        </>
      )}
      <button
        onClick={handleLogout}
        className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
        title="Logout"
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('user');
      router.push('/login');
    } catch (error) {
      console.error('Logout failed', error);
      router.push('/login');
    }
  };

  // Hanya menu yang kau mahu
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/daily-sales', label: 'Daily Sales', icon: ShoppingCart },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 flex overflow-hidden font-sans relative">
      {/* Global Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-[40%] right-[0%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={clsx(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900/80 backdrop-blur-xl border-r border-slate-800 transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Header Sidebar / Logo */}
          <SidebarHeader className="bg-slate-900/50 border-white/10" />

          {/* Navigation Links */}
          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    isActive 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
                  )}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout Section */}
          <div className="p-4 border-t border-slate-800/50 bg-slate-900/30">
             <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-700/50 rounded-lg text-red-400 hover:bg-red-900/20 hover:border-red-900/50 transition-colors"
            >
                <LogOut size={16} />
                Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-transparent relative z-10">
        <header className="flex items-center justify-between px-4 lg:px-8 z-10 border-b border-slate-800/30 bg-slate-900/30">
           <div className="flex items-center gap-4">
               <button 
                 onClick={() => setSidebarOpen(!sidebarOpen)}
                 className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg backdrop-blur-sm"
               >
                 {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
               </button>
               <h2 className="text-sm font-medium text-slate-400">
                 Sales Dashboard / <span className="text-white font-bold">Active Session</span>
               </h2>
           </div>
           
           <div className="flex items-center gap-6">
              <UserHeaderInfo />
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 z-10 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}