import React, { useState } from 'react';
import { Transaction, Customer, OrderStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { Search, Edit, MapPin, Printer } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderManagementProps {
  transactions: Transaction[];
  customers: Customer[];
  onUpdateStatus: (id: string, status: OrderStatus, assignedShopId?: string) => Promise<void>;
}

const statusColors: Record<OrderStatus, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  Processing: 'bg-purple-100 text-purple-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
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
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800">{t('order_management')}</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder={t('search_orders')}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold text-slate-600">ID</th>
              <th className="p-4 font-semibold text-slate-600">{t('date')}</th>
              <th className="p-4 font-semibold text-slate-600">{t('customer_label')}</th>
              <th className="p-4 font-semibold text-slate-600">{t('total')}</th>
              <th className="p-4 font-semibold text-slate-600">{t('status')}</th>
              <th className="p-4 font-semibold text-slate-600">{t('assigned_shop')}</th>
              <th className="p-4 font-semibold text-slate-600 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((trans) => (
              <tr key={trans.id} className="hover:bg-slate-50">
                <td className="p-4 font-mono text-sm text-slate-500 flex flex-col">
                  <span>{trans.id.slice(-6)}</span>
                  {trans.gps && (
                     <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${trans.gps.lat},${trans.gps.lon}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-blue-600 hover:underline text-xs flex items-center gap-1 mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin size={12} /> {t('view_location')}
                    </a>
                  )}
                </td>
                <td className="p-4 text-sm text-slate-600">
                  {new Date(trans.createdAt || trans.checkInTime || Date.now()).toLocaleDateString()}
                </td>
                <td className="p-4 font-medium text-slate-900">{trans.customer?.name}</td>
                <td className="p-4 font-bold text-slate-700">{formatCurrency(trans.total)}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[trans.status || 'Pending']}`}>
                    {trans.status || 'Pending'}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-600">
                    {customers.find(c => c.id === (trans.assignedShopId || trans.customer?.id))?.name || '-'}
                </td>
                <td className="p-4 text-right">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(trans)}>
                    <Edit size={16} className="mr-1" /> {t('manage')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500">{t('no_orders')}</div>
        )}
      </div>

      {editingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-slate-900">{t('update_status')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('status')}</label>
                <select 
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value as OrderStatus)}
                >
                    {Object.keys(statusColors).map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('assign_shop')}</label>
                <select 
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
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
                        className="w-full flex items-center justify-center gap-2"
                        onClick={() => generateInvoice(currentTransaction)}
                      >
                          <Printer size={18} /> {t('print_invoice')}
                      </Button>
                  </div>
              )}

            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditingId(null)}>{t('cancel_button')}</Button>
              <Button onClick={handleSave}>{t('save_changes')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
