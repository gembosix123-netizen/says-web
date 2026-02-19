'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import MetricCard from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Store, TrendingUp, LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SalesDashboardPage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<{ name: string; role: string; branch: string } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [stats, setStats] = useState({ sales: 0, visits: 0, revenue: 0 });

  useEffect(() => {
    fetchUserInfo();
    fetchTodayStats();
  }, []);

  const fetchUserInfo = () => {
    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(c => c.trim().startsWith('session='));
    if (sessionCookie) {
      try {
        const sessionValue = sessionCookie.split('=')[1];
        const decoded = decodeURIComponent(sessionValue);
        const data = JSON.parse(decoded);
        setUserInfo({
          name: data.name || data.username || 'User',
          role: data.role || '',
          branch: data.branch || ''
        });
      } catch (e) {
        console.error('Failed to parse session:', e);
      }
    }
  };

  const fetchTodayStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [salesRes, visitsRes] = await Promise.all([
        supabase.from('sales').select('total_amount').gte('created_at', `${today}T00:00:00`),
        supabase.from('store_visits').select('id').gte('check_in_time', `${today}T00:00:00`)
      ]);

      setStats({
        sales: salesRes.data?.length || 0,
        visits: visitsRes.data?.length || 0,
        revenue: salesRes.data?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0
      });
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  };

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

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Header Bar */}
      <div className="bg-slate-900/80 border-b border-slate-700 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Title */}
          <div>
            <h1 className="text-xl font-bold text-white">SAYS System</h1>
            <p className="text-xs text-white/50">Sales & Merchandiser Portal</p>
          </div>

          {/* Right: User Info & Logout */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center">
                <span className="text-white font-bold">
                  {userInfo?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium text-white">{userInfo?.name || 'User'}</p>
                <p className="text-xs text-white/50">{userInfo?.role} • {userInfo?.branch}</p>
              </div>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center">
                      <User size={28} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">{userInfo?.name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/30 text-blue-300 border border-blue-500/50">
                          {userInfo?.role}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                          {userInfo?.branch}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-2">
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

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Welcome Message */}
          <div className="text-center py-4">
            <h2 className="text-3xl font-bold text-white mb-2">
              Selamat Datang, {userInfo?.name || 'User'}!
            </h2>
            <p className="text-white/60">Pilih aktiviti anda untuk hari ini</p>
          </div>

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sales Option */}
          <div
            className="cursor-pointer"
            onClick={() => router.push('/sales')}
          >
            <Card className="p-8 hover:bg-white/10 transition-all group border-2 border-transparent hover:border-blue-500/50">
            <div className="text-center space-y-4">
              <div className="inline-flex p-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 group-hover:scale-110 transition-transform">
                <ShoppingCart size={48} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Sales</h2>
                <p className="text-white/60">
                  Create sales orders, process payments, manage customer transactions
                </p>
              </div>
              <Button variant="primary" size="lg" className="w-full">
                Go to Sales
              </Button>
            </div>
            </Card>
          </div>

          {/* Merchandiser Option */}
          <div
            className="cursor-pointer"
            onClick={() => router.push('/merchandiser')}
          >
            <Card className="p-8 hover:bg-white/10 transition-all group border-2 border-transparent hover:border-emerald-500/50">
            <div className="text-center space-y-4">
              <div className="inline-flex p-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 group-hover:scale-110 transition-transform">
                <Store size={48} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Merchandiser</h2>
                <p className="text-white/60">
                  Visit stores, conduct audits, check product conditions, take photos
                </p>
              </div>
              <Button variant="primary" size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700">
                Go to Merchandiser
              </Button>
            </div>
            </Card>
          </div>
        </div>

        {/* Today's Summary */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Today's Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Sales Today"
              value={0}
              icon={ShoppingCart}
            />
            <MetricCard
              title="Store Visits"
              value={0}
              icon={Store}
            />
            <MetricCard
              title="Revenue"
              value="RM 0"
              icon={TrendingUp}
            />
          </div>
        </div>

        {/* Quick Links */}
        <Card>
          <h3 className="font-semibold text-white mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/sales')}
            >
              Sales History
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/merchandiser/history')}
            >
              Visit History
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/daily-sales')}
            >
              Daily Report
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/inventory')}
            >
              Inventory
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
