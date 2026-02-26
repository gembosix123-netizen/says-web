'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useMerchandiser } from '@/context/MerchandiserContext';
import { Card } from '@/components/ui/Card';
import MetricCard from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { Store, CheckCircle, Clock, AlertTriangle, Loader2, Home, LogOut, User, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function MerchandiserDashboard() {
  const { visits, allowedCustomers, loading } = useMerchandiser();
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<{ name: string; role: string; branch: string } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const payload = await response.json().catch(() => null);

        if (mounted && response.ok && payload) {
          setUserInfo({
            name: payload.name || payload.username || 'User',
            role: payload.role || '',
            branch: payload.branch || ''
          });
          return;
        }
      } catch (e) {
        console.error('Failed to fetch authenticated user:', e);
      }

      const localUser = localStorage.getItem('user');
      if (!localUser || !mounted) {
        return;
      }

      try {
        const data = JSON.parse(localUser);
        setUserInfo({
          name: data.name || data.username || 'User',
          role: data.role || '',
          branch: data.branch || ''
        });
      } catch (e) {
        console.error('Failed to parse local user data:', e);
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

  // Optimized metrics calculation with useMemo
  const metrics = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const todayVisits = visits.filter(v => new Date(v.check_in_time).toDateString() === todayStr);
    const inProgress = visits.filter(v => v.status === 'in-progress');
    const completedToday = todayVisits.filter(v => v.status === 'completed');
    
    const monthlyCompleted = visits.filter(v => {
      const d = new Date(v.check_in_time);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && v.status === 'completed';
    });

    const issues = 0;

    return { todayVisits, inProgress, completedToday, monthlyCompleted, issues };
  }, [visits]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-400 animate-pulse">Synchronizing data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Header Bar */}
      <div className="bg-slate-900/80 border-b border-slate-700 px-4 py-3 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Back & Title */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/sales-dashboard')}
              className="text-white/60 hover:text-white hover:bg-slate-800"
            >
              <Home size={18} />
            </Button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-lg font-semibold text-white">Merchandiser</h1>
          </div>

          {/* Right: User Info & Logout */}
          <div className="relative user-menu-container">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {userInfo?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-white">{userInfo?.name || 'User'}</p>
                <p className="text-xs text-white/60">
                  {[userInfo?.role, userInfo?.branch].filter(Boolean).join(' • ') || 'Maklumat akaun tiada'}
                </p>
              </div>
              <ChevronDown size={16} className={`text-white/50 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                {/* User Info Section */}
                <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center">
                      <User size={28} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-lg truncate">{userInfo?.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {userInfo?.role && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {userInfo.role}
                          </span>
                        )}
                        {userInfo?.branch && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                            {userInfo.branch}
                          </span>
                        )}
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

      {/* Main Content */}
      <div className="p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Merchandiser Dashboard</h1>
              <p className="text-slate-400 mt-1">
                {new Date().toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <Button onClick={() => router.push('/merchandiser/visit')} size="lg" className="w-full sm:w-auto">
              <Store className="w-5 h-5 mr-2" />
              New Store Visit
            </Button>
          </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard title="Visits Today" value={metrics.todayVisits.length} icon={Store} />
          <MetricCard title="Completed" value={metrics.completedToday.length} icon={CheckCircle} status="success" />
          <MetricCard title="In Progress" value={metrics.inProgress.length} icon={Clock} status="warning" />
          <MetricCard title="Issues Found" value={metrics.issues} icon={AlertTriangle} status={metrics.issues > 0 ? 'danger' : 'neutral'} />
        </div>

        {/* Active Visits */}
        {metrics.inProgress.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              Active Visits
            </h2>
            <div className="grid gap-3">
              {metrics.inProgress.map((visit) => (
                <div key={visit.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-center space-x-3 text-white">
                    <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{visit.customer?.name || 'Unknown Store'}</p>
                      <p className="text-xs text-slate-400">Started: {new Date(visit.check_in_time).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <Button onClick={() => router.push(`/merchandiser/visit?resume=${visit.id}`)} variant="secondary" size="sm" className="w-full sm:w-auto">
                    Resume
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recent Visits */}
        <Card className="bg-slate-800/50 border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Recent Visits</h2>
            <Button onClick={() => router.push('/merchandiser/history')} variant="ghost" size="sm">
              View All
            </Button>
          </div>

          {metrics.completedToday.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No visits completed today</p>
              <Button onClick={() => router.push('/merchandiser/visit')} className="mt-4" variant="secondary">
                Start Your First Visit
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {metrics.completedToday.slice(0, 5).map((visit) => (
                <div
                  key={visit.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-all cursor-pointer"
                  onClick={() => router.push(`/merchandiser/history/${visit.id}`)}
                >
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{visit.customer?.name || 'Unknown Store'}</p>
                      <p className="text-sm text-slate-400">Completed: {new Date(visit.check_out_time || '').toLocaleTimeString()}</p>
                    </div>
                  </div>
                  {visit.photo_urls && visit.photo_urls.length > 0 && (
                    <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                      {visit.photo_urls.length} photos
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-blue-600/10 to-blue-800/10 border-blue-500/20 p-6">
            <h3 className="text-slate-400 text-sm font-medium">Assigned Stores</h3>
            <p className="text-4xl font-bold text-white mt-2">{allowedCustomers.length}</p>
            <p className="text-xs text-blue-400 mt-1">stores in your area</p>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-600/10 to-emerald-800/10 border-emerald-500/20 p-6">
            <h3 className="text-slate-400 text-sm font-medium">This Month</h3>
            <p className="text-4xl font-bold text-white mt-2">{metrics.monthlyCompleted.length}</p>
            <p className="text-xs text-emerald-400 mt-1">visits completed</p>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}