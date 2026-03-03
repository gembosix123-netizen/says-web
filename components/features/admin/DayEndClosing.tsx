'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Lock, Download, CheckCircle, Users, DollarSign, ShoppingCart, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesmanPerformanceEntry {
  name: string;
  transactions: number;
  revenue: number;
  commission: number;
}

interface HourlyBreakdownEntry {
  hour: string;
  transactions: number;
  revenue: number;
}

interface DayEndSummary {
  date: string;
  branch: string;
  totalTransactions: number;
  totalRevenue: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    transfer: number;
    other: number;
  };
  salesmanPerformance: Record<string, SalesmanPerformanceEntry>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  hourlyBreakdown: HourlyBreakdownEntry[];
}

interface DayEndCloseRecord {
  closedBy?: string;
  closedAt?: string;
  closed_by?: string;
  closed_at?: string;
}

export default function DayEndClosing() {
  const { addToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [userBranch, setUserBranch] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('Admin');
  const [summary, setSummary] = useState<DayEndSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [closeRecord, setCloseRecord] = useState<DayEndCloseRecord | null>(null);

  // Reconciliation form state
  const [cashCount, setCashCount] = useState(0);
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [closeReferenceNo, setCloseReferenceNo] = useState('');

  const toSafeNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const toSafeText = (value: unknown, fallback = '') => {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  };

  // Get user info
  useEffect(() => {
    let mounted = true;

    const setFromLocalStorage = () => {
      const user = localStorage.getItem('user');
      if (!user || !mounted) return;

      try {
        const userData = JSON.parse(user);
        setUserBranch(toSafeText(userData.branch, ''));
        setUserRole(toSafeText(userData.role, ''));
        setUserName(toSafeText(userData.name, toSafeText(userData.username, 'Admin')));
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    };

    const loadUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const payload = await response.json().catch(() => null);

        if (mounted && response.ok && payload) {
          setUserBranch(toSafeText(payload.branch, ''));
          setUserRole(toSafeText(payload.role, ''));
          setUserName(toSafeText(payload.name, toSafeText(payload.username, 'Admin')));
          return;
        }
      } catch (e) {
        console.error('Failed to fetch authenticated user:', e);
      }

      setFromLocalStorage();
    };

    loadUserInfo();

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch day end summary
  const fetchDayEndSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/day-end/calculate?date=${selectedDate}&branch=${userBranch}`);
      if (!res.ok) {
        const error = await res.json();
        addToast(error.error || 'Failed to fetch data', 'error');
        return;
      }
      const data: DayEndSummary = await res.json();
      setSummary(data);
      setCashCount(toSafeNumber(data.paymentBreakdown.cash)); // Pre-fill with system amount
    } catch (error) {
      console.error('Error fetching day end:', error);
      addToast('Failed to fetch day end summary', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, selectedDate, userBranch]);

  const fetchCloseStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/day-end/close?date=${selectedDate}&branch=${userBranch}`);
      if (!response.ok) {
        setCloseRecord(null);
        setIsClosed(false);
        return;
      }

      const data = await response.json() as { closed?: boolean; record?: DayEndCloseRecord | null };
      setIsClosed(Boolean(data.closed));
      setCloseRecord(data.record || null);
    } catch (error) {
      console.error('Failed to fetch day end close status:', error);
      setCloseRecord(null);
      setIsClosed(false);
    }
  }, [selectedDate, userBranch]);

  useEffect(() => {
    if (userBranch) {
      fetchDayEndSummary();
      fetchCloseStatus();
    }
  }, [fetchCloseStatus, fetchDayEndSummary, userBranch]);

  // Handle day end closing
  const handleCloseDayEnd = async () => {
    if (userRole !== 'Admin') {
      addToast('Only Admin can perform day end closing', 'error');
      return;
    }

    if (!summary) {
      addToast('No data to close', 'error');
      return;
    }

    if (!reconciliationNotes.trim()) {
      addToast('Please provide reconciliation notes before closing day end', 'warning');
      return;
    }

    setIsClosing(true);
    try {
      const referenceNo = closeReferenceNo.trim() || `DAYEND-${selectedDate}-${userBranch}`;

      // Close day end
      const closeResponse = await fetch('/api/day-end/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          branch: userBranch,
          cashCount,
          reconciliationNotes,
          referenceNo,
          discrepancies: [],
        }),
      });

      if (!closeResponse.ok) {
        const error = await closeResponse.json();
        addToast(error.error || 'Failed to close day end', 'error');
        return;
      }

      setIsClosed(true);
      addToast('Day end closed successfully. You can now export PDF report.', 'success');
      fetchCloseStatus();
    } catch (error) {
      console.error('Error closing day end:', error);
      addToast('Failed to close day end', 'error');
    } finally {
      setIsClosing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(toSafeNumber(value));
  };

  const formatDateTime = (value: Date) => {
    return new Intl.DateTimeFormat('en-MY', {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: false,
    }).format(value);
  };

  const formattedClosedAt = (() => {
    const rawClosedAt = closeRecord?.closedAt || closeRecord?.closed_at;
    if (!rawClosedAt) return '-';

    const closedDate = new Date(rawClosedAt);
    if (Number.isNaN(closedDate.getTime())) return '-';

    return formatDateTime(closedDate);
  })();

  const closedBy = closeRecord?.closedBy || closeRecord?.closed_by || '-';

  const handleExportPDF = () => {
    if (!summary) {
      addToast('No summary available for export', 'error');
      return;
    }

    if (!isClosed) {
      addToast('Please close day end first before exporting report', 'warning');
      return;
    }

    setIsExporting(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const generatedAt = new Date();
      const totalTransactions = toSafeNumber(summary.totalTransactions);
      const totalRevenue = toSafeNumber(summary.totalRevenue);
      const safeCashCount = toSafeNumber(cashCount);
      const systemCash = toSafeNumber(summary.paymentBreakdown.cash);

      const avgTransaction = totalTransactions > 0
        ? totalRevenue / totalTransactions
        : 0;
      const discrepancy = safeCashCount - systemCash;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('DAY END CLOSING REPORT', 14, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Branch: ${userBranch}`, 14, 24);
      doc.text(`Date: ${selectedDate}`, 14, 29);
      doc.text(`Generated At: ${formatDateTime(generatedAt)}`, 14, 34);
      doc.text(`Generated By: ${toSafeText(userName, 'Admin')} (${toSafeText(userRole, '-')})`, 14, 39);
      doc.text(`Status: CLOSED`, 14, 44);
      doc.text(`Closed By: ${closedBy}`, 14, 49);
      doc.text(`Closed At: ${formattedClosedAt}`, 14, 54);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('1. Summary Report', 14, 62);

      autoTable(doc, {
        startY: 66,
        theme: 'grid',
        head: [['Metric', 'Value']],
        body: [
          ['Total Transactions', String(totalTransactions)],
          ['Total Revenue', formatCurrency(totalRevenue)],
          ['Average Transaction', formatCurrency(avgTransaction)],
          ['System Cash Total', formatCurrency(systemCash)],
          ['Actual Cash Count', formatCurrency(safeCashCount)],
          ['Cash Discrepancy', formatCurrency(discrepancy)],
        ],
        headStyles: { fillColor: [30, 64, 175] },
      });

      const summaryEndY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 66;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('2. Details Report Harian', 14, summaryEndY + 12);

      autoTable(doc, {
        startY: summaryEndY + 16,
        theme: 'striped',
        head: [['Payment Method', 'Amount', 'Percentage']],
        body: [
          ['Cash', formatCurrency(summary.paymentBreakdown.cash), `${summary.totalRevenue > 0 ? ((summary.paymentBreakdown.cash / summary.totalRevenue) * 100).toFixed(1) : '0.0'}%`],
          ['Card', formatCurrency(summary.paymentBreakdown.card), `${summary.totalRevenue > 0 ? ((summary.paymentBreakdown.card / summary.totalRevenue) * 100).toFixed(1) : '0.0'}%`],
          ['Transfer', formatCurrency(summary.paymentBreakdown.transfer), `${summary.totalRevenue > 0 ? ((summary.paymentBreakdown.transfer / summary.totalRevenue) * 100).toFixed(1) : '0.0'}%`],
          ['Other', formatCurrency(summary.paymentBreakdown.other), `${summary.totalRevenue > 0 ? ((summary.paymentBreakdown.other / summary.totalRevenue) * 100).toFixed(1) : '0.0'}%`],
        ],
        headStyles: { fillColor: [30, 64, 175] },
      });

      if (Object.values(summary.salesmanPerformance).length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const afterPaymentY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 60;
        doc.text('2.1 Salesman Performance', 14, afterPaymentY + 10);

        autoTable(doc, {
          startY: afterPaymentY + 13,
          theme: 'grid',
          head: [['Salesman', 'Transactions', 'Revenue', 'Commission']],
          body: Object.values(summary.salesmanPerformance).map((sm) => [
            sm.name,
            String(sm.transactions),
            formatCurrency(sm.revenue),
            formatCurrency(sm.commission),
          ]),
          headStyles: { fillColor: [51, 65, 85] },
        });
      }

      if (summary.topProducts.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const afterSalesmanY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 60;
        doc.text('2.2 Top 5 Products', 14, afterSalesmanY + 10);

        autoTable(doc, {
          startY: afterSalesmanY + 13,
          theme: 'grid',
          head: [['Product', 'Quantity', 'Revenue']],
          body: summary.topProducts.slice(0, 5).map((product) => [
            product.name,
            String(product.quantity),
            formatCurrency(product.revenue),
          ]),
          headStyles: { fillColor: [51, 65, 85] },
        });
      }

      if (summary.hourlyBreakdown.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const afterProductsY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 60;
        doc.text('2.3 Hourly Sales Breakdown', 14, afterProductsY + 10);

        autoTable(doc, {
          startY: afterProductsY + 13,
          theme: 'grid',
          head: [['Hour', 'Transactions', 'Revenue']],
          body: summary.hourlyBreakdown.map((hour) => [
            hour.hour,
            String(hour.transactions),
            formatCurrency(hour.revenue),
          ]),
          headStyles: { fillColor: [51, 65, 85] },
        });
      }

      const afterDetailsY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 60;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('3. Reconciliation Notes', 14, afterDetailsY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const notesText = reconciliationNotes?.trim() || 'No reconciliation notes provided.';
      const wrappedNotes = doc.splitTextToSize(notesText, pageWidth - 28);
      doc.text(wrappedNotes, 14, afterDetailsY + 16);

      const finalY = afterDetailsY + 28 + (wrappedNotes.length * 5);
      const signatureStartY = finalY > 240 ? 240 : finalY;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('4. Sign-off', 14, signatureStartY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Prepared By', 14, signatureStartY + 10);
      doc.text('Verified By', 80, signatureStartY + 10);
      doc.text('Approved By', 145, signatureStartY + 10);

      doc.line(14, signatureStartY + 25, 65, signatureStartY + 25);
      doc.line(80, signatureStartY + 25, 131, signatureStartY + 25);
      doc.line(145, signatureStartY + 25, 196, signatureStartY + 25);

      doc.setFontSize(8);
      doc.text('This report is confidential and for authorized personnel only.', 14, signatureStartY + 33);

      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.text(`Page ${page} of ${pages}`, pageWidth - 30, 289);
      }

      const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      doc.save(`DayEndReport_${selectedDate}_${userBranch}_${fileTimestamp}.pdf`);
      addToast('PDF report exported successfully', 'success');
    } catch (error) {
      console.error('Failed to export day end PDF:', error);
      addToast('Failed to export PDF report', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (userRole !== 'Admin') {
    return (
      <div className="p-6 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
        <p>Only Admin users can access Day End Closing</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-lg border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-4">Day End Closing</h2>
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Branch</label>
            <input
              type="text"
              value={userBranch}
              disabled
              className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {isClosed && (
        <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg flex items-start gap-3">
          <CheckCircle className="text-green-400 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="text-green-300 font-semibold">Day End Closed</p>
            <p className="text-green-400 text-sm">All transactions for this day are now locked.</p>
            <div className="mt-2 text-xs text-green-300/90 space-y-1">
              <p>Closed By: {closedBy}</p>
              <p>Closed At: {formattedClosedAt}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-400">Loading...</div>
      ) : summary ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-sm">Total Transactions</p>
                <ShoppingCart className="text-blue-400" size={20} />
              </div>
              <h3 className="text-3xl font-bold text-white">{summary.totalTransactions}</h3>
            </div>

            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-sm">Total Revenue</p>
                <DollarSign className="text-green-400" size={20} />
              </div>
              <h3 className="text-3xl font-bold text-green-400">{formatCurrency(toSafeNumber(summary.totalRevenue))}</h3>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">Payment Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-300">Cash</span>
                <span className="text-white font-semibold">{formatCurrency(toSafeNumber(summary.paymentBreakdown.cash))}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-300">Card</span>
                <span className="text-white font-semibold">{formatCurrency(toSafeNumber(summary.paymentBreakdown.card))}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-300">Transfer</span>
                <span className="text-white font-semibold">{formatCurrency(toSafeNumber(summary.paymentBreakdown.transfer))}</span>
              </div>
            </div>
          </div>

          {/* Salesman Performance */}
          {Object.keys(summary.salesmanPerformance).length > 0 && (
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users size={20} className="text-orange-400" />
                Salesman Performance
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 text-slate-300">
                    <tr>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-right px-4 py-2">Transactions</th>
                      <th className="text-right px-4 py-2">Revenue</th>
                      <th className="text-right px-4 py-2">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(summary.salesmanPerformance).map((sm: SalesmanPerformanceEntry) => (
                      <tr key={sm.name} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-white">{sm.name}</td>
                        <td className="text-right px-4 py-3 text-slate-300">{sm.transactions}</td>
                        <td className="text-right px-4 py-3 text-green-400 font-semibold">
                          {formatCurrency(sm.revenue)}
                        </td>
                        <td className="text-right px-4 py-3 text-blue-400 font-semibold">
                          {formatCurrency(sm.commission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Products */}
          {summary.topProducts.length > 0 && (
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">Top 5 Products</h3>
              <div className="space-y-2">
                {summary.topProducts.slice(0, 5).map((product) => (
                  <div key={product.name} className="flex justify-between items-center py-2 border-b border-slate-700/30">
                    <span className="text-slate-300">{product.name}</span>
                    <div className="text-right">
                      <p className="text-white font-semibold">Qty: {product.quantity}</p>
                      <p className="text-slate-400 text-xs">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cash Reconciliation */}
          {!isClosed && (
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">Cash Reconciliation</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">System Cash Total</label>
                  <input
                    type="text"
                    value={formatCurrency(toSafeNumber(summary.paymentBreakdown.cash))}
                    disabled
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Actual Cash Count *</label>
                  <input
                    type="number"
                    value={cashCount}
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      setCashCount(rawValue === '' ? 0 : toSafeNumber(rawValue));
                    }}
                    step="0.01"
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {toSafeNumber(cashCount) !== toSafeNumber(summary.paymentBreakdown.cash) && (
                  <div className="p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg flex items-start gap-2">
                    <AlertCircle className="text-yellow-400 mt-0.5 flex-shrink-0" size={18} />
                    <div>
                      <p className="text-yellow-300 text-sm font-semibold">Discrepancy Detected</p>
                      <p className="text-yellow-400 text-xs mt-1">
                        Difference: {formatCurrency(toSafeNumber(cashCount) - toSafeNumber(summary.paymentBreakdown.cash))}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Reconciliation Notes</label>
                  <textarea
                    value={reconciliationNotes}
                    onChange={(e) => setReconciliationNotes(e.target.value)}
                    placeholder="Add any notes about discrepancies or issues..."
                    rows={4}
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Reference No (Optional)</label>
                  <input
                    type="text"
                    value={closeReferenceNo}
                    onChange={(e) => setCloseReferenceNo(e.target.value)}
                    placeholder="Example: DAYEND-APPROVAL-001"
                    className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <button
                  onClick={handleCloseDayEnd}
                  disabled={isClosing}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Lock size={18} />
                  {isClosing ? 'Processing...' : 'Close Day End'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">Export Record</h3>
            <p className="text-sm text-slate-400 mb-4">
              Export or re-export final day-end PDF report for daily sales record storage.
            </p>
            <button
              onClick={handleExportPDF}
              disabled={isExporting || !isClosed}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Download size={18} />
              {isExporting ? 'Exporting PDF...' : 'Export PDF Report'}
            </button>
          </div>
        </>
      ) : (
        <div className="text-center text-slate-400">No data available</div>
      )}
    </div>
  );
}
