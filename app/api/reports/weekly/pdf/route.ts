import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { canExportReports } from '@/lib/permissions';
import { db } from '@/lib/db';
import type { DailyReport } from '@/types';
import {
  transactionIsVoided,
  collectDailyReportExpensesInRange,
} from '@/lib/weeklyReportShared';

function getWeekRange(dateStr: string): { start: Date; end: Date; label: string } {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  mon.setHours(0, 0, 0, 0);

  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);

  const year = mon.getFullYear();
  const weekNo = Math.ceil(((mon.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);

  return { start: mon, end: sun, label: `${year}-W${String(weekNo).padStart(2, '0')}` };
}

function fmtCurrency(value: number): string {
  return `RM ${Number(value || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = normalizeRole(user.role);
    if (!canExportReports(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const requestedBranch = searchParams.get('branch') || '';
    const branch = role === 'Admin' ? (user.branch || '') : requestedBranch;

    const { start, end, label } = getWeekRange(dateParam);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    let txQuery = supabaseAdmin
      .from('sales_transactions')
      .select('*')
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at');

    if (branch) txQuery = txQuery.eq('branch', branch);

    const { data: txRows, error: txError } = await txQuery;
    if (txError) return NextResponse.json({ error: 'Gagal ambil data jualan' }, { status: 500 });

    const transactions = txRows || [];
    const saleIds = transactions.map((t) => t.id);

    type SaleItem = { transaction_id: string; product_name: string; quantity: number; subtotal: number };
    let allItems: SaleItem[] = [];
    if (saleIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from('sales_items')
        .select('transaction_id,product_name,quantity,subtotal')
        .in('transaction_id', saleIds);
      allItems = (items || []) as SaleItem[];
    }

    const dailyMap: Record<string, { gross: number; refund: number; net: number; cash: number; credit: number; txCount: number; stores: Set<string> }> = {};
    for (const tx of transactions as any[]) {
      const day = String(tx.created_at || '').slice(0, 10);
      if (!dailyMap[day]) {
        dailyMap[day] = { gross: 0, refund: 0, net: 0, cash: 0, credit: 0, txCount: 0, stores: new Set() };
      }
      const amount = Number(tx.grand_total || tx.subtotal_amount || 0);
      dailyMap[day].gross += amount;
      dailyMap[day].txCount += 1;
      if (tx.customer_id) dailyMap[day].stores.add(String(tx.customer_id));
      if (String(tx.payment_method || '').toLowerCase() === 'credit' || String(tx.payment_method || '').toLowerCase() === 'bill_to_bill') {
        dailyMap[day].credit += amount;
      } else {
        dailyMap[day].cash += amount;
      }
    }

    let rtQuery = supabaseAdmin
      .from('exchange_returns')
      .select('*')
      .in('status', ['approved', 'completed'])
      .gte('created_at', startISO)
      .lte('created_at', endISO);
    if (branch) rtQuery = rtQuery.eq('branch', branch);
    const { data: returns } = await rtQuery;

    for (const r of (returns || []) as any[]) {
      const day = String(r.created_at || '').slice(0, 10);
      if (!dailyMap[day]) {
        dailyMap[day] = { gross: 0, refund: 0, net: 0, cash: 0, credit: 0, txCount: 0, stores: new Set() };
      }
      dailyMap[day].refund += Number(r.quantity || 0) * Number(r.unit_price || 0);
    }

    Object.values(dailyMap).forEach((d) => {
      d.net = d.gross - d.refund;
    });

    const dailyTrend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        gross: d.gross,
        refund: d.refund,
        net: d.net,
        cash: d.cash,
        credit: d.credit,
        txCount: d.txCount,
        storeCount: d.stores.size,
      }));

    const voidTxIds = new Set(
      (transactions as Array<Record<string, unknown>>)
        .filter((t) => transactionIsVoided(t))
        .map((t) => String(t.id)),
    );

    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const item of allItems) {
      if (voidTxIds.has(item.transaction_id)) continue;
      const key = item.product_name || 'Unknown Product';
      if (!productMap[key]) productMap[key] = { name: key, qty: 0, revenue: 0 };
      productMap[key].qty += Number(item.quantity || 0);
      productMap[key].revenue += Number(item.subtotal || 0);
    }

    // Full product list (not capped to top 10)
    const productsFull = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

    let expQuery = supabaseAdmin
      .from('expenses')
      .select('*')
      .in('status', ['approved', 'paid'])
      .gte('expense_date', start.toISOString().split('T')[0])
      .lte('expense_date', end.toISOString().split('T')[0]);
    if (branch) expQuery = expQuery.eq('branch', branch);
    const { data: expenses } = await expQuery;

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    const dailyReportsAll = (await db.dailyReports.getAll()) as DailyReport[];
    const dailyExpenseAgg = collectDailyReportExpensesInRange(dailyReportsAll, startStr, endStr, branch);

    const totalGross = dailyTrend.reduce((s, d) => s + d.gross, 0);
    const totalRefund = dailyTrend.reduce((s, d) => s + d.refund, 0);
    const totalNet = totalGross - totalRefund;
    const totalExpenseFromSupabase = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const totalExpenseFromDailyReports = dailyExpenseAgg.total;
    const totalExpense = totalExpenseFromSupabase + totalExpenseFromDailyReports;
    const netAfterExpense = totalNet - totalExpense;

    const dailyRowsHtml = dailyTrend
      .map((d) => `
        <tr>
          <td>${escapeHtml(new Date(`${d.date}T12:00:00`).toLocaleDateString('ms-MY'))}</td>
          <td class="num">${d.gross.toFixed(2)}</td>
          <td class="num">${d.refund.toFixed(2)}</td>
          <td class="num">${d.net.toFixed(2)}</td>
          <td class="num">${d.cash.toFixed(2)}</td>
          <td class="num">${d.credit.toFixed(2)}</td>
          <td class="num">${d.txCount}</td>
          <td class="num">${d.storeCount}</td>
        </tr>
      `)
      .join('');

    const productRowsHtml = productsFull
      .map((p, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(p.name)}</td>
          <td class="num">${p.qty}</td>
          <td class="num">${p.revenue.toFixed(2)}</td>
        </tr>
      `)
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Weekly Report ${escapeHtml(label)}</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; color: #0f172a; margin: 24px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    .sub { color: #475569; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(160px, 1fr)); gap: 10px; margin-bottom: 20px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; }
    .k { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .v { font-size: 18px; font-weight: 700; margin-top: 4px; }
    .subamt { font-size: 11px; color: #475569; margin-top: 6px; line-height: 1.35; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 18px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; }
    th { background: #f8fafc; text-align: left; }
    .num { text-align: right; }
    h2 { font-size: 15px; margin: 16px 0 8px; }
  </style>
</head>
<body>
  <h1>WEEKLY SALES REPORT</h1>
  <div class="sub">${escapeHtml(label)} | ${escapeHtml(branch || 'All Branches')} | ${escapeHtml(start.toLocaleDateString('ms-MY'))} - ${escapeHtml(end.toLocaleDateString('ms-MY'))}</div>

  <div class="grid">
    <div class="card"><div class="k">Jualan Kasar</div><div class="v">${fmtCurrency(totalGross)}</div></div>
    <div class="card"><div class="k">Refund</div><div class="v">${fmtCurrency(totalRefund)}</div></div>
    <div class="card"><div class="k">Jualan Bersih</div><div class="v">${fmtCurrency(totalNet)}</div></div>
    <div class="card"><div class="k">Expenses (gabungan)</div><div class="v">${fmtCurrency(totalExpense)}</div>
      <div class="subamt">Jadual Supabase: ${fmtCurrency(totalExpenseFromSupabase)}<br/>Borang laporan harian: ${fmtCurrency(totalExpenseFromDailyReports)}</div>
    </div>
    <div class="card"><div class="k">Baki Bersih</div><div class="v">${fmtCurrency(netAfterExpense)}</div></div>
    <div class="card"><div class="k">Bil Transaksi</div><div class="v">${transactions.length}</div></div>
  </div>

  <h2>Trend Harian</h2>
  <table>
    <thead>
      <tr>
        <th>Tarikh</th>
        <th class="num">Jualan Kasar</th>
        <th class="num">Refund</th>
        <th class="num">Jualan Bersih</th>
        <th class="num">Tunai</th>
        <th class="num">Kredit</th>
        <th class="num">Bil Txn</th>
        <th class="num">Bil Kedai</th>
      </tr>
    </thead>
    <tbody>
      ${dailyRowsHtml || '<tr><td colspan="8">Tiada data</td></tr>'}
    </tbody>
  </table>

  <h2>Produk Penuh Minggu Ini</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Produk</th>
        <th class="num">Qty</th>
        <th class="num">Hasil (RM)</th>
      </tr>
    </thead>
    <tbody>
      ${productRowsHtml || '<tr><td colspan="4">Tiada produk</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;

    const safeBranch = (branch || 'All').replace(/[^a-zA-Z0-9_-]+/g, '_');
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="WeeklyReport_${label}_${safeBranch}.html"`,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/reports/weekly/pdf:', error);
    return NextResponse.json({ error: 'Failed to export weekly PDF' }, { status: 500 });
  }
}
