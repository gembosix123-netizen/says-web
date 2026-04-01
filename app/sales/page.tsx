'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Plus, 
  History, 
  FileText, 
  BarChart3, 
  ShoppingCart,
  DollarSign,
  Users,
  TrendingUp,
  LogOut,
  Home,
  User
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SalesHubPage() {
  const router = useRouter();
  const [todayStats, setTodayStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalCustomers: 0
  });
  const [myCustomerRows, setMyCustomerRows] = useState<Array<{
    id: string;
    name: string;
    area: string;
    visitedThisMonth: boolean;
    salesCountThisMonth: number;
    lastVisit: string | null;
  }>>([]);
  const [myCustomerLoading, setMyCustomerLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<{ name: string; role: string; branch: string } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const fetchUserInfo = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
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

  const fetchTodayStats = useCallback(async () => {
    try {
      const response = await fetch('/api/sales');
      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to fetch sales');
      }

      const sales = Array.isArray(payload) ? payload : [];
      const today = new Date().toISOString().split('T')[0];

      const todaysSales = sales.filter((sale) => {
        const createdAt = sale.created_at || sale.createdAt;
        return typeof createdAt === 'string' && createdAt.startsWith(today);
      });

      setTodayStats({
        totalSales: todaysSales.length,
        totalRevenue: todaysSales.reduce((sum, sale) => sum + Number(sale.total_amount ?? sale.total ?? 0), 0),
        totalCustomers: new Set(
          todaysSales
            .map((sale) => sale.customer_id || sale.customer?.id)
            .filter(Boolean)
        ).size
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyCustomers = useCallback(async () => {
    setMyCustomerLoading(true);
    try {
      const [custRes, salesRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/sales')
      ]);

      const custPayload = await custRes.json().catch(() => []);
      const salesPayload = await salesRes.json().catch(() => []);

      const customers = Array.isArray(custPayload) ? custPayload : [];
      const sales = Array.isArray(salesPayload) ? salesPayload : [];

      const monthKey = new Date().toISOString().slice(0, 7);
      const salesThisMonth = sales.filter((sale) => {
        const transactionDate = sale.created_at || sale.createdAt || sale.transactionDate;
        return typeof transactionDate === 'string' && transactionDate.startsWith(monthKey);
      });

      const salesByCustomer = salesThisMonth.reduce<Record<string, Array<Record<string, unknown>>>>((acc, sale) => {
        const customerId = String(sale.customer_id || sale.customer?.id || '');
        if (!customerId) return acc;
        if (!acc[customerId]) acc[customerId] = [];
        acc[customerId].push(sale);
        return acc;
      }, {});

      const rows = customers.map((customer) => {
        const customerId = String(customer.id || '');
        const customerSales = salesByCustomer[customerId] || [];

        const lastVisitRaw = customerSales
          .map((sale) => String(sale.created_at || sale.createdAt || sale.transactionDate || ''))
          .filter((dateValue) => dateValue.length > 0)
          .sort()
          .at(-1) || null;

        const area =
          String(customer.district || '').trim() ||
          String(customer.town || '').trim() ||
          String(customer.branch || '').trim() ||
          'Tidak dinyatakan';

        return {
          id: customerId,
          name: String(customer.name || 'Tanpa nama'),
          area,
          visitedThisMonth: customerSales.length > 0,
          salesCountThisMonth: customerSales.length,
          lastVisit: lastVisitRaw,
        };
      });

      setMyCustomerRows(rows);
    } catch (error) {
      console.error('Failed to load customer task rows:', error);
      setMyCustomerRows([]);
    } finally {
      setMyCustomerLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayStats();
    fetchUserInfo();
    fetchMyCustomers();
  }, [fetchTodayStats, fetchUserInfo, fetchMyCustomers]);

  const menuItems = [
    {
      title: 'Jualan Baru',
      description: 'Buat pesanan jualan baru',
      icon: Plus,
      href: '/sales/new',
      color: 'from-blue-500 to-blue-600',
      borderColor: 'border-blue-500/50'
    },
    {
      title: 'Sejarah Jualan',
      description: 'Lihat semua transaksi lepas',
      icon: History,
      href: '/sales/history',
      color: 'from-purple-500 to-purple-600',
      borderColor: 'border-purple-500/50'
    },
    {
      title: 'Laporan Harian',
      description: 'Laporan jualan hari ini',
      icon: FileText,
      href: '/sales/daily-report',
      color: 'from-emerald-500 to-emerald-600',
      borderColor: 'border-emerald-500/50'
    },
    {
      title: 'Statistik',
      description: 'Analisis prestasi jualan',
      icon: BarChart3,
      href: '/sales/stats',
      color: 'from-orange-500 to-orange-600',
      borderColor: 'border-orange-500/50'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Header Bar */}
      <div className="bg-slate-900/80 border-b border-slate-700 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Left: Back & Title */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/sales-dashboard')}
              className="text-white/60 hover:text-white"
            >
              <Home size={18} />
            </Button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-lg font-semibold text-white">Modul Jualan</h1>
          </div>

          {/* Right: User Info & Logout */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {userInfo?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium text-white">{userInfo?.name || 'User'}</p>
                <p className="text-xs text-white/50">{userInfo?.branch || 'Branch'}</p>
              </div>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center">
                      <User size={24} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{userInfo?.name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {userInfo?.role}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300">
                          {userInfo?.branch}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => router.push('/sales-dashboard')}
                    className="w-full flex items-center gap-3 px-3 py-2 text-white/70 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Home size={18} />
                    <span>Main Dashboard</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">

        {/* Today's Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <ShoppingCart size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Jualan Hari Ini</p>
                <p className="text-xl font-bold text-white">
                  {loading ? '...' : todayStats.totalSales}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <DollarSign size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Hasil</p>
                <p className="text-xl font-bold text-white">
                  {loading ? '...' : `RM ${todayStats.totalRevenue.toLocaleString()}`}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Users size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Pelanggan</p>
                <p className="text-xl font-bold text-white">
                  {loading ? '...' : todayStats.totalCustomers}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <TrendingUp size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Purata</p>
                <p className="text-xl font-bold text-white">
                  {loading ? '...' : todayStats.totalSales > 0 
                    ? `RM ${Math.round(todayStats.totalRevenue / todayStats.totalSales).toLocaleString()}`
                    : 'RM 0'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {menuItems.map((item) => (
            <div
              key={item.title}
              className="cursor-pointer"
              onClick={() => router.push(item.href)}
            >
              <Card className={`p-6 hover:bg-white/5 transition-all group border-2 border-transparent hover:${item.borderColor}`}>
                <div className="flex items-start gap-4">
                  <div className={`p-4 rounded-xl bg-gradient-to-br ${item.color} group-hover:scale-110 transition-transform`}>
                    <item.icon size={28} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white mb-1">{item.title}</h2>
                    <p className="text-white/60 text-sm">{item.description}</p>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>

        {/* My Customer (Monthly Task Table) */}
        <Card className="p-6 border-slate-700/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">My Customer (Bulan Ini)</h3>
              <p className="text-white/60 text-sm">Kedai sendiri: sudah pergi vs belum pergi</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => router.push('/sales/new')}>
              <Plus size={16} className="mr-2" />
              Jualan Baru
            </Button>
          </div>

          {myCustomerLoading ? (
            <p className="text-white/60">Memuatkan senarai pelanggan...</p>
          ) : myCustomerRows.length === 0 ? (
            <p className="text-white/60">Tiada pelanggan untuk dipaparkan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/60 border-b border-slate-700">
                    <th className="py-2 pr-4">Kedai</th>
                    <th className="py-2 pr-4">Area</th>
                    <th className="py-2 pr-4">Status Bulan Ini</th>
                    <th className="py-2 pr-4">Bil. Sales</th>
                    <th className="py-2">Lawatan Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {myCustomerRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800">
                      <td className="py-2 pr-4 text-white">{row.name}</td>
                      <td className="py-2 pr-4 text-white/80">{row.area}</td>
                      <td className="py-2 pr-4">
                        {row.visitedThisMonth ? (
                          <span className="text-emerald-400">Sudah pergi</span>
                        ) : (
                          <span className="text-amber-400">Belum pergi</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-white/80">{row.salesCountThisMonth}</td>
                      <td className="py-2 text-white/80">
                        {row.lastVisit ? new Date(row.lastVisit).toLocaleDateString('ms-MY') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showUserMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </div>
  );
}
