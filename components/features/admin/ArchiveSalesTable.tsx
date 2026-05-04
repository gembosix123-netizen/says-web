'use client';

import React from 'react';
import { Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { ExternalLink, Printer } from 'lucide-react';

type Sale = Transaction & {
  salesmanName?: string | null;
  payment_method?: string | null;
  paymentStatus?: string | null;
  customer_name?: string | null;
  area?: string | null;
  receiptNo?: string | null;
  billingRefNo?: string | null;
  transferRefNo?: string | null;
  qrTxnRefNo?: string | null;
  paymentReferenceNo?: string | null;
  proofPhotoUrl?: string | null;
  proofPhotoUrls?: string[] | null;
  transactionDate?: string | null;
};

function getPaymentLabel(method?: string | null) {
  const map: Record<string, string> = {
    cash: 'Tunai',
    bill_to_bill: 'Kredit (Bill-to-Bill)',
    bank_transfer: 'Pindahan Bank',
    qr_code: 'QR Code',
    card: 'Kad',
  };
  return map[method ?? ''] ?? method ?? '–';
}

function getSalesUser(sale: Sale) {
  if (sale.salesmanName && sale.salesmanName.trim()) return sale.salesmanName;
  return 'Nama staff tidak direkodkan';
}

function getRef(sale: Sale) {
  return sale.receiptNo || sale.billingRefNo || sale.transferRefNo || sale.qrTxnRefNo || sale.paymentReferenceNo || '–';
}

function getCustomerName(sale: Sale) {
  return (typeof sale.customer === 'object' ? sale.customer?.name : null) ?? sale.customer_name ?? '–';
}

function fmtTime(iso?: string | null) {
  if (!iso) return '–';
  return new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getProofPhotos(sale: Sale) {
  const urls = Array.isArray(sale.proofPhotoUrls) ? sale.proofPhotoUrls.filter(Boolean) : [];
  if (urls.length > 0) return urls;
  return sale.proofPhotoUrl ? [sale.proofPhotoUrl] : [];
}

function normalizePaymentCategory(method?: string | null) {
  const value = String(method || '').toLowerCase();
  if (value === 'bill_to_bill') return 'credit';
  if (value === 'bank_transfer') return 'transfer';
  if (value === 'qr_code') return 'qr';
  if (value === 'card') return 'card';
  return 'cash';
}

function normalizeOutstandingStatus(sale: Sale) {
  const status = String(sale.paymentStatus || sale.status || '').toLowerCase().trim();
  if (status.includes('pending')) return 'unpaid';
  if (status === 'paid' || status === 'completed') return 'paid';
  if (normalizePaymentCategory(sale.payment_method ?? sale.payment?.method) === 'credit') return 'unpaid';
  return 'paid';
}

export default function ArchiveSalesTable({ sales, loading }: { sales: Sale[]; loading: boolean }) {
  const handlePrint = (sale: Sale) => {
    const win = window.open('', '_blank', 'width=800,height=700');
    if (!win) return;
    const proofPhotos = getProofPhotos(sale);
    const rows = (sale.items ?? []).map((i) => {
      const line = Number(i.quantity || 0) * Number(i.price || 0);
      return `
      <tr>
        <td>${escHtml(String(i.name ?? ''))}</td>
        <td>${escHtml(String(i.quantity ?? ''))}</td>
        <td>${escHtml(String(i.price ?? ''))}</td>
        <td>${escHtml(String(line || ''))}</td>
      </tr>`;
    });
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Resit</title></head><body style="font-family:sans-serif;padding:24px;">
      <p><strong>${escHtml(sale.invoice ?? sale.id)}</strong></p>
      <p>${escHtml(getCustomerName(sale))}</p>
      <table border="1" cellpadding="6"><thead><tr><th>Item</th><th>Qty</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>${rows}</tbody></table>
      <p><strong>Jumlah: RM ${Number(sale.total ?? 0).toFixed(2)}</strong></p>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  if (loading) {
    return (
      <div className="soft-panel rounded-xl py-16 text-center text-slate-500 dark:text-slate-400 text-sm">Memuatkan jualan…</div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="soft-panel rounded-xl py-16 text-center text-slate-500 dark:text-slate-400 text-sm">
        Tiada rekod jualan (ikut penapis semasa).
      </div>
    );
  }

  return (
    <div className="soft-panel rounded-xl overflow-hidden">
      <div className="overflow-x-auto max-h-[68vh]">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">No. Invois</th>
              <th className="px-4 py-3">Kedai / Pelanggan</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">User Sales</th>
              <th className="px-4 py-3">Masa</th>
              <th className="px-4 py-3">Kaedah Bayaran</th>
              <th className="px-4 py-3">Status Hutang</th>
              <th className="px-4 py-3">No. Rujukan</th>
              <th className="px-4 py-3">Bukti</th>
              <th className="px-4 py-3 text-right">Jumlah</th>
              <th className="px-4 py-3 text-center">Print</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sales.map((sale) => (
              <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  {sale.invoice || sale.id}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{getCustomerName(sale)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{sale.area || '–'}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">{getSalesUser(sale)}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                  {fmtTime(sale.transactionDate ?? sale.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-slate-100 dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300">
                    {getPaymentLabel(sale.payment_method ?? sale.payment?.method)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {normalizeOutstandingStatus(sale) === 'unpaid' ? (
                    <span className="inline-block rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300">
                      Belum Dibayar
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                      Sudah Terbayar
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{getRef(sale)}</td>
                <td className="px-4 py-3 text-center">
                  {getProofPhotos(sale).length > 0 ? (
                    <a
                      href={getProofPhotos(sale)[0]}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <ExternalLink size={13} /> Lihat
                      {getProofPhotos(sale).length > 1 ? ` (${getProofPhotos(sale).length})` : ''}
                    </a>
                  ) : (
                    <span className="text-xs text-amber-500">Tiada</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  {formatCurrency(Number(sale.total ?? 0))}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => handlePrint(sale)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    <Printer size={13} /> Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
