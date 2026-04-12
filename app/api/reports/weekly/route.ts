import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { canExportReports } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

// ============================================================================
// Helper: resolve week range from a date
// ============================================================================
function getWeekRange(dateStr: string): { start: Date; end: Date; label: string } {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);

  const year = mon.getFullYear();
  const weekNo = Math.ceil(
    ((mon.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7
  );
  return { start: mon, end: sun, label: `${year}-W${String(weekNo).padStart(2, '0')}` };
}

function fmt(n: number) {
  return Number(n || 0).toFixed(2);
}

function fmtDate(iso: string) {
  return iso ? new Date(iso).toLocaleDateString('ms-MY') : '';
}

// ============================================================================
// GET — fetch weekly summary (for UI display)
// ============================================================================
export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = normalizeRole(user.role);
  if (!canExportReports(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const branch = role === 'Admin' ? (user.branch || '') : (searchParams.get('branch') || '');

  const { start, end, label } = getWeekRange(dateParam);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Fetch transactions for the week
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

  // Fetch items
  let itemsMap: Record<string, Array<{ product_name: string; quantity: number; subtotal: number }>> = {};
  if (saleIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('sales_items')
      .select('transaction_id, product_name, quantity, subtotal')
      .in('transaction_id', saleIds);
    itemsMap = (items || []).reduce<typeof itemsMap>((acc, item) => {
      if (!acc[item.transaction_id]) acc[item.transaction_id] = [];
      acc[item.transaction_id].push(item);
      return acc;
    }, {});
  }

  // Fetch approved returns for the week
  let rtQuery = supabaseAdmin
    .from('exchange_returns')
    .select('*')
    .in('status', ['approved', 'completed'])
    .gte('created_at', startISO)
    .lte('created_at', endISO);

  if (branch) rtQuery = rtQuery.eq('branch', branch);
  const { data: returns } = await rtQuery;

  // Fetch expenses for the week
  let expQuery = supabaseAdmin
    .from('expenses')
    .select('*')
    .in('status', ['approved', 'paid'])
    .gte('expense_date', start.toISOString().split('T')[0])
    .lte('expense_date', end.toISOString().split('T')[0]);

  if (branch) expQuery = expQuery.eq('branch', branch);
  const { data: expenses } = await expQuery;

  // Aggregate daily summary
  const dailyMap: Record<string, { gross: number; refund: number; net: number; cash: number; credit: number; txCount: number; storeIds: Set<string> }> = {};
  for (const tx of transactions) {
    const day = (tx.created_at || '').slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { gross: 0, refund: 0, net: 0, cash: 0, credit: 0, txCount: 0, storeIds: new Set() };
    const amount = Number(tx.grand_total || tx.subtotal_amount || 0);
    dailyMap[day].gross += amount;
    dailyMap[day].txCount++;
    if (tx.customer_id) dailyMap[day].storeIds.add(tx.customer_id);
    if (tx.payment_method === 'credit' || tx.payment_method === 'bill_to_bill') {
      dailyMap[day].credit += amount;
    } else {
      dailyMap[day].cash += amount;
    }
  }

  for (const r of (returns || [])) {
    const day = (r.created_at || '').slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { gross: 0, refund: 0, net: 0, cash: 0, credit: 0, txCount: 0, storeIds: new Set() };
    dailyMap[day].refund += Number(r.quantity || 0) * Number(r.unit_price || 0);
  }

  const dailyTrend = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      gross: d.gross,
      refund: d.refund,
      net: d.gross - d.refund,
      cash: d.cash,
      credit: d.credit,
      txCount: d.txCount,
      storeCount: d.storeIds.size,
    }));

  const totalGross = transactions.reduce((s, t) => s + Number(t.grand_total || t.subtotal_amount || 0), 0);
  const totalRefund = (returns || []).reduce((s, r) => s + Number(r.quantity || 0) * Number(r.unit_price || 0), 0);
  const totalExpense = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);

  // Product breakdown
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const items of Object.values(itemsMap)) {
    for (const item of items) {
      if (!productMap[item.product_name]) productMap[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
      productMap[item.product_name].qty += Number(item.quantity || 0);
      productMap[item.product_name].revenue += Number(item.subtotal || 0);
    }
  }
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  return NextResponse.json({
    weekLabel: label,
    dateStart: start.toISOString().split('T')[0],
    dateEnd: end.toISOString().split('T')[0],
    branch: branch || 'all',
    totalGross,
    totalRefund,
    totalNet: totalGross - totalRefund,
    totalExpense,
    netAfterExpense: totalGross - totalRefund - totalExpense,
    totalTransactions: transactions.length,
    dailyTrend,
    topProducts,
  });
}

