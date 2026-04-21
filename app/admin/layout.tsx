'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Package, Database, LogOut, Menu, X, ShoppingCart, Store, Truck, FileText, Banknote, Globe, Upload, ReceiptText, Receipt, BarChart2 } from 'lucide-react';
import clsx from 'clsx';
import { useLanguage } from '@/context/LanguageContext';
import ClientSwitchers from '@/components/ClientSwitchers';
import SidebarHeader from '@/components/SidebarHeader';
import { normalizeRole } from '@/lib/roles';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [userRole, setUserRole] = useState('');
  const [userBranch, setUserBranch] = useState('');
  const [username, setUsername] = useState('');
  
  const pathname = usePathname();
  const router = useRouter();

  // Get user role and branch from API (for most up-to-date data)
  useEffect(() => {
    const getUserData = async () => {
      try {
        const localUserRaw = localStorage.getItem('user');
        if (localUserRaw) {
          const localUser = JSON.parse(localUserRaw);
          setUsername(localUser.name || localUser.username || 'User');
          setUserRole(localUser.role || '');
          setUserBranch(localUser.branch || '');
        }
      } catch (error) {
        console.error('Failed to parse local user data:', error);
      }

      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const userData = await response.json();
          // Batch state updates to prevent cascading renders
          setUsername(userData.name || userData.username || 'User');
          setUserRole(userData.role);
          setUserBranch(userData.branch);
        }
      } catch (error) {
        console.error('Failed to get user data:', error);
      }
    };
    getUserData();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('user');
    router.push('/login');
  };

  // Filter nav items based on role and branch
  const getFilteredNavItems = () => {
    const activeRole = normalizeRole(userRole) || 'Sales';

    const allItems = [
      { to: '/admin', label: 'overview', icon: LayoutDashboard, roles: ['Main Admin'] },
      { to: '/admin/global-monitor', label: 'global_monitor', icon: Globe, roles: ['Main Admin'] },
      { to: '/admin/kota-kinabalu', label: 'kota_kinabalu', icon: Store, roles: ['Main Admin', 'Admin', 'Sales'], branches: ['HQ', 'Kota Kinabalu'] },
      { to: '/admin/kinabatangan', label: 'kinabatangan', icon: Store, roles: ['Main Admin', 'Admin', 'Sales'], branches: ['HQ', 'Kinabatangan'] },
      { to: '/admin/reports', label: 'reports', icon: FileText, roles: ['Main Admin', 'Admin'] },
      { to: '/admin/audit-center', label: 'audit_center', icon: FileText, roles: ['Main Admin'] },
      { to: '/admin/commissions', label: 'commissions', icon: Banknote, roles: ['Main Admin', 'Admin', 'Sales'] },
      { to: '/admin/live-sales', label: 'Live Sales', icon: ReceiptText, roles: ['Main Admin', 'Admin'] },
      { to: '/admin/weekly-reports', label: 'Laporan Mingguan', icon: BarChart2, roles: ['Main Admin', 'Admin'] },
      { to: '/admin/expenses', label: 'Expenses', icon: Receipt, roles: ['Main Admin', 'Admin'] },
      { to: '/admin/loading', label: 'van_loading', icon: Truck, roles: ['Main Admin', 'Admin', 'Sales'] },
      { to: '/admin/orders', label: 'orders', icon: ShoppingCart, roles: ['Main Admin', 'Admin', 'Sales'] },
      { to: '/admin/products', label: 'products', icon: Package, roles: ['Main Admin', 'Admin'] },
      { to: '/admin/customers', label: 'customers', icon: Store, roles: ['Main Admin', 'Admin', 'Sales'] },
      { to: '/admin/backdated-import', label: 'backdated_import', icon: Upload, roles: ['Main Admin', 'Admin'] },
      { to: '/admin/users', label: 'user_management', icon: Users, roles: ['Main Admin'] },
      { to: '/admin/audits', label: 'audits', icon: Package, roles: ['Main Admin'] },
      { to: '/admin/backdated-import', label: 'backdated_import', icon: Upload, roles: ['Main Admin', 'Admin'] },
      { to: '/admin/database', label: 'database_nav', icon: Database, roles: ['Main Admin', 'Admin'] },
    ];

    return allItems.filter(item => {
      // Check role permission
      if (!item.roles.includes(activeRole)) return false;
      
      // Check branch permission for branch-specific items
      if (item.branches && activeRole !== 'Main Admin') {
        // Least-privilege: if branch hasn't loaded yet, hide branch-specific items first
        if (!userBranch) return false;
        return item.branches.includes(userBranch) || userBranch === 'HQ';
      }
      
      return true;
    });
  };

  const navItems = getFilteredNavItems();

  return (
    <div className="min-h-screen soft-page-bg text-slate-900 dark:text-slate-100 flex overflow-hidden font-sans">
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
          "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-50/85 border-r border-slate-200/70 dark:bg-slate-900 dark:border-slate-800 transform transition-transform duration-300 ease-in-out backdrop-blur-sm",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-full flex flex-col">
          <SidebarHeader logoAlt="Admin HQ" className="bg-slate-50/90 border-slate-200/70 dark:bg-slate-900 dark:border-white/10" />

          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.to;
              const translationKey = item.label;
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  onClick={() => { if(window.innerWidth < 1024) setSidebarOpen(false) }}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    isActive 
                      ? "bg-rose-500 text-white shadow-sm" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  )}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{t(translationKey)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200/70 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50">
             <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {normalizeRole(userRole) === 'Main Admin' ? 'MA' : normalizeRole(userRole) === 'Admin' ? 'AD' : 'SA'}
                    </span>
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {normalizeRole(userRole) === 'Main Admin' ? t('main_admin') : 
                       normalizeRole(userRole) === 'Admin' ? `${t('admin_role')} - ${userBranch}` : 
                       `${t('sales_role')} - ${userBranch}`}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {normalizeRole(userRole) === 'Main Admin' ? 'HQ' : userBranch}
                    </p>
                </div>
             </div>
             <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-900/50 transition-colors"
            >
                <LogOut size={16} />
                {t('logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden soft-page-bg relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
             <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px]" />
             <div className="absolute top-[20%] right-[0%] w-[30%] h-[30%] bg-red-900/10 rounded-full blur-[100px]" />
        </div>

        <header className="h-16 border-b border-slate-200/70 bg-slate-50/70 dark:border-slate-800 dark:bg-black/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 z-10">
            <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white ml-2 lg:ml-0">
                  {t('admin_panel')}
                </h2>
            </div>
            
            <div className="flex items-center gap-4">
               {username && (
                 <div className="flex items-center gap-3 px-3 py-2 bg-white/75 rounded-lg border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{username}</p>
                      <p className="text-xs text-slate-400">{userBranch || t('branch') + ' N/A'}</p>
                    </div>
                    <div className="flex gap-1 pl-2 border-l border-slate-300 dark:border-slate-600">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
                        {userRole || t('loading')}
                      </span>
                    </div>
                 </div>
               )}
               <ClientSwitchers />
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 z-10 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {children}
        </div>
      </main>
    </div>
  );
}