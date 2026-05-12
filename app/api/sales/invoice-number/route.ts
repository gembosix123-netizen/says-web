import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { canAccessSalesRoutes } from '@/lib/permissions';
import { generateUniqueInvoiceNo } from '@/lib/invoiceNumbers';

/**
 * Returns the next sequential invoice number for the caller's branch (preview / form prefill).
 * Main Admin may pass ?branch=... when session has no branch; Sales/Admin always use session branch.
 */
export async function GET(request: NextRequest) {
  const currentUser = getSessionUserFromRequest(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = normalizeRole(currentUser.role);
  if (!canAccessSalesRoutes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
  }

  const url = new URL(request.url);
  const branchQuery = url.searchParams.get('branch');

  let branch = '';
  if (role === 'Main Admin') {
    branch = String(branchQuery || currentUser.branch || '').trim();
  } else {
    branch = String(currentUser.branch || '').trim();
  }

  if (!branch) {
    return NextResponse.json({ error: 'Branch is required for invoice numbering' }, { status: 400 });
  }

  try {
    const invoiceNo = await generateUniqueInvoiceNo(supabaseAdmin, branch);
    return NextResponse.json({ invoiceNo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to generate invoice number';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
