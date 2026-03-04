'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Customer {
  id: string;
  code: string;
  name: string;
  email: string;
}

interface InvoiceItem {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    po_number: '',
    notes: ''
  });
  const [items, setItems] = useState<InvoiceItem[]>([
    { productCode: '', productName: '', quantity: 1, unitPrice: 0, discountPercent: 0, discountAmount: 0, taxPercent: 0, taxAmount: 0 }
  ]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    const item = newItems[index];
    
    // @ts-ignore
    item[field] = value;

    // Auto calculate totals
    if (field === 'quantity' || field === 'unitPrice' || field === 'discountPercent' || field === 'taxPercent') {
      const qty = field === 'quantity' ? value : item.quantity;
      const price = field === 'unitPrice' ? value : item.unitPrice;
      const discountPct = field === 'discountPercent' ? value : item.discountPercent;
      const taxPct = field === 'taxPercent' ? value : item.taxPercent;

      const subtotal = qty * price;
      const discountAmt = subtotal * (discountPct / 100);
      const afterDiscount = subtotal - discountAmt;
      const taxAmt = afterDiscount * (taxPct / 100);

      item.discountAmount = discountAmt;
      item.taxAmount = taxAmt;
    }

    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productCode: '', productName: '', quantity: 1, unitPrice: 0, discountPercent: 0, discountAmount: 0, taxPercent: 0, taxAmount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
    const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
    return {
      subtotal,
      totalDiscount,
      totalTax,
      total: subtotal - totalDiscount + totalTax
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.customer_id) {
      setError('Please select a customer');
      return;
    }

    if (items.length === 0 || !items[0].productName) {
      setError('Please add at least one item to the invoice');
      return;
    }

    const { subtotal, totalTax } = calculateTotals();

    try {
      setLoading(true);
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: formData.customer_id,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          po_number: formData.po_number || null,
          items: items.map(item => ({
            product_code: item.productCode || null,
            product_name: item.productName,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            discount_percent: item.discountPercent,
            discount_amount: item.discountAmount,
            tax_percent: item.taxPercent,
            tax_amount: item.taxAmount
          })),
          notes: formData.notes || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create invoice');
      }

      const result = await response.json();
      alert(`Invoice created successfully!\nInvoice No: ${result.invoiceNo}`);
      router.push('/invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/invoices" className="text-blue-600 hover:text-blue-900 mb-4 inline-block">
            ← Back to Invoices
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Invoice</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invoice Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer *
                </label>
                <select
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Date *
                </label>
                <input
                  type="date"
                  name="invoice_date"
                  value={formData.invoice_date}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date *
                </label>
                <input
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PO Number
                </label>
                <input
                  type="text"
                  name="po_number"
                  value={formData.po_number}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleFormChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Invoice Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Invoice Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
              >
                + Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-900">Product Code</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-900">Product Name</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-900">Qty</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">Unit Price</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-900">Discount %</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-900">Tax %</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">Total</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, index) => {
                    const lineTotal = (item.quantity * item.unitPrice) - item.discountAmount + item.taxAmount;
                    return (
                      <tr key={index}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.productCode}
                            onChange={(e) => handleItemChange(index, 'productCode', e.target.value)}
                            placeholder="Code"
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                            placeholder="Product name"
                            required
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                            min="1"
                            className="w-full text-center px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value))}
                            placeholder="0.00"
                            step="0.01"
                            className="w-full text-right px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={item.discountPercent}
                            onChange={(e) => handleItemChange(index, 'discountPercent', parseFloat(e.target.value))}
                            placeholder="0"
                            step="0.01"
                            className="w-full text-center px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={item.taxPercent}
                            onChange={(e) => handleItemChange(index, 'taxPercent', parseFloat(e.target.value))}
                            placeholder="0"
                            step="0.01"
                            className="w-full text-center px-2 py-1 border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">
                          {formatCurrency(lineTotal)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            disabled={items.length === 1}
                            className="text-red-600 hover:text-red-900 disabled:text-gray-400"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-end w-full">
              <div className="w-96">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-semibold">{formatCurrency(totals.totalDiscount)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-semibold">{formatCurrency(totals.totalTax)}</span>
                </div>
                <div className="flex justify-between py-3 bg-blue-100 px-4 rounded font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Link
              href="/invoices"
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition font-medium"
            >
              {loading ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
