'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ExternalLink, History, Printer, ReceiptText, RefreshCw } from 'lucide-react';
import { Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

type SalesHistoryTransaction = Transaction & {
  customer_id?: string | null;
  customer_name?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  transactionDate?: string | null;
};

interface LiveSalesHistoryProps {
  initialTransactions: Transaction[];
  selectedBranch: string;
}

function getPaymentLabel(paymentMethod?: string | null) {
  const labels: Record<string, string> = {
    cash: 'Tunai',
    bill_to_bill: 'Kredit (Bill-to-Bill)',
    bank_transfer: 'Pindahan Bank',
    qr_code: 'QR Code',
    card: 'Kad',
    ewallet: 'E-Wallet',
    credit: 'Kredit',
    transfer: 'Pindahan',
  };

  return labels[paymentMethod || ''] || paymentMethod || 'Tidak dinyatakan';
}

function getCustomerName(sale: SalesHistoryTransaction) {
  return sale.customer?.name || sale.customer_name || 'Walk-in / Tiada';
}

function getSaleTimestamp(sale: SalesHistoryTransaction) {
  return sale.transactionDate || sale.createdAt || '';
}

function getReferenceLabel(sale: SalesHistoryTransaction) {
  if (sale.receiptNo) return 'No. Resit';
  if (sale.billingRefNo) return 'No. Rujukan Kredit';
  if (sale.transferRefNo) return 'No. Rujukan Transfer';
  if (sale.qrTxnRefNo) return 'No. Transaksi QR';
  if (sale.paymentReferenceNo) return 'No. Rujukan';
  return 'Rujukan';
}

function getReferenceValue(sale: SalesHistoryTransaction) {
  return sale.receiptNo || sale.billingRefNo || sale.transferRefNo || sale.qrTxnRefNo || sale.paymentReferenceNo || 'Tiada';
}

function getSalesUserLabel(sale: SalesHistoryTransaction) {
  if (sale.salesmanName && sale.salesmanName.trim()) {
    return sale.salesmanName;
  }

  if (sale.salesmanId) {
    return `ID: ${sale.salesmanId}`;
  }

  return 'Tidak direkodkan';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function LiveSalesHistory({ initialTransactions, selectedBranch }: LiveSalesHistoryProps) {
  const router = useRouter();
  const [sales, setSales] = useState<SalesHistoryTransaction[]>(initialTransactions as SalesHistoryTransaction[]);
  const [loading, setLoading] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(initialTransactions[0]?.id || null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [channelReady, setChannelReady] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const { addToast } = useToast();

  const loadSales = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') {
        params.set('branch', selectedBranch);
      }

      const query = params.toString();
      const response = await fetch(`/api/sales${query ? `?${query}` : ''}`, { cache: 'no-store' });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Gagal memuatkan history jualan');
      }

      const nextSales = Array.isArray(data) ? (data as SalesHistoryTransaction[]) : [];
      setSales(nextSales);
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to load live sales history:', error);
      if (showSpinner) {
        addToast(error instanceof Error ? error.message : 'Gagal memuatkan history jualan', 'error');
      }
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [addToast, selectedBranch]);

  useEffect(() => {
    setSales(initialTransactions as SalesHistoryTransaction[]);
  }, [initialTransactions]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  useEffect(() => {
    if (sales.length === 0) {
      setSelectedSaleId(null);
      return;
    }

    setSelectedSaleId((currentId) => {
      if (currentId && sales.some((sale) => sale.id === currentId)) {
        return currentId;
      }

      return sales[0].id;
    });
  }, [sales]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = window.setTimeout(() => {
        void loadSales(false);
      }, 350);
    };

    const channel = supabase
      .channel(`admin-sales-history-${selectedBranch}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_transactions' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_items' },
        scheduleRefresh
      )
      .subscribe((status) => {
        setChannelReady(status === 'SUBSCRIBED');
      });

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [loadSales, selectedBranch]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadSales(false);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [loadSales]);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) || null,
    [sales, selectedSaleId]
  );

  const salesTotal = useMemo(
    () => sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    [sales]
  );

  const getProofPhotos = useCallback((sale: SalesHistoryTransaction) => {
    const urls = Array.isArray(sale.proofPhotoUrls) ? sale.proofPhotoUrls.filter(Boolean) : [];
    if (urls.length > 0) return urls;
    return sale.proofPhotoUrl ? [sale.proofPhotoUrl] : [];
  }, []);

  const handlePrintReceipt = useCallback((sale: SalesHistoryTransaction) => {
    const receiptWindow = window.open('', '_blank', 'width=960,height=720');
    if (!receiptWindow) {
      addToast('Popup disekat. Benarkan popup untuk print resit.', 'warning');
      return;
    }

    const timestamp = getSaleTimestamp(sale);
    const formattedDate = timestamp
      ? new Intl.DateTimeFormat('ms-MY', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(timestamp))
      : 'Tidak direkodkan';

    const rows = (sale.items || [])
      .map((item) => {
        const name = escapeHtml(String(item.name || 'Item'));
        const quantity = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const subtotal = Number(item.quantity || 0) * Number(item.price || 0);

        return `
          <tr>
            <td>${name}</td>
            <td>${quantity}</td>
            <td>RM ${price.toFixed(2)}</td>
            <td>RM ${subtotal.toFixed(2)}</td>
          </tr>
        `;
      })
      .join('');

    const proofPhotos = getProofPhotos(sale);
    const proofMarkup = proofPhotos.length > 0
      ? `<div class="proof"><p>Bukti bayaran</p><div class="proof-grid">${proofPhotos.map((photo, index) => `<figure><img src="${escapeHtml(photo)}" alt="Bukti bayaran ${index + 1}" /><figcaption>Lampiran ${index + 1}</figcaption></figure>`).join('')}</div></div>`
      : '';

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ms">
        <head>
          <meta charset="UTF-8" />
          <title>Receipt ${escapeHtml(sale.invoice || sale.id)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
            .header, .meta-grid { display: grid; gap: 12px; }
            .header { grid-template-columns: 1.5fr 1fr; margin-bottom: 24px; }
            .brand { font-size: 24px; font-weight: 700; }
            .muted { color: #475569; font-size: 13px; }
            .meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 24px; }
            .meta-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; }
            .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 6px; }
            .value { font-size: 15px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
            th { background: #f8fafc; font-size: 12px; text-transform: uppercase; color: #475569; }
            .total { margin-top: 20px; text-align: right; font-size: 20px; font-weight: 700; }
            .proof { margin-top: 24px; }
            .proof p { font-weight: 700; margin-bottom: 12px; }
            .proof-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .proof figure { margin: 0; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px; }
            .proof img { width: 100%; height: 220px; object-fit: cover; border-radius: 10px; border: 1px solid #cbd5e1; }
            .proof figcaption { margin-top: 8px; font-size: 12px; color: #475569; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">History Jualan Branch</div>
              <div class="muted">Salinan transaksi untuk semakan branch admin</div>
            </div>
            <div>
              <div class="label">No. Dokumen</div>
              <div class="value">${escapeHtml(sale.invoice || sale.id)}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-card"><div class="label">Kedai / Pelanggan</div><div class="value">${escapeHtml(getCustomerName(sale))}</div></div>
            <div class="meta-card"><div class="label">Branch</div><div class="value">${escapeHtml(sale.branch || 'Tidak dinyatakan')}</div></div>
            <div class="meta-card"><div class="label">Sales User</div><div class="value">${escapeHtml(getSalesUserLabel(sale))}</div></div>
            <div class="meta-card"><div class="label">Masa Transaksi</div><div class="value">${escapeHtml(formattedDate)}</div></div>
            <div class="meta-card"><div class="label">Kaedah Bayaran</div><div class="value">${escapeHtml(getPaymentLabel(sale.payment_method || sale.payment?.method))}</div></div>
            <div class="meta-card"><div class="label">${escapeHtml(getReferenceLabel(sale))}</div><div class="value">${escapeHtml(getReferenceValue(sale))}</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Kuantiti</th>
                <th>Harga</th>
                <th>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4">Tiada item direkodkan</td></tr>'}
            </tbody>
          </table>

          <div class="total">Jumlah: RM ${Number(sale.total || 0).toFixed(2)}</div>
          ${proofMarkup}
        </body>
      </html>
    `);

    receiptWindow.document.close();
    receiptWindow.focus();
    window.setTimeout(() => {
      receiptWindow.print();
    }, 250);
  }, [addToast, getProofPhotos]);

  return (
    <section className="soft-panel rounded-2xl p-6 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
              <ReceiptText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Live Sales History</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Semua transaksi branch admin dengan bukti bayaran, user sales, masa transaksi, dan cetakan resit.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => router.push('/sales/history')}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            title="Buka halaman History Sales"
            aria-label="Buka halaman History Sales"
          >
            <History size={15} />
            History Sales
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className={`h-2.5 w-2.5 rounded-full ${channelReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            {channelReady ? 'Realtime aktif' : 'Fallback sync'}
          </span>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {selectedBranch === 'all' ? 'Semua branch' : selectedBranch}
          </span>
          <button
            type="button"
            onClick={() => void loadSales()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Rekod</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{sales.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Nilai Jualan</p>
            <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(salesTotal)}</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-900 col-span-2 lg:col-span-1">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Sync</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString('ms-MY') : 'Belum sync'}
            </p>
          </div>
        </div>

        <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
          {sales.map((sale) => {
            const timestamp = getSaleTimestamp(sale);
            const active = sale.id === selectedSaleId;

            return (
              <div
                key={sale.id}
                className={`rounded-2xl border p-4 transition ${active
                  ? 'border-blue-500/70 bg-blue-50/80 dark:border-blue-400/70 dark:bg-blue-950/20'
                  : 'border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/60'
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-mono text-sm font-semibold text-slate-900 dark:text-white">{sale.invoice || sale.id}</p>
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{getCustomerName(sale)}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        Sales: {getSalesUserLabel(sale)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        {getPaymentLabel(sale.payment_method || sale.payment?.method)}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 ${sale.proofPhotoUrl ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                        {sale.proofPhotoUrl ? 'Ada bukti bayaran' : 'Tiada bukti bayaran'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 lg:items-end">
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(sale.total || 0))}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {timestamp ? new Date(timestamp).toLocaleString('ms-MY', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '--'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sale.proofPhotoUrl && (
                        <a
                          href={sale.proofPhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <ExternalLink size={14} /> Bukti
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(sale)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        <Printer size={14} /> Print
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && sales.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Tiada history jualan untuk branch ini buat masa sekarang.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}