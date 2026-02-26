'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  ArrowLeft, 
  Calendar,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  Package,
  Users,
  Clock,
  Award
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SaleItem {
  name?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  subtotal?: number | null;
  price?: number | null;
}

interface SaleRecord {
  id: string;
  customer_id?: string | null;
  customer?: { id?: string | null };
  created_at?: string;
  createdAt?: string;
  total_amount?: number | null;
  total?: number | null;
  items?: SaleItem[] | null;
}

interface DailyStats {
  totalSales: number;
  totalRevenue: number;
  totalItems: number;
  uniqueCustomers: number;
  avgTransaction: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  salesByHour: { hour: number; count: number; revenue: number }[];
  comparisonYesterday: {
    salesDiff: number;
    revenueDiff: number;
  };
}

export default function DailyReportPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDailyStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sales');
      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to fetch sales data');
      }

      const allSales: SaleRecord[] = Array.isArray(payload) ? payload : [];
      const normalizedSales = allSales.map((sale) => ({
        ...sale,
        created_at: sale.created_at || sale.createdAt || '',
        total_amount: Number(sale.total_amount ?? sale.total ?? 0),
      }));

      // Build day boundaries
      const startOfDay = new Date(`${date}T00:00:00`).getTime();
      const endOfDay = new Date(`${date}T23:59:59`).getTime();

      // Filter today's sales
      const todaySales = normalizedSales.filter((sale) => {
        const createdMs = new Date(sale.created_at || '').getTime();
        return !Number.isNaN(createdMs) && createdMs >= startOfDay && createdMs <= endOfDay;
      });

      // Filter yesterday's sales for comparison
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const yesterdayStart = new Date(`${yesterdayStr}T00:00:00`).getTime();
      const yesterdayEnd = new Date(`${yesterdayStr}T23:59:59`).getTime();

      const yesterdaySales = normalizedSales.filter((sale) => {
        const createdMs = new Date(sale.created_at || '').getTime();
        return !Number.isNaN(createdMs) && createdMs >= yesterdayStart && createdMs <= yesterdayEnd;
      });

      // Calculate stats
      const sales = todaySales || [];
      const totalRevenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const uniqueCustomers = new Set(
        sales
          .map((sale) => sale.customer_id || sale.customer?.id)
          .filter(Boolean)
      ).size;

      // Calculate items sold
      let totalItems = 0;
      const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
      
      sales.forEach(sale => {
        sale.items?.forEach(item => {
          const quantity = item.quantity ?? 0;
          const revenue = item.subtotal ?? ((item.price ?? 0) * quantity);
          totalItems += quantity;
          const productName = item.product_name || item.name;
          if (productName) {
            if (!productMap[productName]) {
              productMap[productName] = { name: productName, quantity: 0, revenue: 0 };
            }
            productMap[productName].quantity += quantity;
            productMap[productName].revenue += revenue;
          }
        });
      });

      // Top products
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Sales by hour
      const hourMap: Record<number, { count: number; revenue: number }> = {};
      sales.forEach(sale => {
        const hour = new Date(sale.created_at || '').getHours();
        if (Number.isNaN(hour)) return;
        if (!hourMap[hour]) hourMap[hour] = { count: 0, revenue: 0 };
        hourMap[hour].count++;
        hourMap[hour].revenue += sale.total_amount || 0;
      });

      const salesByHour = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourMap[i]?.count || 0,
        revenue: hourMap[i]?.revenue || 0
      }));

      // Yesterday comparison
      const yesterdayTotal = (yesterdaySales || []).length;
      const yesterdayRevenue = (yesterdaySales || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);

      setStats({
        totalSales: sales.length,
        totalRevenue,
        totalItems,
        uniqueCustomers,
        avgTransaction: sales.length > 0 ? totalRevenue / sales.length : 0,
        topProducts,
        salesByHour,
        comparisonYesterday: {
          salesDiff: sales.length - yesterdayTotal,
          revenueDiff: totalRevenue - yesterdayRevenue
        }
      });
    } catch (err) {
      console.error('Error fetching daily stats:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchDailyStats();
  }, [fetchDailyStats]);

  const formatCurrency = (amount: number) => `RM ${amount.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}`;

  const getDiffIcon = (diff: number) => {
    if (diff > 0) return <TrendingUp size={16} className="text-emerald-400" />;
    if (diff < 0) return <TrendingDown size={16} className="text-red-400" />;
    return null;
  };

  const getDiffColor = (diff: number) => {
    if (diff > 0) return 'text-emerald-400';
    if (diff < 0) return 'text-red-400';
    return 'text-white/60';
  };

  // Get max revenue for chart scaling
  const maxHourRevenue = stats ? Math.max(...stats.salesByHour.map(h => h.revenue), 1) : 1;

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
              <h1 className="text-2xl font-bold text-white">Laporan Harian</h1>
              <p className="text-white/60">Ringkasan prestasi jualan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-white/60" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white/60">Memuatkan laporan...</div>
          </div>
        ) : stats ? (
          <>
            {/* Main Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Jumlah Jualan</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.totalSales}</p>
                    <div className={`flex items-center gap-1 mt-2 text-sm ${getDiffColor(stats.comparisonYesterday.salesDiff)}`}>
                      {getDiffIcon(stats.comparisonYesterday.salesDiff)}
                      <span>{Math.abs(stats.comparisonYesterday.salesDiff)} vs semalam</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/20">
                    <ShoppingCart size={24} className="text-blue-400" />
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Jumlah Hasil</p>
                    <p className="text-3xl font-bold text-white mt-1">{formatCurrency(stats.totalRevenue)}</p>
                    <div className={`flex items-center gap-1 mt-2 text-sm ${getDiffColor(stats.comparisonYesterday.revenueDiff)}`}>
                      {getDiffIcon(stats.comparisonYesterday.revenueDiff)}
                      <span>{formatCurrency(Math.abs(stats.comparisonYesterday.revenueDiff))}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/20">
                    <DollarSign size={24} className="text-emerald-400" />
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Item Terjual</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.totalItems}</p>
                    <p className="text-white/40 text-sm mt-2">unit produk</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/20">
                    <Package size={24} className="text-purple-400" />
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/60 text-sm">Pelanggan Unik</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.uniqueCustomers}</p>
                    <p className="text-white/40 text-sm mt-2">orang</p>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-500/20">
                    <Users size={24} className="text-orange-400" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hourly Sales Chart */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={20} className="text-blue-400" />
                  <h3 className="font-semibold text-white">Jualan Mengikut Jam</h3>
                </div>
                <div className="flex items-end gap-1 h-40">
                  {stats.salesByHour.map((hour) => (
                    <div key={hour.hour} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500/60 rounded-t hover:bg-blue-500 transition-colors cursor-pointer"
                        style={{
                          height: `${(hour.revenue / maxHourRevenue) * 100}%`,
                          minHeight: hour.revenue > 0 ? '4px' : '0'
                        }}
                        title={`${hour.hour}:00 - ${hour.count} jualan, ${formatCurrency(hour.revenue)}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-white/40">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </Card>

              {/* Top Products */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Award size={20} className="text-yellow-400" />
                  <h3 className="font-semibold text-white">Produk Terlaris</h3>
                </div>
                {stats.topProducts.length === 0 ? (
                  <p className="text-white/40 text-center py-8">Tiada data produk</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topProducts.map((product, idx) => (
                      <div key={product.name} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          idx === 0 ? 'bg-yellow-500 text-black' :
                          idx === 1 ? 'bg-slate-400 text-black' :
                          idx === 2 ? 'bg-orange-600 text-white' :
                          'bg-slate-700 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">{product.name}</p>
                          <p className="text-white/40 text-xs">{product.quantity} unit</p>
                        </div>
                        <p className="text-emerald-400 font-semibold">{formatCurrency(product.revenue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Summary Card */}
            <Card className="p-6 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-blue-500/20">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Ringkasan Hari Ini</h3>
                <p className="text-white/60 max-w-2xl mx-auto">
                  Anda telah membuat <span className="text-blue-400 font-bold">{stats.totalSales} jualan</span> dengan 
                  jumlah hasil <span className="text-emerald-400 font-bold">{formatCurrency(stats.totalRevenue)}</span>. 
                  Purata setiap transaksi adalah <span className="text-purple-400 font-bold">{formatCurrency(stats.avgTransaction)}</span>.
                </p>
              </div>
            </Card>
          </>
        ) : (
          <div className="text-center py-20 text-white/60">Tiada data untuk tarikh ini</div>
        )}
      </div>
    </div>
  );
}