// ============================================================================
// Helper: get all Mon–Sun weeks whose Monday falls inside the given month
// ============================================================================
function getMonthWeeks(year: number, month: number): Array<{ weekNum: number; start: Date; end: Date }> {
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);

  // Advance to the first Monday in the month
  const d = new Date(monthStart);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);

  const weeks: Array<{ weekNum: number; start: Date; end: Date }> = [];
  let weekNum = 1;
  while (d <= monthEnd) {
    const s = new Date(d);     s.setHours(0, 0, 0, 0);
    const e = new Date(d);     e.setDate(d.getDate() + 6); e.setHours(23, 59, 59, 999);
    weeks.push({ weekNum, start: s, end: e });
    weekNum++;
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

// ============================================================================
// Helper: categorise payment method → cash | transfer | credit
// ============================================================================
function paymentCategory(method: string): 'cash' | 'transfer' | 'credit' {
  const m = (method || '').toLowerCase();
  if (['credit', 'bill_to_bill', 'hutang', 'term', 'kredit'].some(k => m.includes(k))) return 'credit';
  if (['transfer', 'bank_transfer', 'ewallet', 'qr', 'online', 'tng', 'boost', 'grab', 'maybank', 'cimb', 'rhb'].some(k => m.includes(k))) return 'transfer';
  return 'cash';
}

function normalizeToken(value: string) {
  return (value || '').toUpperCase().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectWeightVariant(value: string) {
  const t = normalizeToken(value);
  const m = t.match(/(\d+(?:\.\d+)?)\s*(KG|G)\b/);
  if (!m) return '';
  return `${m[1]}${m[2]}`;
}

function variantSortKey(variant: string): number {
  const t = normalizeToken(variant);
  const unit = t.match(/(\d+(?:\.\d+)?)(KG|G)\b/);
  if (!unit) return 0;
  const n = Number(unit[1]);
  if (Number.isNaN(n)) return 0;
  return unit[2] === 'KG' ? n * 1000 : n;
}

function brandRank(brand: string): number {
  const b = normalizeToken(brand);
  const ordered = ['MB', 'CB', 'PATTY BURGER', 'BB', 'DAGING', 'MAGELLO'];
  const idx = ordered.indexOf(b);
  return idx === -1 ? 999 : idx;
}

function brandVariantRank(brand: string, variant: string): number {
  const b = normalizeToken(brand);
  const v = normalizeToken(variant);

  const map: Record<string, string[]> = {
    MB: ['1KG', '800G', '600G', '500G', '500G B', '300G'],
    CB: ['800G', '500G'],
    'PATTY BURGER': ['AYAM', 'MIX', 'SAPI'],
    BB: ['PEDAS', 'BU', 'BM', 'BT'],
    DAGING: ['KISAR'],
    MAGELLO: ['MB', 'CB', 'FB'],
  };

  const list = map[b];
  if (!list) return 999;
  const idx = list.indexOf(v);
  return idx === -1 ? 999 : idx;
}

// ============================================================================
// Helper: parse product code → { brand, variant }
//   "MB1KG"     → { brand:"MB",           variant:"1KG"     }
//   "CB800G"    → { brand:"CB",           variant:"800G"    }
//   "BBPEDAS"   → { brand:"BB PEDAS",     variant:""        }
//   "MAGELLOCB" → { brand:"MAGELLO",      variant:"CB"      }
// ============================================================================
function parseBrandVariant(code: string, name: string): { brand: string; variant: string } {
  const c = normalizeToken(code || '');
  const n = normalizeToken(name || '');

  // Prefer explicit code if available, e.g. MB1KG or CB800G.
  if (c) {
    const m = c.match(/^([A-Z\s]+?)(\d.*)$/);
    if (m) return { brand: normalizeToken(m[1]), variant: normalizeToken(m[2]) };

    if (c.startsWith('MB')) return { brand: 'MB', variant: detectWeightVariant(c) || c.replace(/^MB\s*/, '') };
    if (c.startsWith('CB')) return { brand: 'CB', variant: detectWeightVariant(c) || c.replace(/^CB\s*/, '') };
    if (c.startsWith('BB')) return { brand: 'BB', variant: c.replace(/^BB\s*/, '') };
    if (c.startsWith('MAGELLO')) return { brand: 'MAGELLO', variant: c.replace(/^MAGELLO\s*/, '') };
    if (c.includes('DAGING')) return { brand: 'DAGING', variant: c.replace('DAGING', '').trim() || 'KISAR' };
  }

  // Fallback: infer from product name when product code is missing.
  if (/\bMB\b|MEATBALL/.test(n)) return { brand: 'MB', variant: detectWeightVariant(n) || n.replace(/.*\bMB\b\s*/, '').replace(/MEATBALL\s*/g, '').trim() || 'LAIN-LAIN' };
  if (/\bCB\b|CHICKEN BURGER/.test(n)) return { brand: 'CB', variant: detectWeightVariant(n) || n.replace(/.*\bCB\b\s*/, '').replace(/CHICKEN BURGER\s*/g, '').trim() || 'LAIN-LAIN' };
  if (/PATTY|BURGER/.test(n)) {
    let v = n;
    v = v.replace(/PATTY/g, '').replace(/BURGER/g, '').trim();
    return { brand: 'PATTY BURGER', variant: v || 'MIX' };
  }
  if (/\bBB\b|BEBOLA BEREMPAH|PEDAS/.test(n)) return { brand: 'BB', variant: n.replace(/.*\bBB\b\s*/, '').replace(/BEBOLA BEREMPAH\s*/g, '').trim() || 'PEDAS' };
  if (/DAGING/.test(n)) return { brand: 'DAGING', variant: n.replace('DAGING', '').trim() || 'KISAR' };
  if (/MAGELLO/.test(n)) return { brand: 'MAGELLO', variant: n.replace('MAGELLO', '').trim() || 'LAIN-LAIN' };

  const weight = detectWeightVariant(n);
  if (weight) {
    const root = n.replace(weight, '').trim().split(' ').slice(0, 2).join(' ');
    return { brand: root || n, variant: weight };
  }

  // Last fallback – keep full name as single-column product.
  return { brand: n || 'LAIN-LAIN', variant: '' };
}

// ============================================================================
// Helper: build one WEEK sheet (array-of-arrays with !merges for 2-row header)
// ============================================================================
interface ProductColDef {
  productName: string; // exact product_name in sales_items
  brand: string;
  variant: string;
}

const DEFAULT_TEMPLATE_COLS: ProductColDef[] = [
  { productName: '__MB_1KG__', brand: 'CB', variant: '1KG' },
  { productName: '__MB_800G__', brand: 'CB', variant: '800G' },
  { productName: '__MB_500G__', brand: 'CB', variant: '500G' },
  { productName: '__PB_DAGING__', brand: 'PARTY BURGER', variant: 'DAGING' },
  { productName: '__PB_AYAM__', brand: 'PARTY BURGER', variant: 'AYAM' },
  { productName: '__BBA_BB__', brand: 'BBA', variant: 'BB' },
  { productName: '__BBA_PEDAS__', brand: 'BBA', variant: 'PEDAS' },
];

function applyStyleForWeeklySheet(
  ws: XLSX.WorkSheet,
  totalRows: number,
  totalCols: number,
  amountColIdx: number,
  totalRowIdx: number,
) {
  const border = {
    top: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
  };

  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;

      const isNumeric = typeof ws[addr].v === 'number';
      const isHeader = r === 2 || r === 3;
      const isTitle = r === 0;
      const isTotal = r === totalRowIdx;
      const isAmountCol = c === amountColIdx;

      ws[addr].s = {
        font: {
          name: 'Calibri',
          sz: isTitle ? 12 : 10,
          bold: isTitle || isHeader || isTotal,
          color: { rgb: '000000' },
        },
        alignment: {
          vertical: 'center',
          horizontal: isTitle ? 'center' : (isNumeric ? 'right' : (isHeader ? 'center' : 'left')),
          wrapText: false,
        },
        border,
        numFmt: isNumeric ? '#,##0.00' : 'General',
      };

      if (isHeader) {
        ws[addr].s.fill = { fgColor: { rgb: r === 2 ? 'D9E1F2' : 'E6ECF8' } };
      }

      if (isAmountCol && r >= 2) {
        ws[addr].s.fill = { fgColor: { rgb: 'DBE5F1' } };
      }

      if (isTotal) {
        ws[addr].s.fill = { fgColor: { rgb: 'FFF200' } };
      }
    }
  }
}

