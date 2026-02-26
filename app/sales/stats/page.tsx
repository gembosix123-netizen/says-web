'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  ArrowLeft, 
  TrendingUp,
  Target,
  BarChart3,
  Calendar,
  Store,
  Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface WeeklyData {
  day: string;
  date: string;
  sales: number;
  revenue: number;
}

interface SalesApiItem {
  name?: string;
  product_name?: string;
  quantity?: number;
  subtotal?: number;
  price?: number;
}

interface SalesApiRecord {
  id: string;
  customer_id?: string;
  customer_name?: string;
  customer?: { id?: string; name?: string };
  total?: number;
  total_amount?: number;
  created_at?: string;
  createdAt?: string;
  items?: SalesApiItem[];
}

interface StatsData {
  thisWeek: {
    totalSales: number;
    totalRevenue: number;
    avgDaily: number;
  };
  lastWeek: {
    totalSales: number;
    totalRevenue: number;
  };
  weeklyData: WeeklyData[];
  monthlyTarget: number;
  monthlyAchieved: number;
  topCustomers: { name: string; totalSpent: number; orders: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
}

export default function SalesStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const response = await fetch('/api/sales');
      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to fetch sales data');
      }

      const allSales: SalesApiRecord[] = Array.isArray(payload) ? payload : [];
      const normalizedSales = allSales.map((sale) => {
        const createdAt = sale.created_at || sale.createdAt || '';
        return {
          ...sale,
          created_at: createdAt,
          total_amount: Number(sale.total_amount ?? sale.total ?? 0),
        };
      });
      
      // Get this week's data
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekStartMs = new Date(weekStart.toISOString().split('T')[0]).getTime();

      // Get last week's start
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekStartMs = new Date(lastWeekStart.toISOString().split('T')[0]).getTime();

      // Get month start
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartMs = monthStart.getTime();

      const thisWeek = normalizedSales.filter((sale) => {
        const createdMs = new Date(sale.created_at || '').getTime();
        return !Number.isNaN(createdMs) && createdMs >= weekStartMs;
      });

      const lastWeek = normalizedSales.filter((sale) => {
        const createdMs = new Date(sale.created_at || '').getTime();
        return !Number.isNaN(createdMs) && createdMs >= lastWeekStartMs && createdMs < weekStartMs;
      });

      const month = normalizedSales.filter((sale) => {
        const createdMs = new Date(sale.created_at || '').getTime();
        return !Number.isNaN(createdMs) && createdMs >= monthStartMs;
      });

      // Calculate this week stats
      const thisWeekRevenue = thisWeek.reduce((sum, s) => sum + (s.total_amount || 0), 0);

      // Calculate last week stats
      const lastWeekRevenue = lastWeek.reduce((sum, s) => sum + (s.total_amount || 0), 0);

      // Calculate monthly stats
      const monthRevenue = month.reduce((sum, s) => sum + (s.total_amount || 0), 0);

      // Weekly data by day
      const dayNames = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
      const weeklyData: WeeklyData[] = [];
      
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + i);
        const dayStr = dayDate.toISOString().split('T')[0];
        
        const daySales = thisWeek.filter(s => 
          s.created_at.startsWith(dayStr)
        );
        
        weeklyData.push({
          day: dayNames[i],
          date: dayStr,
          sales: daySales.length,
          revenue: daySales.reduce((sum, s) => sum + (s.total_amount || 0), 0)
        });
      }

      // Top customers
      const customerMap: Record<string, { name: string; totalSpent: number; orders: number }> = {};
      thisWeek.forEach(sale => {
        const name = sale.customer_name || sale.customer?.name || 'Unknown';
        if (!customerMap[name]) {
          customerMap[name] = { name, totalSpent: 0, orders: 0 };
        }
        customerMap[name].totalSpent += sale.total_amount || 0;
        customerMap[name].orders++;
      });
      const topCustomers = Object.values(customerMap)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);

      // Top products
      const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
      thisWeek.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach((item) => {
            const productName = item.product_name || item.name;
            if (productName) {
              if (!productMap[productName]) {
                productMap[productName] = { name: productName, quantity: 0, revenue: 0 };
              }
              productMap[productName].quantity += Number(item.quantity || 0);
              productMap[productName].revenue += Number(item.subtotal || 0) || (Number(item.price || 0) * Number(item.quantity || 0));
            }
          });
        }
      });
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setStats({
        thisWeek: {
          totalSales: thisWeek.length,
          totalRevenue: thisWeekRevenue,
          avgDaily: thisWeekRevenue / 7
        },
        lastWeek: {
          totalSales: lastWeek.length,
          totalRevenue: lastWeekRevenue
        },
        weeklyData,
        monthlyTarget: 50000, // Set your target here
        monthlyAchieved: monthRevenue,
        topCustomers,
        topProducts
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `RM ${amount.toLocaleString('ms-MY', { minimumFractionDigits: 0 })}`;

  const getGrowthPercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Get max revenue for chart scaling
  const maxDayRevenue = stats ? Math.max(...stats.weeklyData.map(d => d.revenue), 1) : 1;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/sales')}
              className="text-white/60 hover:text-white"
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Statistik Jualan</h1>
              <p className="text-white/60">Analisis prestasi jualan anda</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === 'week' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-white/60'
              }`}
              onClick={() => setPeriod('week')}
            >
              Minggu Ini
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === 'month' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-white/60'
              }`}
              onClick={() => setPeriod('month')}
            >
              Bulan Ini
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white/60">Memuatkan statistik...</div>
          </div>
        ) : stats ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-blue-500/20">
                    <BarChart3 size={24} className="text-blue-400" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${
                    getGrowthPercent(stats.thisWeek.totalSales, stats.lastWeek.totalSales) >= 0 
                      ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    <TrendingUp size={16} />
                    {getGrowthPercent(stats.thisWeek.totalSales, stats.lastWeek.totalSales)}%
                  </div>
                </div>
                <p className="text-white/60 text-sm">Jumlah Jualan (Minggu Ini)</p>
                <p className="text-3xl font-bold text-white">{stats.thisWeek.totalSales}</p>
                <p className="text-white/40 text-sm mt-1">vs {stats.lastWeek.totalSales} minggu lepas</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20">
                    <TrendingUp size={24} className="text-emerald-400" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${
                    getGrowthPercent(stats.thisWeek.totalRevenue, stats.lastWeek.totalRevenue) >= 0 
                      ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    <TrendingUp size={16} />
                    {getGrowthPercent(stats.thisWeek.totalRevenue, stats.lastWeek.totalRevenue)}%
                  </div>
                </div>
                <p className="text-white/60 text-sm">Jumlah Hasil (Minggu Ini)</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(stats.thisWeek.totalRevenue)}</p>
                <p className="text-white/40 text-sm mt-1">vs {formatCurrency(stats.lastWeek.totalRevenue)} minggu lepas</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-purple-500/20">
                    <Calendar size={24} className="text-purple-400" />
                  </div>
                </div>
                <p className="text-white/60 text-sm">Purata Harian</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(stats.thisWeek.avgDaily)}</p>
                <p className="text-white/40 text-sm mt-1">sehari</p>
              </Card>
            </div>

            {/* Target Progress */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target size={20} className="text-orange-400" />
                <h3 className="font-semibold text-white">Pencapaian Target Bulanan</h3>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <div className="flex justify-between mb-2">
                    <span className="text-white/60">Dicapai: {formatCurrency(stats.monthlyAchieved)}</span>
                    <span className="text-white/60">Target: {formatCurrency(stats.monthlyTarget)}</span>
                  </div>
                  <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        (stats.monthlyAchieved / stats.monthlyTarget) >= 1 
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                          : 'bg-gradient-to-r from-orange-500 to-yellow-500'
                      }`}
                      style={{ width: `${Math.min((stats.monthlyAchieved / stats.monthlyTarget) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${
                    (stats.monthlyAchieved / stats.monthlyTarget) >= 1 ? 'text-emerald-400' : 'text-orange-400'
                  }`}>
                    {Math.round((stats.monthlyAchieved / stats.monthlyTarget) * 100)}%
                  </p>
                </div>
              </div>
            </Card>

            {/* Weekly Chart */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 size={20} className="text-blue-400" />
                <h3 className="font-semibold text-white">Prestasi Mingguan</h3>
              </div>
              <div className="flex items-end gap-4 h-48">
                {stats.weeklyData.map((day, idx) => (
                  <div key={day.day} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col items-center mb-2">
                      <p className="text-white/60 text-xs mb-1">{formatCurrency(day.revenue)}</p>
                      <p className="text-white text-xs">{day.sales} jualan</p>
                    </div>
                    <div
                      className={`w-full rounded-t transition-all ${
                        idx === new Date().getDay() 
                          ? 'bg-blue-500' 
                          : 'bg-blue-500/40 hover:bg-blue-500/60'
                      }`}
                      style={{
                        height: `${(day.revenue / maxDayRevenue) * 100}%`,
                        minHeight: day.revenue > 0 ? '8px' : '4px'
                      }}
                    />
                    <p className={`text-xs mt-2 ${
                      idx === new Date().getDay() ? 'text-blue-400 font-bold' : 'text-white/60'
                    }`}>
                      {day.day.slice(0, 3)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Customers */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Store size={20} className="text-purple-400" />
                  <h3 className="font-semibold text-white">Pelanggan Terbaik</h3>
                </div>
                {stats.topCustomers.length === 0 ? (
                  <p className="text-white/40 text-center py-8">Tiada data</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topCustomers.map((customer, idx) => (
                      <div key={customer.name} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          idx === 0 ? 'bg-yellow-500 text-black' :
                          idx === 1 ? 'bg-slate-400 text-black' :
                          idx === 2 ? 'bg-orange-600 text-white' :
                          'bg-slate-700 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium">{customer.name}</p>
                          <p className="text-white/40 text-xs">{customer.orders} pesanan</p>
                        </div>
                        <p className="text-emerald-400 font-bold">{formatCurrency(customer.totalSpent)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Top Products */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package size={20} className="text-orange-400" />
                  <h3 className="font-semibold text-white">Produk Terlaris</h3>
                </div>
                {stats.topProducts.length === 0 ? (
                  <p className="text-white/40 text-center py-8">Tiada data</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topProducts.map((product, idx) => (
                      <div key={product.name} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          idx === 0 ? 'bg-yellow-500 text-black' :
                          idx === 1 ? 'bg-slate-400 text-black' :
                          idx === 2 ? 'bg-orange-600 text-white' :
                          'bg-slate-700 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium">{product.name}</p>
                          <p className="text-white/40 text-xs">{product.quantity} unit terjual</p>
                        </div>
                        <p className="text-emerald-400 font-bold">{formatCurrency(product.revenue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-white/60">Tiada data statistik</div>
        )}
      </div>
    </div>
  );
}
