import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { evaluateSalesNewSaleBlocked } from '@/lib/salesDailyReportGate';

/**
 * GET — Sales: adakah jualan baharu disekat kerana laporan harian tertunggak.
 */
export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = normalizeRole(user.role);
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
