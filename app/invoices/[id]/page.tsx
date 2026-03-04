'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface InvoiceItem {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  branch: string;
  customer: {
    id: string;
    code: string;
    name: string;
    address: string;
    city: string;
    state: string;
    postcode: string;
    phone: string;
    email: string;
  } | null;
  poNumber: string;
  salesPerson: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: string;
  amountPaid: number;
  balanceDue: number;
  notes: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/invoices/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch invoice');
      }

      const data = await response.json();
      setInvoice(data);
      setPaymentAmount(data.balanceDue.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    if (!invoice) return;

    try {
      setIsSubmittingPayment(true);
      const response = await fetch(`/api/invoices?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_paid: parseFloat(paymentAmount)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to record payment');
      }

      // Refresh invoice
      await fetchInvoice();
      setPaymentAmount('');
      alert('Payment recorded successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ms-MY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'PARTIAL':
        return 'bg-yellow-100 text-yellow-800';
      case 'UNPAID':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/invoices" className="text-blue-600 hover:text-blue-900 mb-6 inline-block">
            ← Back to Invoices
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
            {error || 'Invoice not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/invoices" className="text-blue-600 hover:text-blue-900">
            ← Back to Invoices
          </Link>
          <button
            onClick={() => window.print()}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition"
          >
            Print / PDF
          </button>
        </div>

        {/* Invoice Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-8 pb-8 border-b">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">INVOICE</h1>
              <p className="text-gray-600 mt-2">Invoice No: {invoice.invoiceNo}</p>
            </div>
            <div className="text-right">
              <span className={`inline-block px-4 py-2 rounded-lg font-semibold ${getStatusColor(invoice.paymentStatus)}`}>
                {invoice.paymentStatus}
              </span>
            </div>
          </div>

          {/* Company & Customer Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* From */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">FROM</h3>
              <p className="font-semibold text-gray-900">SAYS System</p>
              <p className="text-gray-600">{invoice.branch}</p>
            </div>

            {/* To */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">BILL TO</h3>
              {invoice.customer && (
                <>
                  <p className="font-semibold text-gray-900">{invoice.customer.name}</p>
                  <p className="text-gray-600">{invoice.customer.code}</p>
                  <p className="text-gray-600">{invoice.customer.address}</p>
                  <p className="text-gray-600">{invoice.customer.city}, {invoice.customer.state} {invoice.customer.postcode}</p>
                  <p className="text-gray-600 mt-2">{invoice.customer.phone}</p>
                </>
              )}
            </div>
          </div>

          {/* Invoice Meta */}
          <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Invoice Date</p>
              <p className="font-semibold text-gray-900">{formatDate(invoice.invoiceDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Due Date</p>
              <p className="font-semibold text-gray-900">{formatDate(invoice.dueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">PO Number</p>
              <p className="font-semibold text-gray-900">{invoice.poNumber || '-'}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2 px-4 font-semibold text-gray-900">Product</th>
                  <th className="text-center py-2 px-4 font-semibold text-gray-900">Qty</th>
                  <th className="text-right py-2 px-4 font-semibold text-gray-900">Unit Price</th>
                  <th className="text-right py-2 px-4 font-semibold text-gray-900">Discount</th>
                  <th className="text-right py-2 px-4 font-semibold text-gray-900">Tax</th>
                  <th className="text-right py-2 px-4 font-semibold text-gray-900">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-3 px-4 text-gray-900">{item.productName}</td>
                    <td className="py-3 px-4 text-center text-gray-900">{item.quantity}</td>
                    <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(item.discountAmount)}</td>
                    <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(item.taxAmount)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-80">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Discount</span>
                <span className="font-semibold">{formatCurrency(invoice.discount)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Tax</span>
                <span className="font-semibold">{formatCurrency(invoice.tax)}</span>
              </div>
              <div className="flex justify-between py-3 bg-gray-100 px-4 rounded font-semibold text-lg">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg mb-8">
            <div>
              <p className="text-sm text-gray-600">Amount Paid</p>
              <p className="font-semibold text-green-600 text-lg">{formatCurrency(invoice.amountPaid)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Balance Due</p>
              <p className="font-semibold text-red-600 text-lg">{formatCurrency(invoice.balanceDue)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-semibold text-gray-900 text-lg">{invoice.paymentStatus}</p>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-900 mb-2">Notes</p>
              <p className="text-gray-600">{invoice.notes}</p>
            </div>
          )}

          {/* Payment Form */}
          {invoice.balanceDue > 0 && (
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Payment</h3>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handlePayment}
                    disabled={isSubmittingPayment}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition font-medium"
                  >
                    {isSubmittingPayment ? 'Processing...' : 'Submit Payment'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
