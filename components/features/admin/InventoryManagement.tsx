'use client';

import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, TrendingUp, TrendingDown, Search } from 'lucide-react';
import MetricCard from '../../ui/MetricCard';
import { useToast } from '../../ui/Toast';
import clsx from 'clsx';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  branch: string;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  trend?: { direction: 'up' | 'down'; percentage: number };
}

export default function InventoryManagement() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [totals, setTotals] = useState({ total: 0, lowStock: 0, outOfStock: 0 });
  const { addToast } = useToast();

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setIsLoading(true);
        const products = await fetch('/api/products').then((r) => r.json());

        const items: InventoryItem[] = Array.isArray(products)
          ? products.map((p: any) => {
              const quantity = typeof p.stock === 'number' ? p.stock : parseInt(p.stock || '0', 10) || 0;
              const minStock = typeof p.minStock === 'number' ? p.minStock : 20;
              let status: InventoryItem['status'] = 'in-stock';
              if (quantity === 0) status = 'out-of-stock';
              else if (quantity <= minStock) status = 'low-stock';

              return {
                id: p.id || `p_${Date.now()}`,
                name: p.name || 'Unnamed Product',
                sku: p.sku || p.id || 'SKU' + (p.id || Date.now()),
                quantity,
                minStock,
                maxStock: p.maxStock || Math.max(quantity * 2, 100),
                branch: p.branch || 'HQ',
                status,
                trend: p.trend || undefined,
              } as InventoryItem;
            })
          : [];

        setInventory(items);

        // Calculate totals
        setTotals({
          total: items.reduce((sum, item) => sum + item.quantity, 0),
          lowStock: items.filter((item) => item.status === 'low-stock').length,
          outOfStock: items.filter((item) => item.status === 'out-of-stock').length,
        });
      } catch (error) {
        console.error(error);
        addToast('Failed to load inventory', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, [addToast]);

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRestockAlert = (itemId: string) => {
    addToast('Restock request sent to supplier', 'success');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Inventory Management</h2>
        <p className="text-slate-400">Monitor stock levels across all branches</p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Items"
          value={totals.total.toLocaleString()}
          icon={Package}
          status="neutral"
          isLoading={isLoading}
        />
        <MetricCard
          title="Low Stock Items"
          value={totals.lowStock}
          icon={AlertTriangle}
          status="warning"
          isLoading={isLoading}
        />
        <MetricCard
          title="Out of Stock"
          value={totals.outOfStock}
          icon={AlertTriangle}
          status="danger"
          isLoading={isLoading}
        />
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={20} className="absolute left-3 top-3 text-slate-500" />
        <input
          type="text"
          placeholder="Search products by name or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-says-card border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-says-accent focus:outline-none transition-colors"
        />
      </div>

      {/* Inventory Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-glass">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading inventory...</div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No items found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Product Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">SKU</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Quantity</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Min</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Max</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Branch</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Trend</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-700/30 hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="px-6 py-4 text-white font-medium">{item.name}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{item.sku}</td>
                    <td className="px-6 py-4 text-white font-semibold">{item.quantity}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{item.minStock}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{item.maxStock}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{item.branch}</td>
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          item.status === 'in-stock'
                            ? 'bg-green-500/20 text-green-300'
                            : item.status === 'low-stock'
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'bg-red-500/20 text-red-300'
                        )}
                      >
                        {item.status === 'in-stock' ? 'In Stock' : item.status === 'low-stock' ? 'Low Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.trend && (
                        <div
                          className={clsx(
                            'flex items-center gap-1 text-sm font-medium',
                            item.trend.direction === 'up' ? 'text-green-400' : 'text-red-400'
                          )}
                        >
                          {item.trend.direction === 'up' ? (
                            <TrendingUp size={16} />
                          ) : (
                            <TrendingDown size={16} />
                          )}
                          {item.trend.percentage}%
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.status !== 'in-stock' && (
                        <button
                          onClick={() => handleRestockAlert(item.id)}
                          className="px-3 py-1 bg-says-accent/20 text-says-accent hover:bg-says-accent/30 rounded-lg text-sm font-medium transition-colors"
                        >
                          Restock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inventory Health Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-glass">
          <h3 className="text-lg font-semibold text-white mb-4">Stock Health</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">Healthy Stock Levels</span>
                <span className="text-sm font-semibold text-green-400">
                  {inventory.filter((i) => i.status === 'in-stock').length} items
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${
                      (inventory.filter((i) => i.status === 'in-stock').length / inventory.length) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">Low Stock Alert</span>
                <span className="text-sm font-semibold text-yellow-400">{totals.lowStock} items</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500"
                  style={{ width: `${(totals.lowStock / inventory.length) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">Out of Stock</span>
                <span className="text-sm font-semibold text-red-400">{totals.outOfStock} items</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${(totals.outOfStock / inventory.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-glass">
          <h3 className="text-lg font-semibold text-white mb-4">Branch Inventory</h3>
          <div className="space-y-3">
            {Array.from(new Set(inventory.map((i) => i.branch))).map((branch) => {
              const branchItems = inventory.filter((i) => i.branch === branch);
              const inStock = branchItems.filter((i) => i.status === 'in-stock').length;
              return (
                <div key={branch} className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">{branch}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm">
                      {inStock}/{branchItems.length}
                    </span>
                    <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-accent"
                        style={{ width: `${(inStock / branchItems.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
