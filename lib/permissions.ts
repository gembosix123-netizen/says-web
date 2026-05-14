import type { NormalizedRole } from '@/lib/roles';

function matchesPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function canAccessAdminPath(role: NormalizedRole, pathname: string): boolean {
  if (role === 'Main Admin') return true;

  const adminAllowedPaths = [
    '/admin/kota-kinabalu',
    '/admin/kinabatangan',
    '/admin/live-sales',
    '/admin/reports',
    '/admin/commissions',
    '/admin/loading',
    '/admin/orders',
    '/admin/products',
    '/admin/customers',
    '/admin/database',
    '/admin/data-archive',
    '/admin/backdated-import',
    '/admin/weekly-reports',
    '/admin/expenses',
    '/admin/day-end',
    '/admin/users',
    '/admin/stores',
    '/admin/audit-center',
    '/admin/audits',
    '/admin/outstanding',
    '/admin/sales',
  ];

  const salesAllowedPaths = [
    '/admin/kota-kinabalu',
    '/admin/kinabatangan',
    '/admin/commissions',
    '/admin/loading',
    '/admin/orders',
    '/admin/customers',
  ];

  const allowed = role === 'Admin' ? adminAllowedPaths : role === 'Sales' ? salesAllowedPaths : [];
  return allowed.some((path) => matchesPath(pathname, path));
}

export function canAccessSalesRoutes(role: NormalizedRole): boolean {
  return role === 'Sales' || role === 'Admin' || role === 'Main Admin';
}

export function canAccessMerchandiserRoutes(role: NormalizedRole): boolean {
  return role === 'Merchandiser' || role === 'Sales' || role === 'Admin' || role === 'Main Admin';
}

export function canAccessStoreVisits(role: NormalizedRole): boolean {
  return canAccessMerchandiserRoutes(role);
}

export function canViewDayEnd(role: NormalizedRole): boolean {
  return role === 'Admin' || role === 'Main Admin';
}

export function canCloseDayEnd(role: NormalizedRole): boolean {
  return role === 'Admin' || role === 'Main Admin';
}

export function canManageUsers(role: NormalizedRole): boolean {
  return role === 'Main Admin' || role === 'Admin';
}

export function canManageProducts(role: NormalizedRole): boolean {
  return role === 'Main Admin' || role === 'Admin';
}

export function canViewAudit(role: NormalizedRole): boolean {
  return role === 'Main Admin' || role === 'Admin';
}

export function canExportReports(role: NormalizedRole): boolean {
  return role === 'Main Admin' || role === 'Admin';
}

export function canManageExpenses(role: NormalizedRole): boolean {
  return role === 'Main Admin' || role === 'Admin';
}

/** Create expense rows in Supabase (branch / HQ). Sales are not allowed. */
export function canCreateExpenseRecords(role: NormalizedRole): boolean {
  return role === 'Main Admin' || role === 'Admin';
}

/** Approve, reject, or mark paid — Main Admin only. */
export function canApproveExpenseRecords(role: NormalizedRole): boolean {
  return role === 'Main Admin';
}

/** Branch admin only: save expenses into daily report draft / returned (Main Admin does not edit branch expenses). */
export function canSaveBranchDailyReport(role: NormalizedRole): boolean {
  return role === 'Admin';
}

/** Branch admin only: forward draft to Main Admin (submitted_daily). */
export function canForwardDailyReportToHQ(role: NormalizedRole): boolean {
  return role === 'Admin';
}

/** Final approve or return daily-stage report at HQ. */
export function canFinalApproveDailyReport(role: NormalizedRole): boolean {
  return role === 'Main Admin';
}

export function canViewWeeklyReports(role: NormalizedRole): boolean {
  return role === 'Main Admin' || role === 'Admin';
}
