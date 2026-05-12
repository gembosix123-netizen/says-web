import { supabaseAdmin } from '@/lib/supabase';
import type { DailyReport } from '@/types';
import { getSalesSourceDailyReportsForUser } from '@/lib/salesmanDailyReportLibrary.server';
import {
  branchLabelsEquivalent,
  buildSalesBranchOrFilter,
  normalizeBranchLabel,
} from '@/lib/branchPermissions';

const SALES_TABLE = 'sales_transactions';

export type SalesDailyGateReason = 'notSubmitted' | 'pendingApproval' | 'returned';

export type SalesDailyGateBlock = {
  blocked: true;
  reason: SalesDailyGateReason;
  dateYmd: string;
  dateLabelMs: string;
  dateLabelEn: string;
  titleMs: string;
  titleEn: string;
  bodyMs: string;
  bodyEn: string;
};

export type SalesDailyGateResult = { blocked: false } | SalesDailyGateBlock;

function normalizeReportStatus(status: unknown): string {
  const LEGACY: Record<string, string> = {
    submitted: 'submitted_daily',
    reviewed: 'submitted_daily',
    approved: 'approved_daily',
    returned: 'returned_daily',
  };
  if (typeof status !== 'string') return 'draft';
  return LEGACY[status] || status;
}

/** Daily stage selesai untuk tujuan benarkan jualan baharu (Main Admin lulus atau sudah alih weekly/monthly). */
function isDailyStageClearedForNewSales(statusRaw: string): boolean {
  const s = normalizeReportStatus(statusRaw);
  if (s === 'approved_daily') return true;
  return (
    s === 'submitted_weekly' ||
    s === 'approved_weekly' ||
    s === 'returned_weekly' ||
    s === 'submitted_monthly' ||
    s === 'approved_monthly' ||
    s === 'returned_monthly'
  );
}

function reasonForReport(report: DailyReport | undefined): SalesDailyGateReason | null {
  if (!report) return 'notSubmitted';
  const s = normalizeReportStatus(report.status);
  if (isDailyStageClearedForNewSales(s)) return null;
  if (s === 'returned_daily') return 'returned';
  if (s === 'submitted_daily') return 'pendingApproval';
  return 'notSubmitted';
}

function ymdFromCreatedAt(createdAt: string | null | undefined): string | null {
  if (!createdAt || typeof createdAt !== 'string') return null;
  const ymd = createdAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function formatDateLabels(ymd: string): { dateLabelMs: string; dateLabelEn: string } {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) {
    return { dateLabelMs: ymd, dateLabelEn: ymd };
  }
  const local = new Date(y, m - 1, d);
  return {
    dateLabelMs: local.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }),
    dateLabelEn: local.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

function buildDialogCopy(
  reason: SalesDailyGateReason,
  dateLabelMs: string,
  dateLabelEn: string
): Pick<SalesDailyGateBlock, 'titleMs' | 'titleEn' | 'bodyMs' | 'bodyEn'> {
  const titles = {
    titleMs: 'Jualan baharu tidak tersedia',
    titleEn: 'New sales unavailable',
  };
  if (reason === 'notSubmitted') {
    return {
      ...titles,
      bodyMs: `Laporan harian untuk tarikh ${dateLabelMs} belum dihantar. Sila hantar dahulu sebelum membuat jualan baharu.`,
      bodyEn: `The daily report for ${dateLabelEn} has not been submitted. Please submit it before creating new sales.`,
    };
  }
  if (reason === 'pendingApproval') {
    return {
      ...titles,
      bodyMs:
        'Laporan harian anda sedang menunggu kelulusan Main Admin. Anda akan boleh membuat jualan baharu selepas diluluskan.',
      bodyEn:
        'Your daily report is pending Main Admin approval. You will be able to create new sales once it is approved.',
    };
  }
  return {
    ...titles,
    bodyMs:
      'Laporan harian dikembalikan untuk pembetulan. Sila semak nota admin, kemas kini laporan, dan hantar semula.',
    bodyEn:
      'Your daily report was returned for corrections. Please review the admin notes, update the report, and resubmit.',
  };
}

function pickReportForDate(reports: DailyReport[], dateYmd: string): DailyReport | undefined {
  const candidates = reports.filter((r) => r.date === dateYmd && r.source === 'sales');
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  return candidates.reduce((best, r) => {
    const tNew = new Date(r.updatedAt || r.submittedAt || 0).getTime();
    const tBest = new Date(best.updatedAt || best.submittedAt || 0).getTime();
    return tNew >= tBest ? r : best;
  });
}

