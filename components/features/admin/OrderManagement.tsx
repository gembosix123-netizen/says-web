import React, { useState } from 'react';
import { Transaction, Customer, OrderStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { Search, Edit, MapPin, Printer, Filter } from '@/components/Icons';
import { useLanguage } from '@/context/LanguageContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderManagementProps {
  transactions: Transaction[];
  customers: Customer[];
  onUpdateStatus: (id: string, status: OrderStatus, assignedShopId?: string) => Promise<void>;
}

const statusColors: Record<OrderStatus, string> = {
  Pending: 'bg-yellow-900/30 text-yellow-500 border-yellow-500/30',
  Confirmed: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
  Processing: 'bg-purple-900/30 text-purple-400 border-purple-500/30',
  Completed: 'bg-green-900/30 text-green-400 border-green-500/30',
  Cancelled: 'bg-red-900/30 text-red-400 border-red-500/30',
};

export default function OrderManagement({ transactions, customers, onUpdateStatus }: OrderManagementProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempStatus, setTempStatus] = useState<OrderStatus>('Pending');
  const [tempAssignedShop, setTempAssignedShop] = useState<string>('');

  const filtered = transactions.filter(trans => 
    trans.id.includes(search) || 
    trans.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
    trans.status?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (trans: Transaction) => {
    setEditingId(trans.id);
    setTempStatus(trans.status || 'Pending');
    setTempAssignedShop(trans.assignedShopId || trans.customer?.id || '');
  };

  const handleSave = async () => {
    if (editingId) {
      await onUpdateStatus(editingId, tempStatus, tempAssignedShop);
      setEditingId(null);
    }
  };

  const generateInvoice = (trans: Transaction) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.text(t('brand_client'), 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Your Business Address Here', 14, 28);
    
    // Invoice details
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.text(t('invoice_no') + `: ${trans.id.slice(-6).toUpperCase()}`, 140, 20);
    doc.setFontSize(10);
    doc.text(t('invoice_date') + `: ${new Date(trans.createdAt || Date.now()).toLocaleDateString()}`, 140, 28);
    doc.text(t('sales_person') + `: ${trans.salesmanId || 'Default Sales'}`, 140, 34);

    // Bill To
    doc.text(t('bill_to') + ':', 14, 45);
    doc.setFontSize(12);
    doc.text(trans.customer?.name || 'Customer', 14, 52);
    doc.setFontSize(10);
    doc.text(trans.customer?.address || '', 14, 58);

    // Table
    const tableColumn = ["Item", "Unit", "Price", "Qty", "Total"];
    const tableRows = trans.items.map(item => [
      item.name,
      item.unit,
      formatCurrency(item.price),
      item.quantity,
      formatCurrency(item.price * item.quantity)
    ]);

    autoTable(doc, {
      startY: 70,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }, // slate-900
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY || 70;
    doc.setFontSize(14);
    doc.text(`${t('total')}: ${formatCurrency(trans.total)}`, 140, finalY + 15);

    doc.save(`Invoice_${trans.id.slice(-6)}.pdf`);
  };

  const currentTransaction = transactions.find(t => t.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-800 shadow-xl">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Filter size={20} className="text-slate-400" />
            {t('order_management')}
        </h2>
        <div className="relative w-full md:w-64 group">
          <Search className="absolute left-3 top-3 text-slate-500 group-focus-within:text-red-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder={t('search_orders')}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-900/50 focus:border-red-900/50 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-slate-950/50 border-b border-slate-800">
                <tr>
                <th className="p-4 font-semibold text-slate-400 text-xs uppercase tracking-wider">ID</th>
                <th className="p-4 font-semibold text-slate-400 text-xs uppercase tracking-wider">{t('date')}</th>
                <th className="p-4 font-semibold text-slate-400 text-xs uppercase tracking-wider">{t('customer_label')}</th>
                <th className="p-4 font-semibold text-slate-400 text-xs uppercase tracking-wider">{t('total')}</th>
                <th className="p-4 font-semibold text-slate-400 text-xs uppercase tracking-wider">{t('status')}</th>
                <th className="p-4 font-semibold text-slate-400 text-xs uppercase tracking-wider">{t('assigned_shop')}</th>
                <th className="p-4 font-semibold text-slate-400 text-xs uppercase tracking-wider text-right">{t('actions')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {filtered.map((trans) => (
                <tr key={trans.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="p-4 font-mono text-sm text-slate-500 flex flex-col">
                    <span className="text-slate-300 group-hover:text-white transition-colors">#{trans.id.slice(-6)}</span>
                    {trans.gps && (
                        <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${trans.gps.lat},${trans.gps.lon}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-blue-500/70 hover:text-blue-400 hover:underline text-xs flex items-center gap-1 mt-1"
                        onClick={(e) => e.stopPropagation()}
                        >
                        <MapPin size={12} /> {t('view_location')}
                        </a>
                    )}
                    </td>
                    <td className="p-4 text-sm text-slate-400">
                    {new Date(trans.createdAt || trans.checkInTime || Date.now()).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-medium text-slate-200">{trans.customer?.name}</td>
                    <td className="p-4 font-bold text-slate-200">{formatCurrency(trans.total)}</td>
                    <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusColors[trans.status || 'Pending']}`}>
                        {trans.status || 'Pending'}
                    </span>
                    </td>
                    <td className="p-4 text-sm text-slate-400">
                        {customers.find(c => c.id === (trans.assignedShopId || trans.customer?.id))?.name || '-'}
                    </td>
                    <td className="p-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(trans)} className="border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white">
                        <Edit size={16} className="mr-1" /> {t('manage')}
                    </Button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-600 italic">{t('no_orders')}</div>
        )}
      </div>

      {editingId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-6 text-white">{t('update_status')}</h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{t('status')}</label>
                <select 
                    className="w-full p-3 border border-slate-700 rounded-xl text-slate-200 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-red-900/50"
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value as OrderStatus)}
                >
                    {Object.keys(statusColors).map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{t('assign_shop')}</label>
                <select 
                    className="w-full p-3 border border-slate-700 rounded-xl text-slate-200 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-red-900/50"
                    value={tempAssignedShop}
                    onChange={(e) => setTempAssignedShop(e.target.value)}
                >
                    <option value="">{t('select_shop')}</option>
                    {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              {/* Invoice Button */}
              {currentTransaction && (
                  <div className="pt-2">
                      <Button 
                        variant="secondary" 
                        className="w-full flex items-center justify-center gap-2 py-6 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        onClick={() => generateInvoice(currentTransaction)}
                      >
                          <Printer size={18} /> {t('print_invoice')}
                      </Button>
                  </div>
              )}

            </div>

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-800">
              <Button variant="outline" onClick={() => setEditingId(null)} className="border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white">{t('cancel_button')}</Button>
              <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg shadow-red-900/20">{t('save_changes')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
