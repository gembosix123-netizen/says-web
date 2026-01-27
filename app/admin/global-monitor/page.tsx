import { db } from '@/lib/db';
import { Transaction, User, Customer } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Globe, TrendingUp, Users, ShoppingBag } from 'lucide-react';

import UserManagement from '@/components/features/admin/UserManagement';

export const dynamic = 'force-dynamic';

export default async function GlobalMonitorPage() {
  const transactions = (await db.transactions.getAll()) as Transaction[];
  const users = (await db.users.getAll()) as User[];
  const customers = (await db.customers.getAll()) as Customer[];

  const kkTransactions = transactions.filter(t => t.branch === 'Kota Kinabalu');
  const kbTransactions = transactions.filter(t => t.branch === 'Kinabatangan');

  const kkRevenue = kkTransactions.reduce((acc, t) => acc + t.total, 0);
  const kbRevenue = kbTransactions.reduce((acc, t) => acc + t.total, 0);

  const kkOrders = kkTransactions.length;
  const kbOrders = kbTransactions.length;

  const kkAgents = new Set(kkTransactions.map(t => t.salesmanId)).size;
  const kbAgents = new Set(kbTransactions.map(t => t.salesmanId)).size;

  const totalRevenue = kkRevenue + kbRevenue;
  const kkPercentage = totalRevenue > 0 ? (kkRevenue / totalRevenue) * 100 : 0;
  const kbPercentage = totalRevenue > 0 ? (kbRevenue / totalRevenue) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Globe className="text-blue-400" size={32} />
            Global Monitor (Super Admin)
        </h1>
        <p className="text-slate-400">Comparative performance analysis: Kota Kinabalu vs Kinabatangan</p>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Kota Kinabalu Card */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-blue-900/30 p-8 rounded-3xl relative overflow-hidden group hover:border-blue-500/50 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp size={120} className="text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold text-blue-400 mb-6 flex items-center gap-2">
                  <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                  Kota Kinabalu
              </h2>
              
              <div className="space-y-6 relative z-10">
                  <div>
                      <p className="text-slate-400 text-sm uppercase tracking-wider mb-1">Total Revenue</p>
                      <p className="text-5xl font-bold text-white tracking-tight">{formatCurrency(kkRevenue)}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                      <div>
                          <p className="text-slate-500 text-xs mb-1">Total Orders</p>
                          <p className="text-xl font-bold text-white flex items-center gap-2">
                              <ShoppingBag size={16} className="text-blue-500" /> {kkOrders}
                          </p>
                      </div>
                      <div>
                          <p className="text-slate-500 text-xs mb-1">Active Agents</p>
                          <p className="text-xl font-bold text-white flex items-center gap-2">
                              <Users size={16} className="text-blue-500" /> {kkAgents}
                          </p>
                      </div>
                  </div>
              </div>
          </div>

          {/* Kinabatangan Card */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-emerald-900/30 p-8 rounded-3xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp size={120} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-emerald-400 mb-6 flex items-center gap-2">
                  <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
                  Kinabatangan
              </h2>
              
              <div className="space-y-6 relative z-10">
                  <div>
                      <p className="text-slate-400 text-sm uppercase tracking-wider mb-1">Total Revenue</p>
                      <p className="text-5xl font-bold text-white tracking-tight">{formatCurrency(kbRevenue)}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                      <div>
                          <p className="text-slate-500 text-xs mb-1">Total Orders</p>
                          <p className="text-xl font-bold text-white flex items-center gap-2">
                              <ShoppingBag size={16} className="text-emerald-500" /> {kbOrders}
                          </p>
                      </div>
                      <div>
                          <p className="text-slate-500 text-xs mb-1">Active Agents</p>
                          <p className="text-xl font-bold text-white flex items-center gap-2">
                              <Users size={16} className="text-emerald-500" /> {kbAgents}
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Comparison Bar */}
      <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
          <h3 className="text-lg font-bold text-white mb-6">Revenue Distribution</h3>
          <div className="h-12 w-full bg-slate-800 rounded-full overflow-hidden flex relative">
              <div 
                  className="h-full bg-gradient-to-r from-blue-900 to-blue-500 flex items-center justify-center text-white font-bold text-sm transition-all duration-1000"
                  style={{ width: `${kkPercentage}%` }}
              >
                  {kkPercentage.toFixed(1)}%
              </div>
              <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-900 flex items-center justify-center text-white font-bold text-sm transition-all duration-1000"
                  style={{ width: `${kbPercentage}%` }}
              >
                  {kbPercentage.toFixed(1)}%
              </div>
          </div>
          <div className="flex justify-between mt-3 text-sm font-medium">
              <span className="text-blue-400">Kota Kinabalu</span>
              <span className="text-emerald-400">Kinabatangan</span>
          </div>
      </div>
      {/* Centralized User Management */}
      <UserManagement enableCreation={true} />
    </div>
  );
}