function buildWeekSheet(
  title: string,
  transactions: Array<Record<string, unknown>>,
  itemsMap: Record<string, Array<{ product_name: string; quantity: number; subtotal: number }>>,
  customersById: Record<string, string>,
  productCols: ProductColDef[],
): { data: Array<Array<string | number>>; merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> } {
  // --- Build group spans ---
  type GroupSpan = { brand: string; startCol: number; count: number; isSingle: boolean };
  const groups: GroupSpan[] = [];
  for (let i = 0; i < productCols.length; ) {
    const brand = productCols[i].brand;
    let j = i;
    while (j < productCols.length && productCols[j].brand === brand) j++;
    const count = j - i;
    groups.push({ brand, startCol: 3 + i, count, isSingle: count === 1 });
    i = j;
  }

  const totalCols = 3 + productCols.length + 1; // DATE + INV + CUST + products + AMOUNT

  // --- Row 0: title (merged across all cols) ---
  const titleRow: Array<string | number> = [title, ...Array(totalCols - 1).fill('')];

  // --- Row 1: blank ---
  const blankRow: Array<string | number> = Array(totalCols).fill('');

  // --- Row 2: brand header ---
  const brandRow: Array<string | number> = ['DATE', 'INV NO', 'CUSTOMER'];
  for (const g of groups) {
    brandRow.push(g.brand);
    for (let k = 1; k < g.count; k++) brandRow.push('');
  }
  brandRow.push('AMOUNT (RM)');

  // --- Row 3: variant sub-header ---
  const variantRow: Array<string | number> = ['', '', ''];
  for (const pc of productCols) {
    variantRow.push(pc.variant || pc.brand);
  }
  variantRow.push('');

  // --- Build merges ---
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
  // Title merge row 0
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
  // Fixed cols merge rows 2–3
  merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }); // DATE
  merges.push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }); // INV NO
  merges.push({ s: { r: 2, c: 2 }, e: { r: 3, c: 2 } }); // CUSTOMER
  // AMOUNT merge rows 2–3
  merges.push({ s: { r: 2, c: totalCols - 1 }, e: { r: 3, c: totalCols - 1 } });
  // Brand group merges on row 2
  for (const g of groups) {
    if (g.count > 1) {
      merges.push({ s: { r: 2, c: g.startCol }, e: { r: 2, c: g.startCol + g.count - 1 } });
    } else {
      // Single product – merge rows 2-3 for that column
      merges.push({ s: { r: 2, c: g.startCol }, e: { r: 3, c: g.startCol } });
    }
  }

  // --- Data rows ---
  const dataRows: Array<Array<string | number>> = [];
  let totalAmount = 0;
  const productTotals: Record<string, number> = {};

  for (const tx of transactions) {
    const amount = Number(tx.grand_total || tx.subtotal_amount || 0);
    totalAmount += amount;
    const txItems = itemsMap[String(tx.id)] || [];
    // Map product → subtotal
    const itemAmts: Record<string, number> = {};
    for (const it of txItems) {
      itemAmts[it.product_name] = (itemAmts[it.product_name] || 0) + Number(it.subtotal || 0);
    }
    const pCols = productCols.map(pc => {
      const v = itemAmts[pc.productName] || 0;
      productTotals[pc.productName] = (productTotals[pc.productName] || 0) + v;
      return v > 0 ? v : '';
    });
    dataRows.push([
      fmtDate(String(tx.transaction_date || tx.created_at || '')),
      String(tx.invoice || tx.receipt_no || tx.invoice_no || ''),
      customersById[String(tx.customer_id || '')] || String(tx.customer_name || '-'),
      ...pCols,
      amount,
    ]);
  }

  // --- TOTAL row ---
  const totalRow: Array<string | number> = [
    'TOTAL (RM)', '', '',
    ...productCols.map(pc => productTotals[pc.productName] || 0),
    totalAmount,
  ];

  const data: Array<Array<string | number>> = [
    titleRow, blankRow, brandRow, variantRow, ...dataRows, totalRow,
  ];

  return { data, merges };
}

