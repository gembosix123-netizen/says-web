import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CommissionPolicy } from '@/types';

function getSessionUser(request: Request): { id: string; role: string; branch?: string } | null {
  try {
    const raw = (request as Request & { cookies?: { get: (name: string) => { value: string } | undefined } }).cookies?.get('session')?.value;
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

function canManagePolicies(role?: string) {
  return role === 'Main Admin';
}

function canViewPolicies(role?: string) {
  return role === 'Main Admin' || role === 'Admin';
}

export async function GET(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user || !canViewPolicies(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branch = searchParams.get('branch');
  const status = searchParams.get('status');

  const all = await db.commissionPolicies.getAll();
  const filtered = all.filter((policy) => {
    if (branch && branch !== 'all' && policy.branch !== 'all' && policy.branch !== branch) return false;
    if (status && policy.status !== status) return false;
    if (user.role === 'Admin' && user.branch && policy.branch !== 'all' && policy.branch !== user.branch) return false;
    return true;
  });

  const active = filtered
    .filter((item) => item.status === 'active')
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0] || null;

  return NextResponse.json({ policies: filtered, activePolicy: active });
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user || !canManagePolicies(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const now = new Date().toISOString();
  const policy: CommissionPolicy = {
    id: crypto.randomUUID(),
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
    effectiveFrom: String(body.effectiveFrom || now.split('T')[0]),
    effectiveTo: body.effectiveTo || null,
    status: body.status === 'active' ? 'active' : 'draft',
    branch: body.branch || 'all',
    cashCommissionRate: Number(body.cashCommissionRate ?? 0),
    creditCommissionRate: Number(body.creditCommissionRate ?? 0),
    marginCommissionEnabled: Boolean(body.marginCommissionEnabled),
    marginCommissionPerUnit: Number(body.marginCommissionPerUnit ?? 0),
    kpiTiers: Array.isArray(body.kpiTiers) ? body.kpiTiers : [],
    notes: body.notes ? String(body.notes) : '',
  };

  if (!Array.isArray(policy.kpiTiers) || policy.kpiTiers.length === 0) {
    return NextResponse.json({ error: 'kpiTiers is required' }, { status: 400 });
  }

  if (policy.status === 'active') {
    const existing = await db.commissionPolicies.getAll();
    const toArchive = existing.filter(
      (item) => item.status === 'active' && (item.branch === policy.branch || item.branch === 'all' || policy.branch === 'all')
    );
    for (const item of toArchive) {
      await db.commissionPolicies.save({ ...item, status: 'archived', updatedAt: now });
    }
  }

  await db.commissionPolicies.save(policy);
  return NextResponse.json({ success: true, policy }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user || !canManagePolicies(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  if (!body?.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const all = await db.commissionPolicies.getAll();
  const existing = all.find((item) => item.id === body.id);
  if (!existing) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }

  const updated: CommissionPolicy = {
    ...existing,
    ...body,
    updatedAt: new Date().toISOString(),
  };

  if (body.status === 'active') {
    const now = new Date().toISOString();
    const toArchive = all.filter((item) => item.id !== existing.id && item.status === 'active' && item.branch === updated.branch);
    for (const item of toArchive) {
      await db.commissionPolicies.save({ ...item, status: 'archived', updatedAt: now });
    }
  }

  await db.commissionPolicies.save(updated);
  return NextResponse.json({ success: true, policy: updated });
}