/**
 * Kira sekatan tanpa ambil kira bypass HQ — untuk auto-reset bypass bila tertunggak sudah selesai.
 */
export async function computeSalesDailyReportGateBlock(
  userId: string,
  branch: string | undefined | null
): Promise<SalesDailyGateResult> {
  if (!supabaseAdmin) {
    return { blocked: false };
  }

  const br = String(branch || '').trim();
  let query = supabaseAdmin
    .from(SALES_TABLE)
    .select('created_at, voided_at, status, branch')
    .eq('user_id', userId);

  if (br && br !== 'all') {
    const orFragment = buildSalesBranchOrFilter(br);
    if (orFragment) {
      query = query.or(orFragment);
    } else {
      query = query.ilike('branch', normalizeBranchLabel(br));
    }
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error('[computeSalesDailyReportGateBlock]', error);
    return { blocked: false };
  }

  const saleDates = new Set<string>();
  for (const row of rows || []) {
    const rec = row as { branch?: string; voided_at?: string | null; status?: string; created_at?: string };
    if (!branchLabelsEquivalent(rec.branch, br)) continue;
    if (rec.voided_at || rec.status === 'voided') continue;
    const ymd = ymdFromCreatedAt(rec.created_at);
    if (ymd) saleDates.add(ymd);
  }

  if (saleDates.size === 0) {
    return { blocked: false };
  }

  const reports = await getSalesSourceDailyReportsForUser(userId);
  const sortedDates = [...saleDates].sort();

  for (const d of sortedDates) {
    const report = pickReportForDate(reports, d);
    const why = reasonForReport(report);
    if (why !== null) {
      const { dateLabelMs, dateLabelEn } = formatDateLabels(d);
      const dialog = buildDialogCopy(why, dateLabelMs, dateLabelEn);
      return {
        blocked: true,
        reason: why,
        dateYmd: d,
        dateLabelMs,
        dateLabelEn,
        ...dialog,
      };
    }
  }

  return { blocked: false };
}

async function clearBypassSalesDailyGate(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin
    .from('users')
    .update({ bypass_sales_daily_gate: false, bypass_sales_daily_gate_scope_date: null })
    .eq('id', userId)
    .eq('bypass_sales_daily_gate', true);
  if (error) {
    console.warn('[evaluateSalesNewSaleBlocked] clear bypass failed:', error.message);
  }
}

/**
 * Jurujual (Sales): sekatan jualan baharu jika ada hari dengan jualan aktif
 * tetapi laporan harian `source: sales` belum lulus peringkat harian (Main Admin).
 *
 * **Bypass HQ** (`bypass_sales_daily_gate` + `bypass_sales_daily_gate_scope_date`):
 * hanya melindungi **episod tertunggak pada tarikh skop** (tarikh tertunggak paling awal semasa Main Admin aktifkan).
 * Jika kepala tertunggak berubah ke tarikh lain, bypass **tidak** digunakan — jurujual perlu selesaikan atau HQ aktifkan bypass baharu.
 * Bila tiada lagi tertunggak, bypass + skop **dipadamkan automatik**.
 */
export async function evaluateSalesNewSaleBlocked(params: {
  userId: string;
  branch: string | undefined | null;
}): Promise<SalesDailyGateResult> {
  const { userId, branch } = params;
  if (!supabaseAdmin) {
    return { blocked: false };
  }

  const { data: gateUser, error: gateUserErr } = await supabaseAdmin
    .from('users')
    .select('bypass_sales_daily_gate, bypass_sales_daily_gate_scope_date')
    .eq('id', userId)
    .maybeSingle();

  const bypassActive = !gateUserErr && gateUser?.bypass_sales_daily_gate === true;
  const scopeRaw = (gateUser as { bypass_sales_daily_gate_scope_date?: unknown } | null)
    ?.bypass_sales_daily_gate_scope_date;
  const scopeDate =
    typeof scopeRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(scopeRaw)
      ? scopeRaw
      : typeof scopeRaw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(scopeRaw)
        ? scopeRaw.slice(0, 10)
        : null;

  const core = await computeSalesDailyReportGateBlock(userId, branch);

  if (!core.blocked && bypassActive) {
    await clearBypassSalesDailyGate(userId);
  }

  if (core.blocked && bypassActive) {
    if (!scopeDate) {
      return core;
    }
    if (scopeDate !== core.dateYmd) {
      return core;
    }
    return { blocked: false };
  }

  return core;
}