// ============================================================================
// POST — generate & return weekly Excel (matching reference format)
// ============================================================================
export async function POST(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = normalizeRole(user.role);
  if (!canExportReports(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

  const body = await request.json();
  // Support: { month: "2026-02", branch } for full-month (all weeks)
  //          { date: "2026-02-05", branch } for single-week (backward compat)
  const { date, month: monthParam, branch: reqBranch } = body as {
    date?: string;
    month?: string;
    branch?: string;
  };
  const branch = role === 'Admin' ? (user.branch || '') : (reqBranch || '');

  // Determine date range + week list
  let startDate: Date, endDate: Date, reportMonthLabel: string;
  let weeks: Array<{ weekNum: number; start: Date; end: Date }>;

  if (monthParam) {
    const [yr, mo] = monthParam.split('-').map(Number);
    startDate = new Date(yr, mo - 1, 1, 0, 0, 0, 0);
    endDate   = new Date(yr, mo, 0, 23, 59, 59, 999);
    reportMonthLabel = startDate.toLocaleDateString('en-MY', { month: 'short', year: 'numeric' }).toUpperCase();
    weeks = getMonthWeeks(yr, mo);
  } else {
    const dateParam = date || new Date().toISOString().split('T')[0];
    const { start, end, label } = getWeekRange(dateParam);
    startDate = start;
    endDate   = end;
    reportMonthLabel = label;
    // Single week – wrap in array
    weeks = [{ weekNum: 1, start, end }];
  }

  const startISO = startDate.toISOString();
  const endISO   = endDate.toISOString();

  // ── Fetch data ──
  let txQuery = supabaseAdmin
    .from('sales_transactions')
    .select('*')
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at');
  if (branch) txQuery = txQuery.eq('branch', branch);
  const { data: txRows } = await txQuery;
  const transactions = (txRows || []) as Array<Record<string, unknown>>;

  // ── Fetch all sales items ──
  const saleIds = transactions.map((t) => t.id as string);
  type SaleItem = { transaction_id: string; product_name: string; quantity: number; subtotal: number };
  let allItems: SaleItem[] = [];
  if (saleIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('sales_items')
      .select('transaction_id,product_name,quantity,subtotal')
      .in('transaction_id', saleIds);
    allItems = (items || []) as SaleItem[];
  }

  // ── Build items map: txId → [{ product_name, quantity, subtotal }] ──
  const itemsMapByTx: Record<string, SaleItem[]> = {};
  for (const it of allItems) {
    if (!itemsMapByTx[it.transaction_id]) itemsMapByTx[it.transaction_id] = [];
    itemsMapByTx[it.transaction_id].push(it);
  }

  // ── Customer names — query both branch tables and merge ──
  const customerIds = [...new Set(transactions.map((t) => t.customer_id).filter(Boolean))] as string[];
  let customersById: Record<string, string> = {};
  if (customerIds.length > 0) {
    const [kbRes, kkRes] = await Promise.all([
      supabaseAdmin.from('customers_kb').select('id,name').in('id', customerIds),
      supabaseAdmin.from('customers_kk').select('id,name').in('id', customerIds),
    ]);
    const allCusts = [...(kbRes.data || []), ...(kkRes.data || [])];
    customersById = allCusts.reduce<Record<string, string>>((acc, c) => { acc[c.id] = c.name; return acc; }, {});
  }

  // ── Fetch products from products table for code-based grouping ──
  type ProductRecord = { id: string; name: string; code: string | null };
  let productsQuery = supabaseAdmin.from('products').select('id,name,code');
  if (branch) productsQuery = productsQuery.eq('branch', branch);
  const { data: productRecords } = await productsQuery;
  const productCodeByName: Record<string, string> = {};
  for (const p of (productRecords || []) as ProductRecord[]) {
    if (p.name) productCodeByName[p.name] = p.code || '';
  }

  // ── Approved returns & expenses for the period ──
  let rtQuery = supabaseAdmin
    .from('exchange_returns')
    .select('*')
    .in('status', ['approved', 'completed'])
    .gte('created_at', startISO)
    .lte('created_at', endISO);
  if (branch) rtQuery = rtQuery.eq('branch', branch);
  const { data: returns } = await rtQuery;

  let expQuery = supabaseAdmin
    .from('expenses')
    .select('*')
    .in('status', ['approved', 'paid'])
    .gte('expense_date', startDate.toISOString().split('T')[0])
    .lte('expense_date', endDate.toISOString().split('T')[0]);
  if (branch) expQuery = expQuery.eq('branch', branch);
  const { data: expenses } = await expQuery;

  // ──────────────────────────────────────────────────────────────────────────
  // Build product column definitions (sorted by brand → variant)
  // Uses product code to group: "MB1KG" → brand="MB", variant="1KG"
  // ──────────────────────────────────────────────────────────────────────────
  const allProductNames = [...new Set(allItems.map((i) => i.product_name).filter(Boolean))];

  const productColsAll: ProductColDef[] = allProductNames
    .map((pname) => {
      const code = productCodeByName[pname] || '';
      const { brand, variant } = parseBrandVariant(code, pname);
      return { productName: pname, brand, variant };
    })
    .sort((a, b) => {
      const rankDiff = brandRank(a.brand) - brandRank(b.brand);
      if (rankDiff !== 0) return rankDiff;

      const brandDiff = a.brand.localeCompare(b.brand);
      if (brandDiff !== 0) return brandDiff;

      const variantRankDiff = brandVariantRank(a.brand, a.variant) - brandVariantRank(b.brand, b.variant);
      if (variantRankDiff !== 0) return variantRankDiff;

      const wa = variantSortKey(a.variant);
      const wb = variantSortKey(b.variant);
      if (wa !== wb) return wb - wa;

      return a.variant.localeCompare(b.variant);
    });

  // ──────────────────────────────────────────────────────────────────────────
  // WORKBOOK
  // ──────────────────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // ── For each week, generate 3 sheets (CASH · TRANSFER · CREDIT) ──
  for (const week of weeks) {
    const weekTx = transactions.filter((t) => {
      const d = new Date(String(t.transaction_date || t.created_at || ''));
      return d >= week.start && d <= week.end;
    });

    // Determine products actually used this week
    const weekSaleIds = new Set(weekTx.map((t) => String(t.id)));
    const weekItems = allItems.filter((i) => weekSaleIds.has(i.transaction_id));
    const weekProductNames = new Set(weekItems.map((i) => i.product_name));
    const productColsResolved = productColsAll.filter((pc) => weekProductNames.has(pc.productName));
    const productCols = productColsResolved.length > 0 ? productColsResolved : DEFAULT_TEMPLATE_COLS;

    // Items map for this week
    const weekItemsMap: Record<string, SaleItem[]> = {};
    for (const it of weekItems) {
      if (!weekItemsMap[it.transaction_id]) weekItemsMap[it.transaction_id] = [];
      weekItemsMap[it.transaction_id].push(it);
    }

    const payGroups: Array<{ name: string; filter: (m: string) => boolean }> = [
      { name: `WEEK ${week.weekNum}`,             filter: (m) => paymentCategory(m) === 'cash'     },
      { name: `WEEK ${week.weekNum} (TRANSFER)`,  filter: (m) => paymentCategory(m) === 'transfer'  },
      { name: `WEEK ${week.weekNum} (CREDIT)`,    filter: (m) => paymentCategory(m) === 'credit'    },
    ];

    // Determine month abbreviation for sheet title
    const weekStartLabel = week.start.toLocaleDateString('en-MY', { month: 'short', year: 'numeric' }).toUpperCase();
    for (const pg of payGroups) {
      const filtered = weekTx.filter((t) => pg.filter(String(t.payment_method || '')));
      const sheetTitle = `WEEKLY SALES REPORT (${weekStartLabel} - WEEK ${week.weekNum})`;

      const { data, merges } = buildWeekSheet(sheetTitle, filtered, weekItemsMap, customersById, productCols);
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!merges'] = merges;
      ws['!cols'] = [
        { wch: 13 }, { wch: 14 }, { wch: 28 },
        ...productCols.map(() => ({ wch: 11 })),
        { wch: 14 },
      ];
      // Row heights: title row taller
      ws['!rows'] = [{ hpx: 20 }, { hpx: 6 }, { hpx: 16 }, { hpx: 16 }];

      const totalCols = 3 + productCols.length + 1;
      const amountColIdx = totalCols - 1;
      const totalRowIdx = data.length - 1;
      applyStyleForWeeklySheet(ws, data.length, totalCols, amountColIdx, totalRowIdx);

      XLSX.utils.book_append_sheet(wb, ws, pg.name);
    }
  }

  // ── SUMMARY sheet ──
  const tGross   = transactions.reduce((s, t) => s + Number(t.grand_total || t.subtotal_amount || 0), 0);
  const tRefund  = (returns || []).reduce((s: number, r: Record<string, unknown>) =>
    s + Number(r.quantity || 0) * Number(r.unit_price || 0), 0);
  const totalExp = (expenses || []).reduce((s: number, e: Record<string, unknown>) => s + Number(e.amount || 0), 0);

  type ProdRev = { name: string; rev: number };
  const topProds: ProdRev[] = Object.values(
    allItems.reduce<Record<string, ProdRev>>((acc, i) => {
      if (!acc[i.product_name]) acc[i.product_name] = { name: i.product_name, rev: 0 };
      acc[i.product_name].rev += Number(i.subtotal || 0);
      return acc;
    }, {})
  ).sort((a, b) => b.rev - a.rev).slice(0, 10);

  const summaryData: Array<Array<string | number>> = [
    [`WEEKLY SALES REPORT — ${reportMonthLabel}  |  Branch: ${branch || 'All Branches'}`],
    [`Tarikh: ${startDate.toLocaleDateString('ms-MY')} – ${endDate.toLocaleDateString('ms-MY')}`],
    [],
    ['METRIK', 'NILAI (RM)'],
    ['Jualan Kasar (Gross)', fmt(tGross)],
    ['Refund Diluluskan', fmt(tRefund)],
    ['Jualan Bersih (Net)', fmt(tGross - tRefund)],
    ['Jumlah Expenses', fmt(totalExp)],
    ['Net Selepas Expenses', fmt(tGross - tRefund - totalExp)],
    [],
    ['Jumlah Transaksi', transactions.length],
    ['Bil Refund', (returns || []).length],
    ['Bil Expenses', (expenses || []).length],
    [],
    ...weeks.map((w) => {
      const wTx = transactions.filter((t) => {
        const d = new Date(String(t.transaction_date || t.created_at || ''));
        return d >= w.start && d <= w.end;
      });
      const gross = wTx.reduce((s, t) => s + Number(t.grand_total || t.subtotal_amount || 0), 0);
      const cash  = wTx.filter((t) => paymentCategory(String(t.payment_method || '')) === 'cash').reduce((s, t) => s + Number(t.grand_total || t.subtotal_amount || 0), 0);
      const xfer  = wTx.filter((t) => paymentCategory(String(t.payment_method || '')) === 'transfer').reduce((s, t) => s + Number(t.grand_total || t.subtotal_amount || 0), 0);
      const cred  = wTx.filter((t) => paymentCategory(String(t.payment_method || '')) === 'credit').reduce((s, t) => s + Number(t.grand_total || t.subtotal_amount || 0), 0);
      return [`WEEK ${w.weekNum}  (${w.start.toLocaleDateString('ms-MY')} – ${w.end.toLocaleDateString('ms-MY')})`,
        `Gross: RM ${fmt(gross)}  |  Cash: RM ${fmt(cash)}  |  Transfer: RM ${fmt(xfer)}  |  Kredit: RM ${fmt(cred)}  |  Bil Tx: ${wTx.length}`];
    }),
    [],
    ['TOP PRODUK', 'HASIL (RM)'],
    ...topProds.map((p) => [p.name, fmt(p.rev)]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 50 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'SUMMARY');

  // ── REFUND LOG sheet ──
  const refundRows: Array<Array<string | number>> = [
    [`REFUND & RETURN LOG — ${reportMonthLabel}`],
    [],
    ['DATE', 'INVOICE', 'KEDAI', 'PRODUK', 'QTY', 'SEBAB', 'STATUS', 'APPROVED BY'],
    ...(returns || []).map((r: Record<string, unknown>) => [
      fmtDate(String(r.created_at || '')),
      String(r.invoice || '-'),
      customersById[String(r.customer_id || '')] || '-',
      String(r.product_name || ''),
      Number(r.quantity || 0),
      String(r.reason || ''),
      String(r.status || '').toUpperCase(),
      String(r.approved_by_name || r.approved_by || '-'),
    ]),
  ];
  const wsRefund = XLSX.utils.aoa_to_sheet(refundRows);
  wsRefund['!cols'] = [{ wch: 13 }, { wch: 18 }, { wch: 26 }, { wch: 22 }, { wch: 7 }, { wch: 18 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsRefund, 'REFUND LOG');

  // ── EXPENSES sheet ──
  const expRows: Array<Array<string | number>> = [
    [`COMPANY EXPENSES — ${reportMonthLabel}`],
    [],
    ['DATE', 'STAFF', 'KATEGORI', 'KETERANGAN', 'AMOUNT (RM)', 'STATUS', 'APPROVED BY'],
    ...(expenses || []).map((e: Record<string, unknown>) => [
      String(e.expense_date || ''),
      String(e.salesman_name || ''),
      String(e.category || ''),
      String(e.description || '-'),
      Number(e.amount || 0),
      String(e.status || '').toUpperCase(),
      String(e.approved_by_name || '-'),
    ]),
    [],
    ['TOTAL', '', '', '', totalExp, '', ''],
  ];
  const wsExp = XLSX.utils.aoa_to_sheet(expRows);
  wsExp['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsExp, 'EXPENSES');

  // ── Generate buffer & return ──
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const safeMonth = monthParam || (date || new Date().toISOString().split('T')[0]).slice(0, 7);
  const fileName  = `WeeklyReport_${safeMonth}_${branch || 'All'}.xlsx`;

  await logAuditEvent({
    actor: user,
    module: 'reports',
    action: 'export_weekly_excel',
    branch: branch || user.branch,
    status: 'success',
    metadata: { month: safeMonth, branch, txCount: transactions.length },
  });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
