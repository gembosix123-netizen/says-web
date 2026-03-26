import type { NormalizedRole } from '@/lib/roles';

function matchesPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function canAccessAdminPath(role: NormalizedRole, pathname: string): boolean {
  if (role === 'Main Admin') return true;

  const adminAllowedPaths = [
    '/admin',
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
  ];

  const salesAllowedPaths = [
    '/admin',
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
