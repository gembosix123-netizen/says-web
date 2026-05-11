import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';
import { logAuditEvent } from '@/lib/audit';

const EXPENSES_TABLE = 'expenses';

function branchMatchesExpense(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = String(a || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const right = String(b || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return left === right;
}

const ALLOWED_CATEGORIES = [
  'minyak', 'tol', 'parking', 'makan', 'penginapan',
  'telefon', 'peralatan', 'lain-lain',
] as const;

// ============================================================================
// GET — list expenses
// ============================================================================
export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const role = normalizeRole(user.role);
  const branch = searchParams.get('branch');
  const status = searchParams.get('status');
  const salesman_id = searchParams.get('salesman_id');
  const date_from = searchParams.get('date_from');
  const date_to = searchParams.get('date_to');
  const category = searchParams.get('category');

  let query = supabaseAdmin
    .from(EXPENSES_TABLE)
    .select('*')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  // Sales can only see their own expenses
  if (role === 'Sales') {
    query = query.eq('salesman_id', user.id);
  } else if (role === 'Admin') {
    query = query.eq('branch', user.branch);
  } else if (branch && branch !== 'all') {
    query = query.eq('branch', branch);
  }

  if (status) query = query.eq('status', status);
  if (salesman_id && role !== 'Sales') query = query.eq('salesman_id', salesman_id);
  if (category) query = query.eq('category', category);
  if (date_from) query = query.gte('expense_date', date_from);
  if (date_to) query = query.lte('expense_date', date_to);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

// ============================================================================
// POST — create expense
// ============================================================================
export async function POST(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = normalizeRole(user.role);
  if (role === 'Sales') {
    return NextResponse.json({ error: 'Jurujual tidak boleh menghantar expense. Sila hubungi admin cawangan.' }, { status: 403 });
  }
  if (role !== 'Admin' && role !== 'Main Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

  const body = await request.json();
  const {
    category,
    amount,
    description,
    receipt_image_urls,
    related_sale_id,
    related_invoice,
    expense_date,
    district,
    salesman_id,
  } = body;

  if (!salesman_id || typeof salesman_id !== 'string') {
    return NextResponse.json({ error: 'Medan salesman_id diperlukan (jurujual yang berkaitan).' }, { status: 400 });
  }

  const { data: targetUser, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, name, branch, role')
    .eq('id', salesman_id)
    .maybeSingle();

  if (userErr || !targetUser) {
    return NextResponse.json({ error: 'salesman_id tidak dijumpai.' }, { status: 400 });
  }

  if (role === 'Admin' && user.branch && !branchMatchesExpense(targetUser.branch as string, user.branch)) {
    return NextResponse.json({ error: 'Jurujual mesti dari cawangan anda.' }, { status: 403 });
  }

  // Validation
  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Kategori tidak sah. Sila pilih kategori yang betul.' }, { status: 400 });
  }
  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'Jumlah perbelanjaan mesti lebih dari RM 0.' }, { status: 400 });
  }
  const proofUrls = Array.isArray(receipt_image_urls)
    ? receipt_image_urls.filter(Boolean)
    : [];
  if (proofUrls.length === 0) {
    return NextResponse.json({
      error: 'Gambar resit wajib! Sila tangkap atau muat naik gambar resit sebelum hantar.',
    }, { status: 400 });
  }

  const record = {
    branch: (body.branch as string) || (targetUser.branch as string) || user.branch,
    district: district || null,
    salesman_id: targetUser.id as string,
    salesman_name: (targetUser.name as string) || String(salesman_id),
    related_sale_id: related_sale_id || null,
    related_invoice: related_invoice || null,
    category,
    amount: Number(amount),
    description: description || null,
    receipt_image_urls: proofUrls,
    status: 'pending',
    expense_date: expense_date || new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from(EXPENSES_TABLE)
    .insert(record)
    .select()
    .single();

  if (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Gagal simpan perbelanjaan. Cuba lagi.' }, { status: 500 });
  }

  await logAuditEvent({
    actor: user,
    module: 'expenses',
    action: 'create_expense',
    entityType: 'expense',
    entityId: data.id,
    branch: user.branch,
    status: 'success',
    metadata: { category, amount, expense_date },
  });

  return NextResponse.json(data, { status: 201 });
}

// ============================================================================
// PATCH — approve / reject / mark paid
// ============================================================================
export async function PATCH(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = normalizeRole(user.role);
  if (role !== 'Main Admin') {
    return NextResponse.json({ error: 'Hanya Main Admin boleh approve/reject/mark paid perbelanjaan.' }, { status: 403 });
  }

  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

  const body = await request.json();
  const { id, status, reject_reason } = body;

  if (!id || !status) {
    return NextResponse.json({ error: 'ID dan status diperlukan.' }, { status: 400 });
  }
  if (!['approved', 'rejected', 'paid'].includes(status)) {
    return NextResponse.json({ error: 'Status tidak sah.' }, { status: 400 });
  }
  if (status === 'rejected' && !reject_reason?.trim()) {
    return NextResponse.json({ error: 'Sila nyatakan sebab penolakan.' }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'approved') {
    updatePayload.approved_by = user.id;
    updatePayload.approved_by_name = user.name || user.username;
    updatePayload.approved_at = new Date().toISOString();
  }
  if (status === 'rejected') {
    updatePayload.reject_reason = reject_reason;
  }
  if (status === 'paid') {
    updatePayload.paid_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from(EXPENSES_TABLE)
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Gagal kemaskini status.' }, { status: 500 });
  }

  await logAuditEvent({
    actor: user,
    module: 'expenses',
    action: `expense_${status}`,
    entityType: 'expense',
    entityId: id,
    branch: user.branch,
    status: 'success',
    metadata: { new_status: status, reject_reason: reject_reason || null },
  });

  return NextResponse.json(data);
}
