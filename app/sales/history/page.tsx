'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  ArrowLeft, 
  Search, 
  Calendar,
  Eye,
  Download,
  Filter,
  ShoppingCart,
  DollarSign
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Sale {
  id: string;
  customer_id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  status: string;
  items: SaleItem[];
  created_at: string;
}

interface SaleItem {
  name?: string;
  product_name?: string;
  quantity?: number;
  subtotal?: number;
}

export default function SalesHistoryPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const fetchSales = useCallback(async () => {
    try {
      const response = await fetch('/api/sales');
      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(payload?.error || 'Gagal mendapatkan data jualan');
      }

      const salesData = Array.isArray(payload) ? payload : [];

      const formattedSales = salesData
        .map((sale) => {
          const createdAt = sale.created_at || sale.createdAt;
          const total = Number(sale.total_amount ?? sale.total ?? sale.payment?.amount ?? 0);
          const status = String(sale.status || 'completed').toLowerCase();

          return {
            id: sale.id,
            customer_id: sale.customer_id || sale.customer?.id || '',
            customer_name: sale.customer_name || sale.customer?.name || 'Pelanggan Tidak Diketahui',
            total_amount: Number.isFinite(total) ? total : 0,
            payment_method: sale.payment_method || sale.payment?.method || 'cash',
            status,
            items: Array.isArray(sale.items)
              ? sale.items.map((item: { name?: string; product_name?: string; quantity?: number | string; subtotal?: number | string }) => ({
                  name: item?.name || item?.product_name,
                  product_name: item?.product_name || item?.name,
                  quantity: Number(item?.quantity || 0),
                  subtotal: Number(item?.subtotal || 0),
                }))
              : [],
            created_at: createdAt || new Date().toISOString(),
          };
        })
        .filter((sale) => {
          const createdTime = new Date(sale.created_at).getTime();
          if (Number.isNaN(createdTime)) return false;

          const now = new Date();
          if (dateFilter === 'today') {
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            return createdTime >= startOfDay.getTime();
          }
          if (dateFilter === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return createdTime >= weekAgo.getTime();
          }
          if (dateFilter === 'month') {
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return createdTime >= monthAgo.getTime();
          }
          return true;
        });

      setSales(formattedSales);
    } catch (err) {
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const filteredSales = sales.filter(sale =>
    sale.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    sale.id.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return styles[status] || styles.pending;
  };

  const getPaymentLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Tunai',
      card: 'Kad',
      transfer: 'Transfer',
      bill_to_bill: 'Kredit (Bill-to-Bill)',
      bank_transfer: 'Pindahan Bank',
      qr_code: 'QR Code',
    };
    return labels[method] || method;
  };

  const handleExport = () => {
    if (filteredSales.length === 0) return;
    const headers = ['ID', 'Pelanggan', 'Jumlah (RM)', 'Kaedah Bayaran', 'Status', 'Tarikh'];
    const rows = filteredSales.map(sale => [
      sale.id,
      sale.customer_name,
      sale.total_amount.toFixed(2),
      getPaymentLabel(sale.payment_method),
      sale.status,
      formatDate(sale.created_at),
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sejarah-jualan-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ms-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
              <h1 className="text-2xl font-bold text-white">Sejarah Jualan</h1>
              <p className="text-white/60">Lihat semua transaksi jualan</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download size={16} className="mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <ShoppingCart size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Jumlah Transaksi</p>
                <p className="text-xl font-bold text-white">{filteredSales.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <DollarSign size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Jumlah Hasil</p>
                <p className="text-xl font-bold text-white">RM {totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Calendar size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Purata/Transaksi</p>
                <p className="text-xl font-bold text-white">
                  RM {filteredSales.length > 0 ? Math.round(totalRevenue / filteredSales.length).toLocaleString() : 0}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Filter size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Berjaya</p>
                <p className="text-xl font-bold text-white">
                  {filteredSales.filter(s => s.status === 'completed').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'today', 'week', 'month'].map((filter) => (
                <button
                  key={filter}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    dateFilter === filter
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-white/60 hover:text-white'
                  }`}
                  onClick={() => setDateFilter(filter)}
                >
                  {filter === 'all' && 'Semua'}
                  {filter === 'today' && 'Hari Ini'}
                  {filter === 'week' && 'Minggu Ini'}
                  {filter === 'month' && 'Bulan Ini'}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Sales Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-white/60">Memuatkan...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center text-white/60">Tiada transaksi dijumpai</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="text-left p-4 text-white/60 font-medium text-sm">ID</th>
                    <th className="text-left p-4 text-white/60 font-medium text-sm">Pelanggan</th>
                    <th className="text-left p-4 text-white/60 font-medium text-sm">Jumlah</th>
                    <th className="text-left p-4 text-white/60 font-medium text-sm">Bayaran</th>
                    <th className="text-left p-4 text-white/60 font-medium text-sm">Status</th>
                    <th className="text-left p-4 text-white/60 font-medium text-sm">Tarikh</th>
                    <th className="text-right p-4 text-white/60 font-medium text-sm">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4">
                        <span className="text-white/60 font-mono text-sm">
                          #{sale.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-white font-medium">{sale.customer_name}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-emerald-400 font-bold">
                          RM {sale.total_amount?.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-white/60">{getPaymentLabel(sale.payment_method)}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(sale.status)}`}>
                          {sale.status === 'completed' && 'Selesai'}
                          {sale.status === 'pending' && 'Menunggu'}
                          {sale.status === 'cancelled' && 'Dibatal'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-white/60 text-sm">{formatDate(sale.created_at)}</span>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSale(sale)}
                        >
                          <Eye size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Detail Modal */}
        {selectedSale && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Detail Transaksi</h3>
                  <p className="text-white/60 text-sm">#{selectedSale.id.slice(0, 8)}</p>
                </div>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="text-white/60 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/60 text-sm">Pelanggan</p>
                    <p className="text-white font-medium">{selectedSale.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm">Tarikh</p>
                    <p className="text-white font-medium">{formatDate(selectedSale.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm">Kaedah Bayaran</p>
                    <p className="text-white font-medium">{getPaymentLabel(selectedSale.payment_method)}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm">Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(selectedSale.status)}`}>
                      {selectedSale.status === 'completed' ? 'Selesai' : selectedSale.status}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-white/60 text-sm mb-2">Item</p>
                  <div className="bg-slate-800 rounded-lg p-3 space-y-2">
                    {selectedSale.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-white">{item.product_name || item.name || 'Item'} x{item.quantity || 0}</span>
                        <span className="text-white/60">RM {(item.subtotal || 0).toFixed(2)}</span>
                      </div>
                    )) || <p className="text-white/40">Tiada item</p>}
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-white">Jumlah:</span>
                    <span className="text-emerald-400">RM {selectedSale.total_amount?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                className="w-full mt-4"
                onClick={() => setSelectedSale(null)}
              >
                Tutup
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
