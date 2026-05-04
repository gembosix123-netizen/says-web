import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DailyReport } from '@/types';

function getSessionUser(request: Request): { id: string; role: string; branch?: string; name?: string } | null {
  try {
    const raw = (request as Request & { cookies?: { get: (name: string) => { value: string } | undefined } }).cookies?.get('session')?.value;
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

function canReview(role?: string) {
  return role === 'Main Admin' || role === 'Admin';
}

/** Loose branch match — sama seperti /api/sales (KK vs Kota Kinabalu, spacing). */
function normalizeBranchValue(value?: string | null): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function branchMatches(reportBranch: unknown, expectedBranch: unknown): boolean {
  const left = normalizeBranchValue(reportBranch as string | null);
  const right = normalizeBranchValue(expectedBranch as string | null);
  if (!right || right === 'all') return true;
  if (!left) return false;
  return left === right;
}

type DailyStatus = DailyReport['status'];

const LEGACY_STATUS_MAP: Record<string, DailyStatus> = {
  submitted: 'submitted_daily',
  reviewed: 'submitted_daily',
  approved: 'approved_daily',
  returned: 'returned_daily',
};

function normalizeStatus(status: unknown): DailyStatus {
  if (typeof status !== 'string') return 'submitted_daily';
  const mapped = LEGACY_STATUS_MAP[status];
  if (mapped) return mapped;
  return status as DailyStatus;
}

function getApprovalStageFromStatus(status: DailyStatus): DailyReport['approvalStage'] {
  if (status.includes('weekly')) return 'weekly';
  if (status.includes('monthly')) return 'monthly';
  return 'daily';
}

function mapLegacyRead(report: DailyReport): DailyReport {
  const status = normalizeStatus(report.status);
  return {
    ...report,
    status,
    approvalStage: report.approvalStage || getApprovalStageFromStatus(status),
  };
}

function computeExpensesTotal(lines: DailyReport['expenseLines']) {
  return (lines || []).reduce((sum, line) => sum + Number(line.amount || 0), 0);
}

function getSubmittedStatus(stage: DailyReport['approvalStage']): DailyStatus {
  if (stage === 'weekly') return 'submitted_weekly';
  if (stage === 'monthly') return 'submitted_monthly';
  return 'submitted_daily';
}

function getApprovedStatus(stage: DailyReport['approvalStage']): DailyStatus {
  if (stage === 'weekly') return 'approved_weekly';
  if (stage === 'monthly') return 'approved_monthly';
  return 'approved_daily';
}

function getReturnedStatus(stage: DailyReport['approvalStage']): DailyStatus {
  if (stage === 'weekly') return 'returned_weekly';
  if (stage === 'monthly') return 'returned_monthly';
  return 'returned_daily';
}

async function syncReportsFromSettlements() {
  const reports = await db.dailyReports.getAll();
  const settlements = await db.settlements.getAll();
  const keys = new Set(reports.map((r) => `${r.userId}:${r.date}`));
  const now = new Date().toISOString();

  for (const settlement of settlements) {
    const key = `${settlement.userId}:${settlement.date}`;
    if (keys.has(key)) continue;
    const generated: DailyReport = {
      id: crypto.randomUUID(),
      userId: settlement.userId,
      userName: settlement.userName,
      branch: (settlement.branch || 'HQ') as DailyReport['branch'],
      date: settlement.date,
      totalSales: settlement.totalSales || 0,
      totalCash: settlement.totalCash || 0,
      totalCredit: settlement.totalCredit || 0,
      totalTransfer: 0,
      amountBankingManual: 0,
      balancePtCashManual: 0,
      expenseLines: [],
      expensesTotal: 0,
      bankSlipUrls: [],
      cashProofUrls: [],
      status: 'submitted_daily',
      source: 'settlement',
      settlementId: settlement.id,
      approvalStage: 'daily',
      submittedAt: settlement.submittedAt || now,
      updatedAt: now,
    };
    await db.dailyReports.save(generated);
  }
}

export async function GET(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await syncReportsFromSettlements();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const date = searchParams.get('date');
  const branch = searchParams.get('branch');
  const userId = searchParams.get('userId');
  const source = searchParams.get('source');
  const approvalStage = searchParams.get('approvalStage');
  const publishedOnly = searchParams.get('publishedOnly') === 'true';

  const all = (await db.dailyReports.getAll()).map(mapLegacyRead);
  const filtered = all.filter((report) => {
    if (status && normalizeStatus(report.status) !== normalizeStatus(status)) return false;
    if (date && report.date !== date) return false;
    if (branch && branch !== 'all' && !branchMatches(report.branch, branch)) return false;
    if (userId && report.userId !== userId) return false;
    if (source && report.source !== source) return false;
    if (approvalStage && report.approvalStage !== approvalStage) return false;
    if (publishedOnly && !String(report.status).startsWith('approved_')) return false;

    if (user.role === 'Sales' || user.role === 'Merchandiser') {
      return report.userId === user.id;
    }
    if (user.role === 'Admin' && user.branch) {
      return branchMatches(report.branch, user.branch);
    }
    return true;
  });

  const summary = {
    total: filtered.length,
    submittedDaily: filtered.filter((r) => r.status === 'submitted_daily').length,
    approvedDaily: filtered.filter((r) => r.status === 'approved_daily').length,
    submittedWeekly: filtered.filter((r) => r.status === 'submitted_weekly').length,
    approvedWeekly: filtered.filter((r) => r.status === 'approved_weekly').length,
    submittedMonthly: filtered.filter((r) => r.status === 'submitted_monthly').length,
    approvedMonthly: filtered.filter((r) => r.status === 'approved_monthly').length,
    returned: filtered.filter((r) => String(r.status).startsWith('returned_')).length,
  };

  return NextResponse.json({ reports: filtered, summary });
}

export async function POST(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  if (!body?.date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const approvalStage = body.approvalStage === 'weekly' || body.approvalStage === 'monthly'
    ? body.approvalStage
    : 'daily';
  const source = body.source === 'sales' || body.source === 'merch' || body.source === 'settlement'
    ? body.source
    : 'manual';
  const status = body.status === 'draft' ? 'draft' : getSubmittedStatus(approvalStage);
  const expenseLines = Array.isArray(body.expenseLines)
    ? body.expenseLines.map((line: Record<string, unknown>) => ({
      category: String(line.category || 'lain-lain'),
      description: String(line.description || ''),
      amount: Number(line.amount || 0),
      receiptImageUrls: Array.isArray(line.receiptImageUrls)
        ? line.receiptImageUrls.map((url) => String(url))
        : [],
    }))
    : [];
  const salesSnapshot = body.salesSnapshot && typeof body.salesSnapshot === 'object'
    ? body.salesSnapshot as DailyReport['salesSnapshot']
    : undefined;
  const reportUserId = String(body.userId || user.id);
  const all = (await db.dailyReports.getAll()).map(mapLegacyRead);
  const existing = all.find(
    (item) =>
      item.userId === reportUserId &&
      item.date === String(body.date) &&
      item.source === source
  );

  const newReport: DailyReport = {
    ...(existing || {}),
    id: existing?.id || crypto.randomUUID(),
    userId: reportUserId,
    userName: String(body.userName || user.name || existing?.userName || 'Unknown'),
    branch: (body.branch || user.branch || existing?.branch || 'HQ') as DailyReport['branch'],
    date: String(body.date),
    totalSales: Number(body.totalSales ?? existing?.totalSales ?? 0),
    totalCash: Number(body.totalCash ?? existing?.totalCash ?? 0),
    totalCredit: Number(body.totalCredit ?? existing?.totalCredit ?? 0),
    totalTransfer: Number(body.totalTransfer ?? existing?.totalTransfer ?? 0),
    amountBankingManual: Number(body.amountBankingManual ?? existing?.amountBankingManual ?? 0),
    balancePtCashManual: Number(body.balancePtCashManual ?? existing?.balancePtCashManual ?? 0),
    expenseLines: expenseLines.length > 0 ? expenseLines : (existing?.expenseLines || []),
    expensesTotal: expenseLines.length > 0
      ? computeExpensesTotal(expenseLines)
      : Number(body.expensesTotal ?? existing?.expensesTotal ?? computeExpensesTotal(existing?.expenseLines)),
    bankSlipUrls: Array.isArray(body.bankSlipUrls)
      ? body.bankSlipUrls.map((url: unknown) => String(url))
      : (existing?.bankSlipUrls || []),
    cashProofUrls: Array.isArray(body.cashProofUrls)
      ? body.cashProofUrls.map((url: unknown) => String(url))
      : (existing?.cashProofUrls || []),
    salesSnapshot: salesSnapshot || existing?.salesSnapshot,
    status,
    source,
    approvalStage,
    liveSalesRefs: Array.isArray(body.liveSalesRefs)
      ? body.liveSalesRefs.map((id: unknown) => String(id))
      : (existing?.liveSalesRefs || []),
    submittedAt: existing?.submittedAt || now,
    weeklySubmittedAt: approvalStage === 'weekly' ? now : existing?.weeklySubmittedAt,
    monthlySubmittedAt: approvalStage === 'monthly' ? now : existing?.monthlySubmittedAt,
    updatedAt: now,
  };

  await db.dailyReports.save(newReport);
  return NextResponse.json({ success: true, report: newReport }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  if (!body?.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const reports = (await db.dailyReports.getAll()).map(mapLegacyRead);
  const existing = reports.find((item) => item.id === body.id);
  if (!existing) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  if ((user.role === 'Sales' || user.role === 'Merchandiser') && existing.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const approvalStage = body.approvalStage === 'weekly' || body.approvalStage === 'monthly'
    ? body.approvalStage
    : existing.approvalStage || getApprovalStageFromStatus(existing.status);
  const action = body.action as string | undefined;
  const requestedStatus = body.status ? normalizeStatus(body.status) : undefined;
  let nextStatus: DailyStatus = requestedStatus || existing.status;

  if (action === 'submit_stage') {
    if (user.role !== 'Sales' && user.role !== 'Merchandiser' && !canReview(user.role)) {
      return NextResponse.json({ error: 'Only staff can submit reports' }, { status: 403 });
    }
    nextStatus = getSubmittedStatus(approvalStage);
  } else if (action === 'approve_stage') {
    if (!canReview(user.role)) {
      return NextResponse.json({ error: 'Only admin roles can approve reports' }, { status: 403 });
    }
    nextStatus = getApprovedStatus(approvalStage);
  } else if (action === 'return_stage') {
    if (!canReview(user.role)) {
      return NextResponse.json({ error: 'Only admin roles can return reports' }, { status: 403 });
    }
    if (!String(body.reviewNotes || '').trim()) {
      return NextResponse.json({ error: 'Return reason is required' }, { status: 400 });
    }
    nextStatus = getReturnedStatus(approvalStage);
  } else if (!requestedStatus) {
    return NextResponse.json({ error: 'action or status is required' }, { status: 400 });
  }

  if ((String(nextStatus).includes('approved') || String(nextStatus).includes('returned')) && !canReview(user.role)) {
    return NextResponse.json({ error: 'Only admin roles can review reports' }, { status: 403 });
  }

  const updated: DailyReport = {
    ...existing,
    status: nextStatus,
    approvalStage,
    amountBankingManual: Number(body.amountBankingManual ?? existing.amountBankingManual ?? 0),
    balancePtCashManual: Number(body.balancePtCashManual ?? existing.balancePtCashManual ?? 0),
    totalTransfer: Number(body.totalTransfer ?? existing.totalTransfer ?? 0),
    expenseLines: Array.isArray(body.expenseLines)
      ? body.expenseLines
      : existing.expenseLines,
    expensesTotal: Array.isArray(body.expenseLines)
      ? computeExpensesTotal(body.expenseLines)
      : Number(body.expensesTotal ?? existing.expensesTotal ?? 0),
    bankSlipUrls: Array.isArray(body.bankSlipUrls) ? body.bankSlipUrls : existing.bankSlipUrls,
    cashProofUrls: Array.isArray(body.cashProofUrls) ? body.cashProofUrls : existing.cashProofUrls,
    salesSnapshot: body.salesSnapshot && typeof body.salesSnapshot === 'object'
      ? body.salesSnapshot
      : existing.salesSnapshot,
    reviewNotes: body.reviewNotes ?? existing.reviewNotes,
    returnedReason: String(nextStatus).startsWith('returned_')
      ? String(body.reviewNotes || existing.returnedReason || '')
      : existing.returnedReason,
    updatedAt: new Date().toISOString(),
  };

  if (
    String(nextStatus).startsWith('approved_') ||
    String(nextStatus).startsWith('returned_') ||
    nextStatus === 'reviewed'
  ) {
    updated.reviewedBy = user.id;
    updated.reviewedAt = new Date().toISOString();
  }
  if (nextStatus === 'approved_daily') {
    updated.approvedDailyAt = new Date().toISOString();
    updated.approvedDailyBy = user.id;
  }
  if (nextStatus === 'approved_weekly') {
    updated.approvedWeeklyAt = new Date().toISOString();
    updated.approvedWeeklyBy = user.id;
  }
  if (nextStatus === 'approved_monthly') {
    updated.approvedMonthlyAt = new Date().toISOString();
    updated.approvedMonthlyBy = user.id;
  }
  if (action === 'submit_stage' && approvalStage === 'weekly') {
    updated.weeklySubmittedAt = new Date().toISOString();
  }
  if (action === 'submit_stage' && approvalStage === 'monthly') {
    updated.monthlySubmittedAt = new Date().toISOString();
  }

  await db.dailyReports.save(updated);
  return NextResponse.json({ success: true, report: updated });
}
