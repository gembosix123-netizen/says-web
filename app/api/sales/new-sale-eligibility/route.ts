import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import {
  computeSalesDailyReportGateBlock,
  evaluateSalesNewSaleBlocked,
} from '@/lib/salesDailyReportGate';
import { supabaseAdmin } from '@/lib/supabase';

function parseBypassScopeDate(raw: unknown): string | null {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return null;
}

/**
 * GET — Sales: adakah jualan baharu disekat kerana laporan harian tertunggak.
 * GET — Main Admin + `?userId=` (Sales sahaja): status terperinci untuk skrin pengurusan HQ.
 */
export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const forUserId = request.nextUrl.searchParams.get('userId');
  const role = normalizeRole(user.role);

  if (forUserId) {
    if (role !== 'Main Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const idTrim = forUserId.trim();
    if (!idTrim || idTrim === 'undefined' || idTrim === 'null') {
      return NextResponse.json({ error: 'Parameter userId tidak sah / Invalid userId' }, { status: 400 });
    }

    /** `select('*')` elak ralat jika kolum baharu (contoh skop bypass) belum dimigrasi — jangan senaraikan kolum secara eksplisit. */
    const { data: target, error: targetErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', idTrim)
      .maybeSingle();

    if (targetErr) {
      console.error('[new-sale-eligibility] admin user lookup:', targetErr.message, targetErr);
      return NextResponse.json(
        {
          error: `Gagal memuat rekod pengguna dari pangkalan data: ${targetErr.message}. Bukan "tiada pengguna" — semak kolum / migrasi Supabase. / Database lookup failed (see message).`,
        },
        { status: 500 }
      );
    }
    if (!target) {
      return NextResponse.json(
        {
          error:
            'Tiada pengguna dengan ID tersebut dalam jadual `users` (Supabase). Pastikan akaun dicipta di pangkalan yang sama dan ID pada kad pengguna betul. / No user row for this id in Supabase `users`.',
        },
        { status: 404 }
      );
    }
    if (normalizeRole(String(target.role)) !== 'Sales') {
      return NextResponse.json({ error: 'Hanya untuk akaun Sales / Sales accounts only' }, { status: 400 });
    }

    const row = target as Record<string, unknown>;
    const bypassActive = row.bypass_sales_daily_gate === true;
    const bypassScopeDate = parseBypassScopeDate(row.bypass_sales_daily_gate_scope_date);

    const core = await computeSalesDailyReportGateBlock(String(target.id), String(target.branch || ''));
    const effective = await evaluateSalesNewSaleBlocked({
      userId: String(target.id),
      branch: target.branch,
    });

    const coreBlocked = core.blocked === true;
    const effectiveBlocked = effective.blocked === true;

    const payload: Record<string, unknown> = {
      lookup: 'admin_sales_gate',
      coreBlocked,
      effectiveBlocked,
      bypassActive,
      bypassScopeDate,
    };

    if (coreBlocked) {
      payload.gate = {
        reason: core.reason,
        dateYmd: core.dateYmd,
        dateLabelMs: core.dateLabelMs,
        dateLabelEn: core.dateLabelEn,
        titleMs: core.titleMs,
        titleEn: core.titleEn,
        bodyMs: core.bodyMs,
        bodyEn: core.bodyEn,
      };
    }

    return NextResponse.json(payload);
  }

  if (role !== 'Sales') {
    return NextResponse.json({ blocked: false, role });
  }

  const gate = await evaluateSalesNewSaleBlocked({
    userId: user.id,
    branch: user.branch,
  });

  if (!gate.blocked) {
    return NextResponse.json({ blocked: false });
  }

  return NextResponse.json({
    blocked: true,
    reason: gate.reason,
    dateYmd: gate.dateYmd,
    dateLabelMs: gate.dateLabelMs,
    dateLabelEn: gate.dateLabelEn,
    titleMs: gate.titleMs,
    titleEn: gate.titleEn,
    bodyMs: gate.bodyMs,
    bodyEn: gate.bodyEn,
  });
}
