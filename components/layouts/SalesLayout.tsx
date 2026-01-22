'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, ShoppingCart, LogOut, Menu, X, Package, Globe } from 'lucide-react';
import clsx from 'clsx';
import Image from 'next/image';

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

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/digital-audit', label: 'Digital Audit', icon: Package },
    { to: '/prospecting', label: 'Prospecting', icon: Users },
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
          <div className="h-20 flex items-center px-6 border-b border-slate-800/50 bg-slate-900/50">
            <div className="w-10 h-10 relative mr-3 flex items-center justify-center">
               <Image 
                 src="/logo.svg" 
                 alt="SAYS Logo" 
                 width={40} 
                 height={40} 
                 className="object-contain"
               />
            </div>
            <div>
               <h1 className="font-bold text-lg tracking-tight text-white">SAYS Vite</h1>
               <p className="text-xs text-slate-500">Sales Console</p>
            </div>
          </div>

          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.to || (item.to === '/' && pathname === '/');
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    isActive 
                      ? "bg-blue-600/90 backdrop-blur-sm text-white shadow-lg shadow-blue-900/20" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
                  )}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

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
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 z-10">
           <div className="flex items-center gap-4">
               <button 
                 onClick={() => setSidebarOpen(!sidebarOpen)}
                 className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg backdrop-blur-sm"
               >
                 {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
               </button>
               <h2 className="text-lg font-semibold text-white ml-2 lg:ml-0">
                 Welcome Back
               </h2>
           </div>
           
           <div className="flex items-center gap-3">
              <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-full transition-colors backdrop-blur-sm">
                  <Globe size={20} />
              </button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
