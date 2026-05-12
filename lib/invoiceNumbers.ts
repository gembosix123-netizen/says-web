import type { SupabaseClient } from '@supabase/supabase-js';

const SALES_TABLE = 'sales_transactions';
const INVOICES_TABLE = 'invoices';

function isMissingInvoicesTableError(error: unknown): boolean {
  const m = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    m.includes('invoices') &&
    (m.includes('does not exist') || m.includes('schema cache') || m.includes('relation') || m.includes('not find'))
  );
}

/** Same rules as legacy sales route: initials from branch label, max 4 chars. */
export function normalizeBranchCode(branch = 'XX'): string {
  const compact = branch
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  if (!compact) return 'XX';

  const parts = compact.split(/\s+/).filter(Boolean);
  const initials = parts.map((part) => part[0]).join('').slice(0, 4);
  return initials || compact.slice(0, 4);
}

/** Calendar YYYYMMDD in Asia/Kuala_Lumpur (business day alignment). */
export function ymdInMalaysia(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}${m}${d}`;
}

/** Prefix including trailing hyphen before the 4-digit sequence, e.g. INV-KK-20260512- */
export function invoiceNumberPrefix(branch: string, ymd: string): string {
  return `INV-${normalizeBranchCode(branch)}-${ymd}-`;
}

function maxSeqFromStrings(prefix: string, values: string[]): number {
  let max = 0;
  for (const inv of values) {
    if (!inv.startsWith(prefix)) continue;
    const tail = inv.slice(prefix.length);
    if (!/^\d{4}$/.test(tail)) continue;
    const n = parseInt(tail, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

async function listInvoiceStringsForPrefix(
  client: SupabaseClient,
  prefix: string
): Promise<string[]> {
  const out: string[] = [];

  const { data: salesRows, error: salesErr } = await client
    .from(SALES_TABLE)
    .select('invoice')
    .like('invoice', `${prefix}%`);

  if (salesErr) {
    throw new Error(`Failed to list sales invoices: ${salesErr.message}`);
  }
  for (const row of salesRows || []) {
    const inv = row.invoice as string | null | undefined;
    if (typeof inv === 'string' && inv) out.push(inv);
  }

  const { data: invoiceRows, error: invErr } = await client
    .from(INVOICES_TABLE)
    .select('invoice_no')
    .like('invoice_no', `${prefix}%`);

  if (invErr) {
    if (isMissingInvoicesTableError(invErr)) {
      console.warn('[invoiceNumbers] Table `invoices` not in schema; using sales_transactions only for numbering.');
    } else {
      throw new Error(`Failed to list invoices: ${invErr.message}`);
    }
  } else {
    for (const row of invoiceRows || []) {
      const inv = row.invoice_no as string | null | undefined;
      if (typeof inv === 'string' && inv) out.push(inv);
    }
  }

  return out;
}

async function invoiceExists(client: SupabaseClient, candidate: string): Promise<boolean> {
  const { data: s } = await client.from(SALES_TABLE).select('id').eq('invoice', candidate).maybeSingle();
  if (s) return true;
  const { data: i, error: invErr } = await client
    .from(INVOICES_TABLE)
    .select('id')
    .eq('invoice_no', candidate)
    .maybeSingle();
  if (invErr) {
    if (isMissingInvoicesTableError(invErr)) {
      return false;
    }
    throw new Error(`Failed to check invoices table: ${invErr.message}`);
  }
  return Boolean(i);
}

/**
 * Next INV-{branch}-{YYYYMMDD}-{0001} unique across sales_transactions.invoice
 * and (if table exists) invoices.invoice_no.
 */
export async function generateUniqueInvoiceNo(
  client: SupabaseClient,
  branch: string
): Promise<string> {
  const ymd = ymdInMalaysia();
  const prefix = invoiceNumberPrefix(branch, ymd);

  for (let i = 0; i < 16; i += 1) {
    const existing = await listInvoiceStringsForPrefix(client, prefix);
    const max = maxSeqFromStrings(prefix, existing);
    const next = max + 1;
    if (next > 9999) {
      throw new Error('Nombor invois harian melebihi had 9999 untuk cawangan ini.');
    }
    const candidate = `${prefix}${String(next).padStart(4, '0')}`;
    const exists = await invoiceExists(client, candidate);
    if (!exists) {
      return candidate;
    }
  }

  throw new Error('Gagal menjana nombor invois unik. Sila cuba lagi.');
}
