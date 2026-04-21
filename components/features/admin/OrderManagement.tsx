'use client';
import { useState, useEffect } from 'react';
import { ShoppingCart, Search, FileText, Package } from 'lucide-react';
import ExchangeReturnModal from './ExchangeReturnModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Order {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customerId?: string; // Legacy support
  items: { id: string; product_id?: string; name?: string; product_name?: string; quantity: number; price: number; unit_price?: number }[];
  total: number;
  status: string;
  createdAt: string;
  created_at?: string;
  invoice?: string;
  payment_method?: string;
  salesmanName?: string;
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
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const handlePrintInvoice = (order: Order) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(12, 10, pageWidth - 24, 30, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('HAJA YANONGS INDUSTRIES', 16, 22);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('Dokumen Jualan Rasmi', 16, 28);

    const statusLabel = order.status === 'pending' ? 'INVOIS KREDIT' : 'INVOIS';
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabel, pageWidth - 14, 22, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`No. Invois: ${order.invoice || order.id.slice(0, 12)}`, pageWidth - 14, 28, { align: 'right' });
    doc.text(`Tarikh: ${new Date(order.createdAt || order.created_at || '').toLocaleDateString('ms-MY')}`, pageWidth - 14, 33, { align: 'right' });

    // Customer + Salesman info
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('BIL KEPADA', 14, 50);
    doc.setFont('helvetica', 'normal');
    const customerName = order.customer_name || 'Unknown Shop';
    doc.text(customerName, 14, 56);

    if (order.salesmanName) {
      doc.text(`Jualan oleh: ${order.salesmanName}`, pageWidth - 14, 56, { align: 'right' });
    }

    const paymentMethodLabels: Record<string, string> = {
      cash: 'Tunai', bill_to_bill: 'Kredit (Bill-to-Bill)',
      bank_transfer: 'Pindahan Bank', qr_code: 'QR Code', card: 'Kad',
    };
    const paymentLabel = paymentMethodLabels[order.payment_method || ''] || (order.payment_method || '-');
    doc.text(`Kaedah Bayaran: ${paymentLabel}`, pageWidth - 14, 62, { align: 'right' });

    // Items table
    const itemRows = (order.items || []).map((item) => {
      const name = item.name || item.product_name || item.id;
      const qty = item.quantity || 0;
      const unitPrice = item.price || item.unit_price || 0;
      const subtotal = qty * unitPrice;
      return [name, qty, `RM ${unitPrice.toFixed(2)}`, `RM ${subtotal.toFixed(2)}`];
    });

    if (itemRows.length === 0) {
      itemRows.push(['(Tiada item / Bayaran Hutang)', '-', '-', `RM ${Number(order.total || 0).toFixed(2)}`]);
    }

    autoTable(doc, {
      startY: 68,
      head: [['Produk', 'Qty', 'Harga Unit', 'Jumlah']],
      body: itemRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 },
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 100;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`JUMLAH: RM ${Number(order.total || 0).toFixed(2)}`, pageWidth - 14, finalY + 10, { align: 'right' });

    if (order.status === 'pending') {
      doc.setTextColor(180, 0, 0);
      doc.setFontSize(9);
      doc.text('* Belum Dibayar — Kredit Belum Diselesaikan', 14, finalY + 10);
    }

    const filename = `invois_${(order.invoice || order.id).replace(/[^A-Z0-9\-]/gi, '_')}.pdf`;
    doc.save(filename);
  };

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [orderRes, custRes, prodRes] = await Promise.all([
                fetch('/api/sales'),
                fetch('/api/customers'),
                fetch('/api/products')
            ]);
            const ordersData = await orderRes.json().catch(() => []);
            const customersData = await custRes.json().catch(() => []);
            const productsData = await prodRes.json().catch(() => []);
            setOrders(Array.isArray(ordersData) ? ordersData : []);
            setCustomers(Array.isArray(customersData) ? customersData : []);
            setProducts(Array.isArray(productsData) ? productsData : []);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch data', error);
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  const getCustomerName = (order: Order) => {
    // Use customer_name from API if available
    if (order.customer_name) return order.customer_name;
    // Fallback to lookup if we have customerId
    const customerId = order.customer_id || order.customerId;
    if (customerId) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) return customer.name;
    }
    return 'Unknown Shop';
  };
  
  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;

  const filteredOrders = orders.filter(o => {
    const customerName = getCustomerName(o);
    return customerName.toLowerCase().includes(filter.toLowerCase()) || o.id.includes(filter);
  });

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
                                    <h3 className="text-lg font-bold text-white">{getCustomerName(order)}</h3>
                                    <p className="text-slate-400 text-xs">
                                        {new Date(order.createdAt || order.created_at || '').toLocaleString()}
                                    </p>
                                    <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold ${
                                        order.status === 'Completed' || order.status === 'completed' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                                    }`}>
                                        {order.status}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-white">RM {order.total.toFixed(2)}</p>
                                    <p className="text-xs text-slate-500 font-mono">
                                        {order.invoice ? `INV: ${order.invoice.slice(-8)}` : `ID: ${order.id.slice(0,8)}`}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                                <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 uppercase font-bold mb-2 border-b border-slate-800 pb-2">
                                    <span>Item</span>
                                    <span className="text-center">Qty</span>
                                    <span className="text-right">Total</span>
                                </div>
                                {(order.items || []).map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-3 gap-2 text-sm py-1">
                                        <span className="text-slate-300 truncate">
                                            {item.name || item.product_name || getProductName(item.id ?? item.product_id ?? '')}
                                        </span>
                                        <span className="text-slate-400 text-center">x{item.quantity}</span>
                                        <span className="text-slate-400 text-right">
                                            RM {((item.price || item.unit_price || 0) * item.quantity).toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="mt-4 flex justify-end gap-3">
                                <button 
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setExchangeModalOpen(true);
                                  }}
                                  className="flex items-center gap-2 text-orange-400 hover:text-white text-sm font-medium transition-colors"
                                >
                                    <Package size={16} /> Return/Exchange
                                </button>
                                <button
                                  onClick={() => handlePrintInvoice(order)}
                                  className="flex items-center gap-2 text-blue-400 hover:text-white text-sm font-medium transition-colors"
                                >
                                    <FileText size={16} /> Print Invoice
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
        
        {/* Exchange/Return Modal */}
        {selectedOrder && (
          <ExchangeReturnModal 
            isOpen={exchangeModalOpen}
            onClose={() => {
              setExchangeModalOpen(false);
              setSelectedOrder(null);
            }}
            onSuccess={() => {
              // Optionally refresh orders
              setExchangeModalOpen(false);
              setSelectedOrder(null);
            }}
            saleData={{
              id: selectedOrder.id,
              invoice: selectedOrder.invoice,
              items: selectedOrder.items.map(item => ({
                id: item.id,
                name: item.name || item.product_name,
                product_name: item.product_name,
                quantity: item.quantity
              }))
            }}
          />
        )}
      </div>
    </div>
  );
}
