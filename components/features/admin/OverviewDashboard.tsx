'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package } from 'lucide-react';
import MetricCard from '../../ui/MetricCard';
import { useToast } from '../../ui/Toast';

interface OverviewMetrics {
  totalSales: number;
  salesTrend: { direction: 'up' | 'down' | 'neutral'; percentage: number };
  totalOrders: number;
  totalCustomers: number;
  activeStaff: number;
  inventoryItems: number;
}

export default function OverviewSection() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true);

        const [salesRes, customersRes, usersRes, productsRes] = await Promise.all([
          fetch('/api/sales').then((r) => r.json()),
          fetch('/api/customers').then((r) => r.json()),
          fetch('/api/users').then((r) => r.json()),
          fetch('/api/products').then((r) => r.json()),
        ]);

        // salesRes is an array of transactions
        const totalSales = Array.isArray(salesRes)
          ? salesRes.reduce((sum: number, t: any) => sum + (parseFloat(t.total as any) || 0), 0)
          : 0;

        let salesTrend: { direction: 'up' | 'down' | 'neutral'; percentage: number } = { direction: 'neutral', percentage: 0 };

        const totalOrders = Array.isArray(salesRes) ? salesRes.length : 0;
        const totalCustomers = Array.isArray(customersRes) ? customersRes.length : 0;
        const activeStaff = Array.isArray(usersRes) ? usersRes.filter((u: any) => u.role === 'Sales').length : 0;
        const inventoryItems = Array.isArray(productsRes) ? productsRes.reduce((sum: number, p: any) => sum + (p.stock || 0), 0) : 0;

        // quick trend heuristic: compare last 7 vs previous 7 days
        if (Array.isArray(salesRes) && salesRes.length > 0) {
          const byDate = salesRes.map((s: any) => new Date(s.createdAt || s.created_at || Date.now()));
          const now = Date.now();
          const last7 = byDate.filter((d: Date) => now - d.getTime() <= 1000 * 60 * 60 * 24 * 7).length;
          const prev7 = byDate.filter((d: Date) => now - d.getTime() > 1000 * 60 * 60 * 24 * 7 && now - d.getTime() <= 1000 * 60 * 60 * 24 * 14).length;
          if (prev7 === 0 && last7 > 0) {
            salesTrend = { direction: 'up', percentage: 100 };
          } else if (prev7 === 0 && last7 === 0) {
            salesTrend = { direction: 'neutral', percentage: 0 };
          } else {
            const pct = ((last7 - prev7) / Math.max(1, prev7)) * 100;
            salesTrend = { direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral', percentage: Math.abs(parseFloat(pct.toFixed(1))) };
          }
        }

        setMetrics({
          totalSales,
          salesTrend,
          totalOrders,
          totalCustomers,
          activeStaff,
          inventoryItems,
        });
      } catch (error) {
        console.error(error);
        addToast('Failed to load metrics', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [addToast]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Sales Overview</h2>
        <p className="text-slate-400">Real-time performance metrics across all branches</p>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Total Sales"
          value={metrics?.totalSales.toLocaleString() || 0}
          unit="RM"
          icon={DollarSign}
          trend={metrics?.salesTrend}
          status={metrics?.salesTrend.direction === 'up' ? 'success' : 'warning'}
          isLoading={isLoading}
        />
        <MetricCard
          title="Total Orders"
          value={metrics?.totalOrders || 0}
          icon={ShoppingCart}
          trend={{ direction: 'up', percentage: 8.2 }}
          status="neutral"
          isLoading={isLoading}
        />
        <MetricCard
          title="Active Customers"
          value={metrics?.totalCustomers || 0}
          icon={Users}
          trend={{ direction: 'up', percentage: 5.1 }}
          status="neutral"
          isLoading={isLoading}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard
          title="Active Staff Members"
          value={metrics?.activeStaff || 0}
          icon={Users}
          status="neutral"
          isLoading={isLoading}
        />
        <MetricCard
          title="Inventory Items"
          value={metrics?.inventoryItems || 0}
          icon={Package}
          status="neutral"
          isLoading={isLoading}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-glass hover:border-slate-600 transition-all duration-300">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Today's Sales</span>
              <span className="text-green-400 font-semibold">RM 12,450</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Pending Orders</span>
              <span className="text-yellow-400 font-semibold">23</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Low Stock Items</span>
              <span className="text-red-400 font-semibold">5</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Commission Payable</span>
              <span className="text-blue-400 font-semibold">RM 4,270</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-glass hover:border-slate-600 transition-all duration-300">
          <h3 className="text-lg font-semibold text-white mb-4">Branch Performance</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Kota Kinabalu</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="w-3/4 h-full bg-gradient-accent" />
                </div>
                <span className="text-green-400 font-semibold text-xs">75%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Kinabatangan</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="w-1/2 h-full bg-blue-500" />
                </div>
                <span className="text-slate-400 font-semibold text-xs">50%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
