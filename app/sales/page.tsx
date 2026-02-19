'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Plus, 
  History, 
  FileText, 
  BarChart3, 
  ArrowLeft,
  ShoppingCart,
  DollarSign,
  Users,
  TrendingUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SalesHubPage() {
  const router = useRouter();
  const [todayStats, setTodayStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalCustomers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayStats();
  }, []);

  const fetchTodayStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      if (!error && sales) {
        setTodayStats({
          totalSales: sales.length,
          totalRevenue: sales.reduce((sum, s) => sum + (s.total_amount || 0), 0),
          totalCustomers: new Set(sales.map(s => s.customer_id)).size
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/sales-dashboard')}
            className="text-white/60 hover:text-white"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">Modul Jualan</h1>
            <p className="text-white/60">Urus semua aktiviti jualan anda</p>
          </div>
        </div>

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

        {/* Quick Action */}
        <Card className="p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/30">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">Mula Jualan Sekarang!</h3>
              <p className="text-white/60">Buat pesanan jualan baru dengan cepat</p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push('/sales/new')}
              className="whitespace-nowrap"
            >
              <Plus size={20} className="mr-2" />
              Jualan Baru
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
