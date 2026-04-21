import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUserFromRequest } from '@/lib/session';
import { normalizeRole } from '@/lib/roles';

type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export async function GET(request: NextRequest) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const role = normalizeRole(user.role);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const branch = searchParams.get('branch');
    const userId = searchParams.get('userId');

    let query = supabaseAdmin.from('expenses').select('*').order('expense_date', { ascending: false });

    if (role === 'Sales' || role === 'Merchandiser') {
      query = query.eq('user_id', user.id);
    } else if (role === 'Admin') {
      query = query.eq('branch', user.branch);
    } else if (branch && branch !== 'all') {
      query = query.eq('branch', branch);
    }

    if (date) query = query.eq('expense_date', date);
    if (startDate) query = query.gte('expense_date', startDate);
    if (endDate) query = query.lte('expense_date', endDate);
    if (status) query = query.eq('status', status);
    if (userId && (role === 'Main Admin' || role === 'Super Admin' || role === 'Admin')) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching expenses:', error);
      return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }

    return NextResponse.json({ expenses: data || [] });
  } catch (error) {
    console.error('Error in GET /api/expenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const body = await request.json();
    const { expense_date, category, description, amount, receipt_image_urls } = body;

    if (!expense_date || !category || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: expense_date, category, amount' },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const proofUrls = Array.isArray(receipt_image_urls) ? receipt_image_urls.filter(Boolean) : [];
    if (proofUrls.length === 0) {
      return NextResponse.json(
        { error: 'Gambar resit wajib! Sila upload sekurang-kurangnya satu gambar resit.' },
        { status: 400 }
      );
    }

    const payload = {
      expense_date,
      category,
      description: description || null,
      amount: numericAmount,
      status: 'pending' as ExpenseStatus,
      receipt_image_urls: proofUrls,
      user_id: user.id,
      user_name: user.name || user.username || 'Unknown',
      branch: user.branch || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from('expenses').insert(payload).select().single();
    if (error) {
      console.error('Error creating expense:', error);
      return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/expenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

