import type { DailyReport } from '@/types';

/** Buka tetingkap cetak/PDF dengan borang Daily Sales Report — sama seperti Pusat Laporan. */
export function openDailyReportPdfWindow(row: DailyReport | Record<string, unknown>) {
  const r = row as DailyReport;
  const expenseRows = Array.isArray(r.expenseLines) ? r.expenseLines : [];
  const format = (value: number | undefined) => (Number(value || 0) > 0 ? Number(value || 0).toFixed(2) : '');
  const totalAll = Number(r.totalCash || 0) + Number(r.totalTransfer || 0) + Number(r.totalCredit || 0);
  const proofLinks = {
    cash: Array.isArray(r.cashProofUrls) ? r.cashProofUrls : [],
    banking: Array.isArray(r.bankSlipUrls) ? r.bankSlipUrls : [],
    expenses: expenseRows.flatMap((line) => (Array.isArray(line.receiptImageUrls) ? line.receiptImageUrls : [])),
  };
  const expenseDisplayRows = [
    { label: 'Expenses Sales', value: expenseRows.reduce((sum, item) => sum + Number(item.amount || 0), 0) },
    ...expenseRows.slice(0, 4).map((item) => ({ label: item.description, value: Number(item.amount || 0) })),
    { label: 'Balance PTCash', value: Number(r.balancePtCashManual || 0) },
  ];
  const renderSalesRows = (
    rows: Array<{ customer: string; item: string; qn: number | string; price: number | string; amount: number | string; billNo: string }>
  ) => {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const hasAnyValue = normalizedRows.some(
      (row) => (row.customer || row.item || row.billNo || Number(row.amount || 0) > 0 || Number(row.qn || 0) > 0)
    );
    const effectiveRows = hasAnyValue
      ? normalizedRows
      : [{ customer: '', item: '', qn: '', price: '', amount: '', billNo: '' }];
    const filledRows = effectiveRows
      .map((row, idx) => `<tr><td>${idx + 1}</td><td>${row.customer || ''}</td><td>${row.item || ''}</td><td>${row.qn || ''}</td><td>${row.price || ''}</td><td>${row.amount || ''}</td><td>${row.billNo || ''}</td><td></td></tr>`)
      .join('');
    const minRows = 8;
    const blanksNeeded = Math.max(0, minRows - effectiveRows.length);
    const blankRows = Array.from({ length: blanksNeeded })
      .map(() => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>')
      .join('');
    return `${filledRows}${blankRows}`;
  };
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`
      <html>
        <head>
          <title>Daily Report ${r.date}</title>
          <style>
            body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 18px; }
            .header { text-align: center; margin-bottom: 12px; }
            .header h2 { margin: 0; font-size: 13px; text-transform: uppercase; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
            th, td { border: 1px solid #8a8a8a; padding: 4px; }
            th { background: #dbeafe; }
            .sectionTitle { font-size: 10px; font-weight: bold; text-transform: uppercase; text-align: center; background: #bfdbfe; }
            .proofs { margin-top: 12px; font-size: 10px; }
            .proofs h4 { margin: 6px 0; font-size: 10px; }
            .toolbar { margin-bottom: 10px; display: flex; gap: 8px; }
            .toolbar button { font-size: 11px; padding: 6px 10px; }
            @media print { .toolbar { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button onclick="window.print()">Print / Save PDF</button>
          </div>
          <div class="header">
            <h2>Daily Sales Report</h2>
            <h2>Data</h2>
          </div>
          <div class="meta">
            <div>Tarikh: ${r.date}<br/>Staff: ${r.userName}</div>
            <div>Kawasan: ${r.branch}<br/>Status: ${r.status}</div>
          </div>

          <table>
            <thead><tr><th colspan="8" class="sectionTitle">Cash Sales</th></tr><tr><th>No</th><th>Customer</th><th>Item</th><th>QN</th><th>Price</th><th>Amount</th><th>Bill No</th><th>PO By</th></tr></thead>
            <tbody>${renderSalesRows(r.salesSnapshot?.cashSales || [])}</tbody>
          </table>
          <table>
            <thead><tr><th colspan="8" class="sectionTitle">Transfer Sales</th></tr><tr><th>No</th><th>Customer</th><th>Item</th><th>QN</th><th>Price</th><th>Amount</th><th>Bill No</th><th>PO By</th></tr></thead>
            <tbody>${renderSalesRows(r.salesSnapshot?.transferSales || [])}</tbody>
          </table>
          <table>
            <thead><tr><th colspan="8" class="sectionTitle">Credit Terms Customer</th></tr><tr><th>No</th><th>Customer</th><th>Item</th><th>QN</th><th>Price</th><th>Amount</th><th>Bill No</th><th>PO By</th></tr></thead>
            <tbody>${renderSalesRows(r.salesSnapshot?.creditSales || [])}</tbody>
          </table>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <table>
              <thead><tr><th>Descriptions</th><th style="width:120px;">Amount (RM)</th></tr></thead>
              <tbody>
                ${expenseDisplayRows.map((item, idx) => `<tr><td>${idx + 1}. ${item.label}</td><td style="text-align:right;">${format(item.value)}</td></tr>`).join('')}
              </tbody>
            </table>
            <table>
              <thead><tr><th>Sales</th><th style="width:120px;">Amount (RM)</th></tr></thead>
              <tbody>
                <tr><td>Cash</td><td style="text-align:right;">${format(Number(r.totalCash || 0))}</td></tr>
                <tr><td>Transfer</td><td style="text-align:right;">${format(Number(r.totalTransfer || 0))}</td></tr>
                <tr><td>Credit</td><td style="text-align:right;">${format(Number(r.totalCredit || 0))}</td></tr>
                <tr><td><b>Total</b></td><td style="text-align:right;"><b>${format(totalAll)}</b></td></tr>
                <tr><td><b>Amount Banking</b></td><td style="text-align:right;"><b>${format(Number(r.amountBankingManual || 0))}</b></td></tr>
              </tbody>
            </table>
          </div>

          <div class="proofs">
            <h4>Lampiran Bukti (asing dari borang PDF)</h4>
            <div>Cash Proof: ${proofLinks.cash.length > 0 ? proofLinks.cash.map((url, idx) => `<a href="${url}" target="_blank">Cash ${idx + 1}</a>`).join(' | ') : 'Tiada'}</div>
            <div>Banking Slip: ${proofLinks.banking.length > 0 ? proofLinks.banking.map((url, idx) => `<a href="${url}" target="_blank">Bank ${idx + 1}</a>`).join(' | ') : 'Tiada'}</div>
            <div>Resit Expenses: ${proofLinks.expenses.length > 0 ? proofLinks.expenses.map((url, idx) => `<a href="${url}" target="_blank">Resit ${idx + 1}</a>`).join(' | ') : 'Tiada'}</div>
          </div>
        </body>
      </html>
    `);
  win.document.close();
  win.focus();
}
