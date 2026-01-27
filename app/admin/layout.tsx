'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Package, Database, LogOut, Menu, X, Sun, ShoppingCart, Store, Truck, FileText, Banknote, Globe } from 'lucide-react';
import clsx from 'clsx';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Auth Check (Client-side protection)
  useEffect(() => {
    // In a real Next.js app, this should be middleware or server-side check.
    // For now, mirroring the Vite logic:
    /* 
    const userStr = localStorage.getItem('user');
    if (!userStr) {
       // router.push('/login'); // Commented out to avoid loop if cookies handle it differently in Next.js
       // The Middleware should handle protection usually.
    }
    */
  }, [router]);

  const handleLogout = async () => {
    // Call logout API to clear cookie
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('user');
    router.push('/login');
  };

  const navItems = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard },
    { to: '/admin/global-monitor', label: 'Global Monitor', icon: Globe },
    { to: '/admin/kota-kinabalu', label: 'Kota Kinabalu', icon: Store },
    { to: '/admin/kinabatangan', label: 'Kinabatangan', icon: Store },
    { to: '/admin/reports', label: 'Reports', icon: FileText },
    { to: '/admin/commissions', label: 'Commissions', icon: Banknote },
    { to: '/admin/loading', label: 'Van Loading', icon: Truck },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { to: '/admin/products', label: 'Products', icon: Package },
    { to: '/admin/customers', label: 'Customers', icon: Store },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/audits', label: 'Audits', icon: Package },
    { to: '/admin/database', label: 'Database', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 flex overflow-hidden font-sans">
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
          "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-900">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-900/20 mr-3">
               <span className="text-white font-bold text-xl">S</span>
            </div>
            <div>
               <h1 className="font-bold text-lg tracking-tight text-white">SAYS Admin</h1>
               <p className="text-xs text-slate-500">System Console</p>
            </div>
          </div>

          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  onClick={() => { if(window.innerWidth < 1024) setSidebarOpen(false) }}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    isActive 
                      ? "bg-red-600 text-white shadow-lg shadow-red-900/20" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  )}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800 bg-slate-900/50">
             <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">AD</span>
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">Administrator</p>
                    <p className="text-xs text-slate-500 truncate">HQ System</p>
                </div>
             </div>
             <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-700 rounded-lg text-red-400 hover:bg-red-900/20 hover:border-red-900/50 transition-colors"
            >
                <LogOut size={16} />
                Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-black relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
             <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px]" />
             <div className="absolute top-[20%] right-[0%] w-[30%] h-[30%] bg-red-900/10 rounded-full blur-[100px]" />
        </div>

        <header className="h-16 border-b border-slate-800 bg-black/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 z-10">
           <div className="flex items-center gap-4">
               <button 
                 onClick={() => setSidebarOpen(!sidebarOpen)}
                 className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
               >
                 {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
               </button>
               <h2 className="text-lg font-semibold text-white ml-2 lg:ml-0">
                 Dashboard
               </h2>
           </div>
           
           <div className="flex items-center gap-4">
              <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                  <Sun size={20} />
              </button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 z-10 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {children}
        </div>
      </main>
    </div>
  );
}
