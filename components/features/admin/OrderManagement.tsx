'use client';
import { useState, useEffect } from 'react';
import { ShoppingCart, Search, FileText } from 'lucide-react';

interface Order {
  id: string;
  customerId: string;
  items: { id: string; quantity: number; price: number }[];
  total: number;
  status: string;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Product {
    id: string;
    name: string;
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [orderRes, custRes, prodRes] = await Promise.all([
                fetch('/api/sales'),
                fetch('/api/customers'),
                fetch('/api/products')
            ]);
            setOrders(await orderRes.json());
            setCustomers(await custRes.json());
            setProducts(await prodRes.json());
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch data', error);
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Unknown Shop';
  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;

  const filteredOrders = orders.filter(o => 
      getCustomerName(o.customerId).toLowerCase().includes(filter.toLowerCase()) ||
      o.id.includes(filter)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingCart className="text-orange-500" /> Sales Orders
            </h2>
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Search orders..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-white text-sm"
                />
            </div>
        </div>

        {loading ? (
            <div className="text-center text-slate-500 py-10">Loading orders...</div>
        ) : (
            <div className="space-y-4">
                {filteredOrders.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">No orders found</div>
                ) : (
                    filteredOrders.map(order => (
                        <div key={order.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/60 transition-all">
                            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white">{getCustomerName(order.customerId)}</h3>
                                    <p className="text-slate-400 text-xs">
                                        {new Date(order.createdAt).toLocaleString()}
                                    </p>
                                    <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold ${
                                        order.status === 'Completed' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                                    }`}>
                                        {order.status}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-white">RM {order.total.toFixed(2)}</p>
                                    <p className="text-xs text-slate-500 font-mono">ID: {order.id.slice(0,8)}</p>
                                </div>
                            </div>

                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                                <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 uppercase font-bold mb-2 border-b border-slate-800 pb-2">
                                    <span>Item</span>
                                    <span className="text-center">Qty</span>
                                    <span className="text-right">Total</span>
                                </div>
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-3 gap-2 text-sm py-1">
                                        <span className="text-slate-300 truncate">{getProductName(item.id)}</span>
                                        <span className="text-slate-400 text-center">x{item.quantity}</span>
                                        <span className="text-slate-400 text-right">RM {(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="mt-4 flex justify-end">
                                <button className="flex items-center gap-2 text-blue-400 hover:text-white text-sm font-medium transition-colors">
                                    <FileText size={16} /> Print Invoice
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
      </div>
    </div>
  );
}
