'use client';

import React, { useEffect, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { Settlement } from '@/types';

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
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDailyStats();
  }, [date]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return;
      const user = JSON.parse(raw);
      setCurrentUserId(user.id || '');
      setCurrentUserName(user.name || user.username || '');
    } catch (error) {
      console.error('Failed to read user profile:', error);
    }
  }, []);

  useEffect(() => {
    if (!currentUserId || !date) return;
    fetchSettlementHistory();
  }, [currentUserId, date]);

  const fetchSettlementHistory = async () => {
    try {
      const params = new URLSearchParams();
      params.set('date', date);
      params.set('userId', currentUserId);
      const response = await fetch(`/api/settlements?${params.toString()}`);
      if (!response.ok) return;
      const data = await response.json();
      setSettlements(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch settlement history:', error);
    }
  };

  const fetchDailyStats = async () => {
    setLoading(true);
    try {
      // Fetch today's sales
      const { data: todaySales, error } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`);

      if (error) throw error;

      // Fetch yesterday's sales for comparison
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const { data: yesterdaySales } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', `${yesterdayStr}T00:00:00`)
        .lte('created_at', `${yesterdayStr}T23:59:59`);

      // Calculate stats
      const sales = todaySales || [];
      const totalRevenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const uniqueCustomers = new Set(sales.map(s => s.customer_id)).size;

      // Calculate items sold
      let totalItems = 0;
      const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
      
      sales.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach((item: any) => {
            totalItems += item.quantity || 0;
            if (item.product_name) {
              if (!productMap[item.product_name]) {
                productMap[item.product_name] = { name: item.product_name, quantity: 0, revenue: 0 };
              }
              productMap[item.product_name].quantity += item.quantity || 0;
              productMap[item.product_name].revenue += item.subtotal || 0;
            }
          });
        }
      });

      // Top products
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Sales by hour
      const hourMap: Record<number, { count: number; revenue: number }> = {};
      sales.forEach(sale => {
        const hour = new Date(sale.created_at).getHours();
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
  };

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
  const totalSubmittedCash = settlements.reduce((sum, item) => sum + (item.totalCash || 0), 0);
  const totalSubmittedCredit = settlements.reduce((sum, item) => sum + (item.totalCredit || 0), 0);

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

            <Card className="p-6 border-cyan-500/20 bg-cyan-500/5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Daily End Report (Sales User)</h3>
                  <p className="text-sm text-white/60">
                    User: {currentUserName || 'N/A'} | Tarikh: {date}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => window.print()}>
                  Print / PDF
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg border border-white/10 bg-slate-900/50">
                  <p className="text-xs text-white/60">Rekod Expenses/Settlement</p>
                  <p className="text-xl font-bold text-white">{settlements.length}</p>
                </div>
                <div className="p-3 rounded-lg border border-white/10 bg-slate-900/50">
                  <p className="text-xs text-white/60">Cash Submitted</p>
                  <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalSubmittedCash)}</p>
                </div>
                <div className="p-3 rounded-lg border border-white/10 bg-slate-900/50">
                  <p className="text-xs text-white/60">Credit Submitted</p>
                  <p className="text-xl font-bold text-blue-400">{formatCurrency(totalSubmittedCredit)}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/80 border-b border-white/10">
                    <tr>
                      <th className="text-left px-3 py-2 text-white/70">Description</th>
                      <th className="text-left px-3 py-2 text-white/70">Status</th>
                      <th className="text-right px-3 py-2 text-white/70">Amount (RM)</th>
                      <th className="text-left px-3 py-2 text-white/70">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-white/50" colSpan={4}>
                          Tiada rekod settlement/expenses pada tarikh ini.
                        </td>
                      </tr>
                    ) : (
                      settlements.map((item) => (
                        <tr key={item.id} className="border-b border-white/5">
                          <td className="px-3 py-2 text-white">End day expenses submission</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300">
                              {item.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-white">
                            {formatCurrency((item.totalCash || 0) + (item.totalCredit || 0))}
                          </td>
                          <td className="px-3 py-2 text-white/70">
                            {new Date(item.submittedAt || item.date).toLocaleString('ms-MY')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
