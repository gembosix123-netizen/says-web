'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import MetricCard from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Store, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SalesDashboardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome, Salesman!</h1>
          <p className="text-white/60">Choose your activity for today</p>
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
