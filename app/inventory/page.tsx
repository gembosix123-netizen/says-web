'use client';

import SalesLayout from '@/components/layouts/SalesLayout';
import { Package, Search, AlertTriangle, CheckCircle, TrendingDown, ArrowUpDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Product } from '@/types';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name');
  const [filterLowStock, setFilterLowStock] = useState(false);

  const toSafeNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch('/api/inventory/van');
        const data = await response.json();

        const rawProducts = Array.isArray(data?.products) ? data.products : [];
        const normalizedProducts: Product[] = rawProducts.map((item: any) => ({
          id: String(item?.id || ''),
          name: String(item?.name || 'Unnamed Product'),
          unit: String(item?.unit || 'unit'),
          price: toSafeNumber(item?.price),
          stock: toSafeNumber(item?.stock),
        }));

        setProducts(normalizedProducts);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // Filter and sort products
  const filteredProducts = products
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesLowStock = filterLowStock ? p.stock <= 10 : true;
      return matchesSearch && matchesLowStock;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'stock') return a.stock - b.stock;
      if (sortBy === 'price') return a.price - b.price;
      return 0;
    });

  // Calculate stats
  const totalItems = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockItems = products.filter(p => p.stock > 0 && p.stock <= 10).length;
  const outOfStockItems = products.filter(p => p.stock === 0).length;
  const healthyItems = products.filter(p => p.stock > 10).length;

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Out of Stock', icon: AlertTriangle };
    if (stock <= 10) return { color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', label: 'Low Stock', icon: TrendingDown };
    return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'In Stock', icon: CheckCircle };
  };

  return (
    <SalesLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Inventory</h1>
            <p className="text-slate-400">View stock levels and product availability.</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Package size={20} className="text-blue-400" />
              </div>
            </div>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Total Items</p>
            <p className="text-2xl font-bold text-white">{totalItems.toLocaleString()}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CheckCircle size={20} className="text-emerald-400" />
              </div>
            </div>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Healthy Stock</p>
            <p className="text-2xl font-bold text-emerald-400">{healthyItems}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <TrendingDown size={20} className="text-yellow-400" />
              </div>
            </div>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Low Stock</p>
            <p className="text-2xl font-bold text-yellow-400">{lowStockItems}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
            </div>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Out of Stock</p>
            <p className="text-2xl font-bold text-red-400">{outOfStockItems}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <button
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`px-4 py-3 rounded-xl border font-medium transition-all ${
              filterLowStock
                ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            <TrendingDown size={18} className="inline mr-2" />
            Low Stock Only
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'stock' | 'price')}
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
          >
            <option value="name">Sort by Name</option>
            <option value="stock">Sort by Stock</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>

        {/* Product List */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading inventory...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No van inventory assigned</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-slate-300 font-medium border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Unit</th>
                    <th className="px-6 py-4">
                      <button onClick={() => setSortBy('price')} className="flex items-center gap-1 hover:text-white">
                        Price <ArrowUpDown size={14} />
                      </button>
                    </th>
                    <th className="px-6 py-4">
                      <button onClick={() => setSortBy('stock')} className="flex items-center gap-1 hover:text-white">
                        Stock <ArrowUpDown size={14} />
                      </button>
                    </th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product.stock);
                    const StatusIcon = status.icon;
                    return (
                      <tr key={product.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-white">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.id}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-400">{product.unit}</td>
                        <td className="px-6 py-4 text-white font-medium">
                          RM {product.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-lg font-bold ${product.stock === 0 ? 'text-red-400' : product.stock <= 10 ? 'text-yellow-400' : 'text-white'}`}>
                            {product.stock}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${status.color}`}>
                            <StatusIcon size={14} />
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SalesLayout>
  );
}
