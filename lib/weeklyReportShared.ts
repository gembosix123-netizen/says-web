import type { DailyReport } from '@/types';
import { branchLabelsEquivalent } from '@/lib/branchPermissions';

export function transactionIsVoided(tx: Record<string, unknown>): boolean {
  if (tx.voided_at) return true;
  return String(tx.status || '').toLowerCase() === 'voided';
}

export function computeExpenseLinesTotal(lines: DailyReport['expenseLines'] | undefined): number {
  return (lines || []).reduce((sum, line) => sum + Number(line.amount || 0), 0);
}

function dailyReportHasExpensePayload(r: DailyReport): boolean {
  if (r.branchExpensesSyncedAt) return true;
  if (Array.isArray(r.expenseLines) && r.expenseLines.length > 0) return true;
  if (Number(r.expensesTotal || 0) > 0) return true;
  return false;
}

function amountFromDailyReport(r: DailyReport): number {
  if (Array.isArray(r.expenseLines) && r.expenseLines.length > 0) {
    return computeExpenseLinesTotal(r.expenseLines);
  }
  return Number(r.expensesTotal || 0);
}

export type DailyReportExpenseRow = {
  date: string;
  branch: string;
  userName: string;
  amount: number;
};

/**
 * Sum branch daily report expenses for ISO dates in [startDateStr, endDateStr].
 * branchFilter empty = all branches.
 */
export function collectDailyReportExpensesInRange(
  reports: DailyReport[],
  startDateStr: string,
  endDateStr: string,
  branchFilter: string,
): { total: number; rows: DailyReportExpenseRow[]; matchedReportCount: number } {
  const rows: DailyReportExpenseRow[] = [];
  let total = 0;
  let matchedReportCount = 0;

  for (const r of reports) {
    if (!dailyReportHasExpensePayload(r)) continue;
    const d = r.date;
    if (!d || d < startDateStr || d > endDateStr) continue;
    if (branchFilter && !branchLabelsEquivalent(String(r.branch || ''), branchFilter)) continue;

    const amount = amountFromDailyReport(r);

    total += amount;
    matchedReportCount += 1;
    rows.push({
      date: d,
      branch: String(r.branch || ''),
      userName: String(r.userName || ''),
      amount,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.branch.localeCompare(b.branch));
  return { total, rows, matchedReportCount };
}
