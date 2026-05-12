import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { db } from '@/lib/db';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { logAuditEvent } from '@/lib/audit';
import {
  getCustomersTableByBranch,
  type Branch,
  branchLabelsEquivalent,
} from '@/lib/branchPermissions';
import { VanInventory } from '@/types';

const SALES_TABLE = 'sales_transactions';
const SALES_ITEMS_TABLE = 'sales_items';
const VOID_OTP_TABLE = 'sales_void_otp_challenges';

function isMissingRelationError(error: unknown): boolean {
  const m = String((error as { message?: string })?.message || '').toLowerCase();
  return m.includes('does not exist') || m.includes('schema cache') || m.includes('relation');
}

async function verifyVoidOtpChallenge(
  client: NonNullable<typeof supabaseAdmin>,
  saleId: string,
  otpInput: string,
  required: boolean
): Promise<
  | { ok: true; challengeId?: string }
  | { ok: false; message: string; status: number; details?: string }
> {
  if (!required && !otpInput) {
    return { ok: true };
  }
  if (required && !otpInput) {
    return {
      ok: false,
      status: 400,
      message: 'Kod OTP diperlukan. Klik "Jana OTP" pada modal yang sama, kemudian masukkan kod.',
    };
  }
  if (!otpInput) {
    return { ok: true };
  }

  const { data: rows, error } = await client
    .from(VOID_OTP_TABLE)
    .select('id, code, expires_at')
    .eq('sale_id', saleId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingRelationError(error)) {
      if (required) {
        return {
          ok: false,
          status: 503,
          message: 'Jadual OTP belum wujud.',
          details: 'Jalankan migrasi `20260516_sales_void_otp_challenges.sql` di Supabase.',
        };
      }
      if (otpInput) {
        return {
          ok: false,
          status: 503,
          message: 'OTP dihantar tetapi jadual OTP belum dicipta.',
          details: 'Jalankan migrasi `20260516_sales_void_otp_challenges.sql` atau kosongkan medan OTP.',
        };
      }
      return { ok: true };
    }
    return { ok: false, status: 500, message: 'Gagal semak OTP.', details: error.message };
  }

  const row = Array.isArray(rows) ? rows[0] : null;
  const stored = String(row?.code ?? '').trim();
  if (!row || stored !== otpInput) {
    return {
      ok: false,
      status: 400,
      message: 'OTP tidak sah atau telah luput. Jana OTP baharu dan cuba lagi.',
    };
  }

  /** Jangan set `used_at` di sini — tunggu sehingga UPDATE jualan void berjaya, supaya cuba semula masih boleh guna OTP yang sama. */
  return { ok: true, challengeId: String(row.id) };
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    message.includes(columnName.toLowerCase()) &&
    (message.includes('column') ||
      message.includes('schema cache') ||
      message.includes('does not exist'))
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || '');
  return code === '23503';
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let vanRollback: { inventoryId: string; userId: string; previousItems: Record<string, number> } | null =
    null;

  try {
    const currentUser = getSessionUserFromRequest(request);
    if (!currentUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(currentUser.role);
    if (role !== 'Admin' && role !== 'Main Admin') {
      return NextResponse.json({ error: 'Hanya admin boleh membatalkan invois.' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { id: saleId } = await context.params;
    if (!saleId) {
      return NextResponse.json({ error: 'Missing sale id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const remarks = String(body?.remarks ?? body?.void_remarks ?? '').trim();
    if (!remarks) {
      return NextResponse.json({ error: 'remarks diperlukan (sebab pembatalan).' }, { status: 400 });
    }

    const { data: saleRow, error: fetchErr } = await supabaseAdmin
      .from(SALES_TABLE)
      .select('*')
      .eq('id', saleId)
      .maybeSingle();

    if (fetchErr || !saleRow) {
      return NextResponse.json({ error: 'Jualan tidak dijumpai.' }, { status: 404 });
    }

    const sale = saleRow as Record<string, unknown>;

    if (sale.voided_at) {
      return NextResponse.json({ error: 'Invois ini sudah dibatalkan.' }, { status: 409 });
    }

    const saleBranch = String(sale.branch || '');
    if (role === 'Admin' && currentUser.branch && !branchLabelsEquivalent(saleBranch, currentUser.branch)) {
      return NextResponse.json({ error: 'Anda hanya boleh batalkan jualan cawangan anda.' }, { status: 403 });
    }

    const paymentMethod = String(sale.payment_method || '').toLowerCase();
    const saleStatus = String(sale.status || '').toLowerCase();
    const isCreditPending = paymentMethod === 'bill_to_bill' && saleStatus === 'pending';

    if (paymentMethod === 'bill_to_bill' && saleStatus === 'completed') {
      return NextResponse.json(
        {
          error:
            'Invois kredit yang telah dibayar tidak boleh dibatalkan secara automatik. Hubungi HQ / akauntan untuk penyeliaan manual.',
        },
        { status: 409 }
      );
    }

    const voidOtpRequired =
      process.env.VOID_OTP_REQUIRED === 'true' || process.env.VOID_OTP_REQUIRED === '1';
    const otpInput = String((body as { otp?: string }).otp ?? '').trim();
    const otpResult = await verifyVoidOtpChallenge(supabaseAdmin, saleId, otpInput, voidOtpRequired);
    if (!otpResult.ok) {
      return NextResponse.json(
        { error: otpResult.message, details: otpResult.details },
        { status: otpResult.status }
      );
    }
    const voidOtpChallengeId = otpResult.challengeId;

    const originalGrand = Number(sale.grand_total ?? sale.subtotal_amount ?? 0);
    const originalSubtotal = Number(sale.subtotal_amount ?? originalGrand);

    const { data: itemRows } = await supabaseAdmin
      .from(SALES_ITEMS_TABLE)
      .select('product_id, quantity')
      .eq('transaction_id', saleId);

    const userIdForVan = String(sale.user_id || '');
    if (userIdForVan) {
      const inventoryId = `van_${userIdForVan}`;
      const currentVan = (await db.vanInventories.getById(inventoryId)) as VanInventory | null;
      const previousItems = { ...(currentVan?.items || {}) };
      vanRollback = { inventoryId, userId: userIdForVan, previousItems };

      const vanItems = { ...previousItems };
      for (const row of itemRows || []) {
        const pid = String(row.product_id || '');
        const qty = Number(row.quantity || 0);
        if (!pid || !Number.isFinite(qty) || qty <= 0) continue;
        vanItems[pid] = (vanItems[pid] || 0) + qty;
      }
      await db.vanInventories.save({
        id: inventoryId,
        userId: userIdForVan,
        items: vanItems,
        lastUpdated: new Date().toISOString(),
      });
    }

    let balanceRollback: {
      customersTable: string;
      customerId: string;
      restoreTo: number;
    } | null = null;

    if (isCreditPending && sale.customer_id) {
      try {
        const customersTable = getCustomersTableByBranch(saleBranch as Branch | undefined);
        const cid = String(sale.customer_id);

        let customer: {
          current_balance?: number | string | null;
          outstandingBalance?: number | string | null;
        } | null = null;

        const firstRead = await supabaseAdmin
          .from(customersTable)
          .select('current_balance, outstandingBalance')
          .eq('id', cid)
          .maybeSingle();

        if (!firstRead.error) {
          customer = firstRead.data;
        } else if (isMissingColumnError(firstRead.error, 'outstandingBalance')) {
          const fb = await supabaseAdmin.from(customersTable).select('current_balance').eq('id', cid).maybeSingle();
          customer = fb.data as { current_balance?: number | string | null } | null;
        } else if (isMissingColumnError(firstRead.error, 'current_balance')) {
          const fb = await supabaseAdmin.from(customersTable).select('outstandingBalance').eq('id', cid).maybeSingle();
          customer = fb.data as { outstandingBalance?: number | string | null } | null;
        }

        const currentBalance = Number(customer?.current_balance ?? customer?.outstandingBalance ?? 0);
        const reversal = Number(originalGrand);
        const newBalance = Math.max(0, currentBalance - reversal);
        balanceRollback = { customersTable, customerId: cid, restoreTo: currentBalance };

        const fullUpdate = await supabaseAdmin
          .from(customersTable)
          .update({
            current_balance: newBalance,
            outstandingBalance: newBalance,
          })
          .eq('id', cid);

        if (fullUpdate.error && isMissingColumnError(fullUpdate.error, 'outstandingBalance')) {
          await supabaseAdmin.from(customersTable).update({ current_balance: newBalance }).eq('id', cid);
        } else if (fullUpdate.error && isMissingColumnError(fullUpdate.error, 'current_balance')) {
          await supabaseAdmin.from(customersTable).update({ outstandingBalance: newBalance }).eq('id', cid);
        }
      } catch (e) {
        console.error('[void sale] customer balance reversal failed:', e);
        if (vanRollback) {
          await db.vanInventories.save({
            id: vanRollback.inventoryId,
            userId: vanRollback.userId,
            items: vanRollback.previousItems,
            lastUpdated: new Date().toISOString(),
          });
        }
        return NextResponse.json(
          { error: 'Gagal kemas kini baki pelanggan. Pembatalan digugurkan.' },
          { status: 500 }
        );
      }
    }

    const now = new Date().toISOString();
    // Jangan set `updated_at` — kolum itu tidak wujud pada banyak pangkalan (schema asal
    // sales_transactions hanya ada created_at); PostgREST akan gagal keseluruhan UPDATE.
    let updatePayload: Record<string, unknown> = {
      voided_at: now,
      voided_by: currentUser.id,
      void_remarks: remarks,
      original_grand_total: originalGrand,
      original_subtotal_amount: originalSubtotal,
      grand_total: 0,
      subtotal_amount: 0,
      status: 'voided',
      notes: [String(sale.notes || '').trim(), `[VOID ${now}] ${remarks}`].filter(Boolean).join(' | '),
    };

    let updErr: { message?: string; code?: string } | null = null;
    /** Kolum void tambahan — boleh digugurkan jika DB belum dimigrasi penuh (kecuali voided_at). */
    const optionalVoidColumns = new Set([
      'voided_by',
      'void_remarks',
      'original_grand_total',
      'original_subtotal_amount',
    ]);

    for (let attempt = 0; attempt < 14; attempt += 1) {
      const result = await supabaseAdmin.from(SALES_TABLE).update(updatePayload).eq('id', saleId);
      updErr = result.error;
      if (!updErr) {
        updErr = null;
        break;
      }

      const message = String(updErr.message || '');
      if (isForeignKeyViolation(updErr) && 'voided_by' in updatePayload) {
        delete updatePayload.voided_by;
        console.warn('[void sale] voided_by FK rejected; retrying without voided_by.');
        continue;
      }

      const missingColumnMatch = /Could not find the '([^']+)' column/i.exec(message);
      if (missingColumnMatch) {
        const col = missingColumnMatch[1];
        if (col === 'voided_at') {
          break;
        }
        if (optionalVoidColumns.has(col) && col in updatePayload) {
          delete updatePayload[col];
          console.warn(`[void sale] dropping optional column '${col}' from void update and retrying.`);
          continue;
        }
      }

      break;
    }

    if (updErr) {
      const hint =
        /voided_at|void_remarks|original_grand/i.test(String(updErr.message || ''))
          ? ' Jalankan migrasi SQL `20260513_sales_void_columns.sql` di Supabase.'
          : '';
      console.error('[void sale] update failed:', updErr);
      if (vanRollback) {
        await db.vanInventories.save({
          id: vanRollback.inventoryId,
          userId: vanRollback.userId,
          items: vanRollback.previousItems,
          lastUpdated: new Date().toISOString(),
        });
      }
      if (balanceRollback && supabaseAdmin) {
        const { customersTable, customerId, restoreTo } = balanceRollback;
        await supabaseAdmin
          .from(customersTable)
          .update({
            current_balance: restoreTo,
            outstandingBalance: restoreTo,
          })
          .eq('id', customerId);
      }
      return NextResponse.json(
        { error: 'Gagal mengemas kini rekod jualan.', details: `${updErr.message || ''}${hint}`.trim() },
        { status: 500 }
      );
    }

    if (voidOtpChallengeId) {
      const { error: otpMarkErr } = await supabaseAdmin
        .from(VOID_OTP_TABLE)
        .update({ used_at: new Date().toISOString() })
        .eq('id', voidOtpChallengeId);
      if (otpMarkErr) {
        console.warn('[void sale] void succeeded but failed to mark OTP used:', otpMarkErr);
      }
    }

    await logAuditEvent({
      request,
      actor: currentUser,
      module: 'sales',
      action: 'void_sale',
      entityType: 'sales_transaction',
      entityId: saleId,
      branch: saleBranch || undefined,
      status: 'success',
      sourceSystem: 'supabase',
      metadata: {
        invoice: sale.invoice,
        original_grand_total: originalGrand,
        remarks,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Invois dibatalkan. Stok van dikembalikan.',
      saleId,
    });
  } catch (error) {
    console.error('POST /api/sales/[id]/void:', error);
    return NextResponse.json({ error: 'Ralat pelayan' }, { status: 500 });
  }
}
