import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { branchLabelsEquivalent } from '@/lib/branchPermissions';

const TABLE = 'sales_void_otp_challenges';
const SALES_TABLE = 'sales_transactions';

function isMissingRelationError(error: unknown): boolean {
  const m = String((error as { message?: string })?.message || '').toLowerCase();
  return m.includes('does not exist') || m.includes('schema cache') || m.includes('relation');
}

/**
 * POST /api/sales/[id]/void/otp — Admin jana kod 6 digit (TTL 15 min) sebelum POST void.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Hanya admin boleh jana OTP void.' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { id: saleId } = await context.params;
    if (!saleId) {
      return NextResponse.json({ error: 'Missing sale id' }, { status: 400 });
    }

    const { data: sale, error: saleErr } = await supabaseAdmin
      .from(SALES_TABLE)
      .select('id, voided_at, branch')
      .eq('id', saleId)
      .maybeSingle();

    if (saleErr || !sale) {
      return NextResponse.json({ error: 'Jualan tidak dijumpai.' }, { status: 404 });
    }
    if (sale.voided_at) {
      return NextResponse.json({ error: 'Invois sudah dibatalkan.' }, { status: 409 });
    }

    const saleBranch = String((sale as { branch?: string }).branch || '');
    if (role === 'Admin' && currentUser.branch && !branchLabelsEquivalent(saleBranch, currentUser.branch)) {
      return NextResponse.json({ error: 'Anda hanya boleh jana OTP untuk jualan cawangan anda.' }, { status: 403 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const insertPayload: Record<string, unknown> = {
      sale_id: saleId,
      code,
      expires_at: expiresAt,
      created_by: currentUser.id,
    };

    const { error: insErr } = await supabaseAdmin.from(TABLE).insert(insertPayload);

    if (insErr) {
      if (isMissingRelationError(insErr)) {
        return NextResponse.json(
          {
            error: 'Jadual OTP belum wujud. Jalankan migrasi `20260516_sales_void_otp_challenges.sql` di Supabase.',
          },
          { status: 503 }
        );
      }
      console.error('[void/otp] insert failed:', insErr);
      return NextResponse.json({ error: 'Gagal menjana OTP.', details: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      code,
      expiresAt,
      message: 'Beritahu kod ini kepada admin yang meluluskan void (contoh WhatsApp). Kod luput dalam 15 minit.',
    });
  } catch (e) {
    console.error('POST /api/sales/[id]/void/otp:', e);
    return NextResponse.json({ error: 'Ralat pelayan' }, { status: 500 });
  }
}
