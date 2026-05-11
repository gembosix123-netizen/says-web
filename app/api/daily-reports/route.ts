import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DailyReport } from '@/types';
import { normalizeRole, type NormalizedRole } from '@/lib/roles';
import {
  canFinalApproveDailyReport,
  canForwardDailyReportToHQ,
  canSaveBranchDailyReport,
} from '@/lib/permissions';
import { branchLabelsEquivalent } from '@/lib/branchPermissions';

function getSessionUser(request: Request): { id: string; role: string; branch?: string; name?: string } | null {
  try {
    const raw = (request as Request & { cookies?: { get: (name: string) => { value: string } | undefined } }).cookies?.get('session')?.value;
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

function canReview(role: NormalizedRole | string) {
  const r = typeof role === 'string' ? normalizeRole(role) : role;
  return r === 'Main Admin' || r === 'Admin';
}

function sessionRole(user: { role: string }): NormalizedRole {
  return normalizeRole(user.role);
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
    if (branch && branch !== 'all' && !branchLabelsEquivalent(report.branch, branch)) return false;
    if (userId && report.userId !== userId) return false;
    if (source && report.source !== source) return false;
    if (approvalStage && report.approvalStage !== approvalStage) return false;
    if (publishedOnly && !String(report.status).startsWith('approved_')) return false;

    const r = sessionRole(user);
    if (r === 'Sales' || r === 'Merchandiser') {
      return report.userId === user.id;
    }
    if (r === 'Admin' && user.branch) {
      return branchLabelsEquivalent(report.branch, user.branch);
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

  const normRole = sessionRole(user);
  const now = new Date().toISOString();
  const approvalStage = body.approvalStage === 'weekly' || body.approvalStage === 'monthly'
    ? body.approvalStage
    : 'daily';
  const source = body.source === 'sales' || body.source === 'merch' || body.source === 'settlement'
    ? body.source
    : 'manual';

  const reportUserId = String(body.userId || user.id);
  if (normRole === 'Sales' && source === 'sales' && reportUserId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (normRole === 'Merchandiser' && source === 'merch' && reportUserId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const all = (await db.dailyReports.getAll()).map(mapLegacyRead);
  const existing = all.find(
    (item) =>
      item.userId === reportUserId &&
      item.date === String(body.date) &&
      item.source === source
  );

  let status: DailyStatus;
  let clearBranchSync = false;
  if (normRole === 'Sales' && source === 'sales') {
    if (
      existing &&
      existing.userId === user.id &&
      !['draft', 'returned_daily'].includes(String(existing.status))
    ) {
      return NextResponse.json({ error: 'Laporan sudah diproses admin/HQ.' }, { status: 409 });
    }
    status = 'draft';
    if (existing?.status === 'returned_daily' && existing.userId === user.id) {
      clearBranchSync = true;
    }
  } else if (normRole === 'Merchandiser' && source === 'merch') {
    if (
      existing &&
      existing.userId === user.id &&
      !['draft', 'returned_daily'].includes(String(existing.status))
    ) {
      return NextResponse.json({ error: 'Laporan sudah diproses.' }, { status: 409 });
    }
    status = 'draft';
    if (existing?.status === 'returned_daily' && existing.userId === user.id) {
      clearBranchSync = true;
    }
  } else {
    status = body.status === 'draft' ? 'draft' : getSubmittedStatus(approvalStage);
  }
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
    branchExpensesSyncedAt: clearBranchSync ? undefined : existing?.branchExpensesSyncedAt,
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

  const normRole = sessionRole(user);

  if ((normRole === 'Sales' || normRole === 'Merchandiser') && existing.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const approvalStage = body.approvalStage === 'weekly' || body.approvalStage === 'monthly'
    ? body.approvalStage
    : existing.approvalStage || getApprovalStageFromStatus(existing.status);
  const action = body.action as string | undefined;
  const requestedStatus = body.status ? normalizeStatus(body.status) : undefined;
  let nextStatus: DailyStatus = requestedStatus || existing.status;

  if (action === 'save_branch_report') {
    if (!canSaveBranchDailyReport(normRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (normRole === 'Admin' && user.branch && !branchLabelsEquivalent(existing.branch, user.branch)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const stage = existing.approvalStage || 'daily';
    const st = String(existing.status);
    if (stage !== 'daily' || !['draft', 'returned_daily'].includes(st)) {
      return NextResponse.json({ error: 'Invalid state for branch expense save' }, { status: 400 });
    }
    const expenseLines = Array.isArray(body.expenseLines)
      ? body.expenseLines.map((line: Record<string, unknown>) => ({
          category: String(line.category || 'lain-lain'),
          description: String(line.description || ''),
          amount: Number(line.amount || 0),
          receiptImageUrls: Array.isArray(line.receiptImageUrls)
            ? line.receiptImageUrls.map((url) => String(url))
            : [],
        }))
      : existing.expenseLines || [];
    const updatedSave: DailyReport = {
      ...existing,
      approvalStage,
      expenseLines,
      expensesTotal: computeExpensesTotal(expenseLines),
      bankSlipUrls: Array.isArray(body.bankSlipUrls)
        ? body.bankSlipUrls.map((url: unknown) => String(url))
        : existing.bankSlipUrls || [],
      cashProofUrls: Array.isArray(body.cashProofUrls)
        ? body.cashProofUrls.map((url: unknown) => String(url))
        : existing.cashProofUrls || [],
      amountBankingManual: Number(body.amountBankingManual ?? existing.amountBankingManual ?? 0),
      balancePtCashManual: Number(body.balancePtCashManual ?? existing.balancePtCashManual ?? 0),
      totalTransfer: Number(body.totalTransfer ?? existing.totalTransfer ?? 0),
      branchExpensesSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.dailyReports.save(updatedSave);
    return NextResponse.json({ success: true, report: updatedSave });
  }

  if (action === 'submit_stage') {
    if (approvalStage === 'daily') {
      const st = String(existing.status);
      if (st === 'draft' || st === 'returned_daily') {
        if (!canForwardDailyReportToHQ(normRole)) {
          return NextResponse.json({ error: 'Hanya admin cawangan boleh hantar ke HQ.' }, { status: 403 });
        }
        if (normRole === 'Admin' && user.branch && !branchLabelsEquivalent(existing.branch, user.branch)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (!existing.branchExpensesSyncedAt) {
          return NextResponse.json(
            { error: 'Sila simpan perbelanjaan ke dalam laporan dahulu (admin cawangan).' },
            { status: 400 }
          );
        }
        nextStatus = 'submitted_daily';
      } else {
        return NextResponse.json({ error: 'Invalid submit transition for daily report' }, { status: 400 });
      }
    } else {
      if (normRole !== 'Sales' && normRole !== 'Merchandiser' && !canReview(normRole)) {
        return NextResponse.json({ error: 'Only staff can submit reports' }, { status: 403 });
      }
      nextStatus = getSubmittedStatus(approvalStage);
    }
  } else if (action === 'approve_stage') {
    if (approvalStage === 'daily') {
      if (!canFinalApproveDailyReport(normRole)) {
        return NextResponse.json({ error: 'Hanya Main Admin boleh lulus laporan harian.' }, { status: 403 });
      }
    } else if (!canReview(normRole)) {
      return NextResponse.json({ error: 'Only admin roles can approve reports' }, { status: 403 });
    }
    nextStatus = getApprovedStatus(approvalStage);
  } else if (action === 'return_stage') {
    if (approvalStage === 'daily') {
      if (!canFinalApproveDailyReport(normRole)) {
        return NextResponse.json({ error: 'Hanya Main Admin boleh pulangkan laporan harian.' }, { status: 403 });
      }
    } else if (!canReview(normRole)) {
      return NextResponse.json({ error: 'Only admin roles can return reports' }, { status: 403 });
    }
    if (!String(body.reviewNotes || '').trim()) {
      return NextResponse.json({ error: 'Return reason is required' }, { status: 400 });
    }
    nextStatus = getReturnedStatus(approvalStage);
  } else if (requestedStatus) {
    if (normRole === 'Sales' || normRole === 'Merchandiser') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (
      approvalStage === 'daily' &&
      (String(requestedStatus).includes('approved') || String(requestedStatus).includes('returned'))
    ) {
      if (!canFinalApproveDailyReport(normRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (
      (String(requestedStatus).includes('approved') || String(requestedStatus).includes('returned')) &&
      !canReview(normRole)
    ) {
      return NextResponse.json({ error: 'Only admin roles can review reports' }, { status: 403 });
    }
    nextStatus = requestedStatus;
  } else {
    return NextResponse.json({ error: 'action or status is required' }, { status: 400 });
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
    branchExpensesSyncedAt: String(nextStatus).startsWith('returned_')
      ? undefined
      : existing.branchExpensesSyncedAt,
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
